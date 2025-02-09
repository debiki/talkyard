/**
 * Copyright (c) 2016 Kaj Magnus Lindberg
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

package talkyard.server.search

import scala.collection.Seq
import collection.JavaConverters._
import com.debiki.core._
import com.debiki.core.Prelude._
import org.elasticsearch.action.search.{SearchRequestBuilder, SearchResponse}
import org.elasticsearch.client.Client
import org.elasticsearch.index.query.QueryBuilders
import org.elasticsearch.action.ActionListener
import org.elasticsearch.search.fetch.subphase.highlight.HighlightBuilder
import org.{elasticsearch => es}
import es.search.sort.{FieldSortBuilder => es_FieldSortBuilder}
import org.scalactic.{Bad, Good}
import scala.collection.immutable
import scala.concurrent.{Future, Promise}
import talkyard.server.TyLogging


class SearchEngine(
  private val siteId: SiteId,
  private val elasticSearchClient: Client,
  private val ffIxMapping2: Bo) extends TyLogging {

  /**
    *
    * @param searchQuery
    * @param anyRootPageId
    * @param user
    * @param anyOffset — Later, use some kind of cursor instead, so no results
    *   gets accidentally skipped. (Which, although unlikely, could happen if
    *   something gets edited in between an offset 0 and offset N query.)
    * @param addMarkTagClasses
    */
  def search(searchQuery: SearchQuery, anyRootPageId: Opt[St], user: Opt[Pat],
        anyOffset: Opt[i32], addMarkTagClasses: Bo)
        : Future[immutable.Seq[SearchHit]] = {
    // Tests:
    // - TESTS_MISSING  TyTSERPLOADMORE

    if (searchQuery.isEmpty)
      return Future.successful(Nil)

    val boolQuery = QueryBuilders.boolQuery()

    // ----- Free text

    // Fuzzy search, should find "shoe" also if you search for "shoes".
    // (Don't use `fullTextQuery` — it includes params like "tags:... category:...".)
    // BUT this only works if the correct language settings are used,
    // however currently we use English always. [es_wrong_lang]
    //
    // Search approved text only, but not not-yet-approved edits or new posts — not-yet-
    // -approved things shouldn't be visible or searchable.
    // (Any unapproved source is still indexed, but we don't search it here. [ix_unappr])
    //
    if (searchQuery.queryWithoutParams.nonEmpty) {
      boolQuery.must(
        // If is staff, could search unapproved html too, something like:
        // .setQuery(QueryBuilders.multiMatchQuery(phrase, "approvedHtml", "unapprovedSource"))
        QueryBuilders.matchQuery(
                  PostDocFields.ApprovedPlainText, searchQuery.queryWithoutParams))
    }
    else {
      // Then maybe we're searching for tags, categories, is:idea/closed/solved/etc
      // — let's return only orig posts and titles. We don't want 100 comments on a,
      // say, Idea page to generate 100 hits, if searching for "is:idea".
      // But for this to work, we need to reindex the whole site. Otherwise, only
      // recently indexed topics will be found. For now, let's set a feature flag
      // for such reindexed sites — still trying this out.
      if (ffIxMapping2) {
        boolQuery.filter(
              QueryBuilders.termQuery(PostDocFields.PostType, OrigPostType))
      }
      else {
        // Haven't yet reindexed.
      }
    }

    // ----- Special

    // Form submissions are private, currently for admins only. [5GDK02]
    if (!user.exists(_.isAdmin)) {
      WOULD_OPTIMIZE // Use some flavor of  filterNot() instead, for performance. [filter_not]
      // (Any matches are filtered out anyway, later.  [se_acs_chk])
      // Apparently  `"bool" { "filter" { "bool": { "must_not": ...` can work? But then,
      // would "must_not" contribute to scoring, and thus be slower? It normally does,
      // but it's wrapped in "filter" which does not.
      // See:  https://stackoverflow.com/a/41134914
      //        "How to implement elastic search not filter?"
      boolQuery.mustNot(
            QueryBuilders.termQuery(
                  PostDocFields.PostType, PostType.CompletedForm.toInt))
    }

    // ----- Is:Something

    // For now,  "is:aa,bb,cc"  means only pages matching all of  aa, bb, cc   are found,
    // rather than any of   aa, bb or cc  — which is how  "tags:aa,bb,cc"  works though!
    // Change / fix later?  [search_hmm]

    searchQuery.isWhat.pageType foreach { pageType =>
      val q = QueryBuilders.termQuery(PostDocFields.PageType, pageType.toInt)
      boolQuery.filter(q)
    }

    searchQuery.isWhat.pageOpen foreach { isOpen =>
      val q = QueryBuilders.termQuery(PostDocFields.PageOpen, isOpen)
      boolQuery.filter(q)
    }

    searchQuery.isWhat.pageSolved foreach { isSolved =>
      val q = QueryBuilders.termQuery(PostDocFields.PageSolved, isSolved)
      boolQuery.filter(q)
    }

    searchQuery.isWhat.pageDoingStatus foreach { status =>
      val q = QueryBuilders.termQuery(PostDocFields.PageDoingStatus, status.toInt)
      boolQuery.filter(q)
    }

    // ----- Tags

    // Matching more tags is better, so, if many, use must(). But if just one,
    // use filter(). (Or does ES optimize this, itself?)  _must_if_many
    val useMustForTags = searchQuery.tagTypeIds.size +  searchQuery.tagValComps.size >= 2

    if (searchQuery.tagTypeIds.nonEmpty) {
      val q = QueryBuilders.termsQuery(
                  PostDocFields.TagTypeIds, searchQuery.tagTypeIds.asJava)
      if (useMustForTags)
        boolQuery.must(q)
      else
        boolQuery.filter(q)
    }

    if (searchQuery.notTagTypeIds.nonEmpty) {
      WOULD_OPTIMIZE // Use filterNot() [filter_not].
      boolQuery.mustNot(
            QueryBuilders.termsQuery(
                  PostDocFields.TagTypeIds, searchQuery.notTagTypeIds.asJava))
    }

    // ----- Authors

    if (searchQuery.authorIds.nonEmpty) {
      // _must_if_many
      val q = QueryBuilders.termsQuery(
                  PostDocFields.AuthorIds, searchQuery.authorIds.asJava)
      if (searchQuery.authorIds.size >= 2)
        boolQuery.must(q)
      else
        boolQuery.filter(q)
    }

    // ----- Category

    BUG; SHOULD // This looks only at one exact cat, ignores sub & sub sub cats.
    // Probably should do a must-or query that lists all sub cats?  [search_hmm]
    if (searchQuery.catIds.nonEmpty) {
      // (Each page is in only one category, so it's pointless to use a must() query.)
      boolQuery.filter(
            QueryBuilders.termsQuery(
                  PostDocFields.ParentCatId, searchQuery.catIds.asJava))
    }

    boolQuery.filter(
          QueryBuilders.termQuery(PostDocFields.SiteId, siteId))

    // ----- Tag values

    // We need one nested query, per tag value (right?) — since each one of them
    // is in its own nested doc.
    // ((filter() adds another nested query to the same list of filter queries as the
    // earlier filter queries, that is, the tag value queries end up in the same
    // filter-queries-list as the `siteId` and `catIds` queries.))
    for (tagValComp <- searchQuery.tagValComps) {
      // Find any tag-value nested doc of the correct tag type.
      val tagType: TagType = tagValComp._1
      val tagTypeQ = QueryBuilders.termQuery(
              s"${PostDocFields.TagValsNested}.${ValFields.TagTypeId}", tagType.id)

      // Compare tag value, depending on the operator (e.g.  '=', '>', '>=').
      val compOpVal: CompOpVal = tagValComp._2
      val valAsObj: Object = compOpVal.compWith.valueAsObj // ES wants an Object
      val valueFieldName = PostDocFields.TagValsNested + "." + ValFields.fieldNameFor(
            // Should always be defined — we [skip_tag_comps_if_tag_type_cant_have_values].
            tagType.valueType getOrDie "TyE5MWSLUFP4")
      val tagValQ = compOpVal.compOp match {
        case CompOp.Eq =>
          QueryBuilders.termQuery(valueFieldName, valAsObj)

        case CompOp.Lt | CompOp.Gt | CompOp.Lte | CompOp.Gte =>
          val rangeQ = QueryBuilders.rangeQuery(valueFieldName)
          compOpVal.compOp match {
            case CompOp.Lt => rangeQ.lt(valAsObj)
            case CompOp.Gt => rangeQ.gt(valAsObj)
            case CompOp.Lte => rangeQ.lte(valAsObj)
            case CompOp.Gte => rangeQ.gte(valAsObj)
            case _ => die("TyESECOMPSYMB02", s"Forgot to handle comp op: ${compOpVal.compOp}")
          }
          rangeQ

        case _ =>
          die("TyESECOMPSYMB03", s"Forgot to handle comp op: ${compOpVal.compOp}")
      }

      val tagQ = QueryBuilders.nestedQuery(
            // Path to the nested docs with e.g.:  { tagTypeId: ... valInt32:... }
            PostDocFields.TagValsNested,
            QueryBuilders.boolQuery()
                .filter(tagTypeQ)  // right type of tag?
                .filter(tagValQ),  // tag value matches value in query?
            // Should a tag have *many* numeric values (they don't), use the average.
            org.apache.lucene.search.join.ScoreMode.Avg)
      if (useMustForTags)
        boolQuery.must(tagQ)
      else
        boolQuery.filter(tagQ)
    }

    // ----- Sort order

    val sortBuilders: ImmSeq[es_FieldSortBuilder] = searchQuery.sortOrder map {
      case byTagVal: SortHitsBy.TagVal =>
        // Consider only tags of the correct type (when sorting by tag value).
        // (About filtering & sorting by nested objects — see:
        // https://www.elastic.co/guide/en/elasticsearch/reference/8.9/sort-search-results.html#_nested_sorting_examples)
        // Example (from the ES docs):
        // POST /_search  {
        //    "query" : { "term" : { "product" : "chocolate" } },
        //    "sort" : [{
        //       "offer.price" : {    <——  e.g. "tagValsNested.valInt32" in our case
        //          "mode" :  "avg",
        //          "order" : "asc",
        //          "nested": {
        //             "path": "offer",
        //             "filter": {       <——— so we don't sort by the wrong tag types
        //                "term" : { "offer.color" : "blue" } } } } }] }
        //
        val tagTypeQ: es.index.query.QueryBuilder =
              QueryBuilders.termQuery(
                  s"${PostDocFields.TagValsNested}.${ValFields.TagTypeId}", byTagVal.tagType.id)
        val nestedSortBuilder: es.search.sort.NestedSortBuilder =
              new es.search.sort.NestedSortBuilder(PostDocFields.TagValsNested)
                .setFilter(tagTypeQ)

        val valueFieldName = PostDocFields.TagValsNested + "." + ValFields.fieldNameFor(
              // Should always be defined — we [skip_sort_if_tag_type_cant_have_values].
              byTagVal.tagType.valueType getOrDie "TyE5MWSLUFP5")
        val sortBuilder: es_FieldSortBuilder =
              es.search.sort.SortBuilders.fieldSort(valueFieldName)
              .setNestedSort(nestedSortBuilder)
              .order(
                  if (byTagVal.asc) es.search.sort.SortOrder.ASC
                  else es.search.sort.SortOrder.DESC)
        sortBuilder

      case x =>
        die("TyESEUNIMPORD", s"Unimplemented sort order: $x")
    }

    // ----- Highlight matches

    val highlighter = new HighlightBuilder()
      .field(PostDocFields.ApprovedPlainText)
      // The first tags are used for better matches — but apparently the additional tags
      // are used by the Fast Vector Highlighter only, see:
      //   https://www.elastic.co/guide/en/elasticsearch/reference/master/search-request-highlighting.html#tags
      .preTags(!addMarkTagClasses ? "<mark>" |
        "<mark class='esHL1'>", "<mark class='esHL2'>", "<mark class='esHL3'>",
        "<mark class='esHL4'>", "<mark class='esHL5'>", "<mark class='esHL6'>",
        "<mark class='esHL7'>")
      .postTags("</mark>")
      // This escapes any <html> stuff in the text, and thus prevents XSS issues. [7YK24W]
      .encoder("html"); SECURITY; TESTS_MISSING

    // ----- Put it all together

    val requestBuilder: SearchRequestBuilder = elasticSearchClient.prepareSearch(IndexName)
      // QUERY_AND_FETCH returns setSize() results from each shards — therefore it's fast
      // (other smarter search types returns setSize() in total instead). Since we have
      // only one shard per site anyway, this search type is a good one?
      // But the docs says: """QUERY_AND_FETCH and DFS_QUERY_AND_FETCH, these
      // modes are internal optimizations and should not be specified explicitly
      // by users of the API"""
      // (https://www.elastic.co/guide/en/elasticsearch/client/java-api/master/java-search.html)
      // So just don't specify anything then.
      // Skip: .setSearchType(SearchType.QUERY_AND_FETCH)
      .setQuery(boolQuery)
      .highlighter(highlighter)
      .setFrom(anyOffset getOrElse 0) // Later, [use_search_results_cursor] instead.
      .setSize(BatchSize)       // num hits to return
      .setExplain(true)  // includes hit ranking
      .setRouting(siteId.toString)  // all data for this site is routed by siteId [4YK7CS2]

    sortBuilders foreach { b =>
      requestBuilder.addSort(b)
    }

    // ----- Send to ES

    val promise = Promise[immutable.Seq[SearchHit]]()

    requestBuilder.execute(new ActionListener[SearchResponse] {
      def onResponse(response: SearchResponse): Unit = {
        // (This isn't the actor's thread. This is some thread controlled by ElasticSearch.)
        import collection.JavaConverters._
        val hits = response.getHits.asScala.flatMap((elasticSearchHit: es.search.SearchHit) => {
          parseElasticSearchJsonDoc(elasticSearchHit) match {
            case Good(hit) => Some(hit)
            case Bad(errorMessage) =>
              logger.error(o"""Error when parsing search query result, query: $searchQuery
                   result: $errorMessage""")
              None
          }
        })
        promise.success(hits.toVector)
      }

      def onFailure(ex: Exception): Unit = {
        logger.error(o"""Error when searching, source: ${requestBuilder.toString}""", ex)
        promise.failure(ex)
      }
    })

    promise.future
  }

}


