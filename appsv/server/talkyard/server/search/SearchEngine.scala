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
import scala.jdk.CollectionConverters._ // for `.asJava`
import com.debiki.core._
import com.debiki.core.Prelude._
import com.debiki.core.isDevOrTest
import co.elastic.clients.{elasticsearch => es8}
import co.elastic.clients.transport.endpoints.{BooleanResponse => es8_BooleanResponse}
import es8._types.{ElasticsearchException => es8_ElasticsearchException}
import es8._types.{query_dsl => es8_qs}
import co.elastic.clients.json.{JsonData => es8_JsonData}
import es8._types.{FieldValue => es8_FieldValue}
import org.scalactic.{Bad, Good}
import scala.collection.immutable
import scala.concurrent.{Future, Promise}
import talkyard.server.TyLogging
import java.{util => ju}
import java.util.concurrent.{CompletableFuture => j_CompletableFuture}


class SearchEngine(
  private val siteId: SiteId,
  //private val elasticSearchAsyncClient: es8.ElasticsearchAsyncClient,
  private val elasticSearchClient: es8.ElasticsearchClient,
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

    //  Also see:  https://stackoverflow.com/a/73621333  for an 8.0 Java query ex

    val boolBuilder = new co.elastic.clients.elasticsearch._types.query_dsl.BoolQuery.Builder()

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
      boolBuilder.must(
            // If is staff, could search unapproved html too. [index_for_invisible]
            es8_qs.MultiMatchQuery.of(q => q
                // We index the page title and orig post into the same ES doc, althoug
                // in Ty they're stored separately. [index_title_and_body_together]
                // (The title field is absent for all docs, e.g. all comments, except for
                // the title + orig post doc.)
                .fields(
                    PostDocFields.ApprTitlePlainText,
                    PostDocFields.ApprovedPlainText)
                .query(searchQuery.queryWithoutParams))._toQuery())
    }
    else {
      // Then maybe we're searching for tags, categories, is:idea/closed/solved/etc only,
      // but no free text search.
      // Let's return only orig posts and titles. We don't want 100 comments on a,
      // say, Idea page to generate 100 hits, if searching for "is:idea".
      boolBuilder.filter(
            es8_qs.TermQuery.of(q => q
                .field(PostDocFields.PostType)
                .value(OrigPostType))._toQuery())
    }

    // ----- Special

    // Form submissions are private, currently for admins only. [5GDK02]
    if (!user.exists(_.isAdmin)) {
      WOULD_OPTIMIZE // Use some flavor of  filterNot() instead, for performance. [filter_not]
      // Or use separate indexes for deleted and unapproved posts
      //    — and for form submissoins? [index_for_invisible]
      //
      // (Any matches are filtered out anyway, later.  [se_acs_chk])
      //
      // (ES 6:
      // Apparently  `"bool" { "filter" { "bool": { "must_not": ...` can work? But then,
      // would "must_not" contribute to scoring, and thus be slower? It normally does,
      // but it's wrapped in "filter" which does not.
      // See:  https://stackoverflow.com/a/41134914
      //        "How to implement elastic search not filter?"
      // What about ES 8?)
      boolBuilder.mustNot(
            es8_qs.TermQuery.of(q => q
                .field(PostDocFields.PostType)
                .value(PostType.CompletedForm.toInt))._toQuery())
    }

    // ----- Is:Something

    // For now,  "is:aa,bb,cc"  means only pages matching all of  aa, bb, cc   are found,
    // rather than any of   aa, bb or cc  — which is how  "tags:aa,bb,cc"  works though!
    // Change / fix later?  [es_match_all_or_any]

    searchQuery.isWhat.pageType foreach { pageType =>
      boolBuilder.filter(
            es8_qs.TermQuery.of(q => q
                .field(PostDocFields.PageType)
                .value(pageType.toInt))._toQuery())
    }

    searchQuery.isWhat.pageOpen foreach { isOpen =>
      boolBuilder.filter(
            es8_qs.TermQuery.of(q => q
                .field(PostDocFields.PageOpen)
                .value(isOpen))._toQuery())
    }

    searchQuery.isWhat.pageSolved foreach { isSolved =>
      boolBuilder.filter(
            es8_qs.TermQuery.of(q => q
                .field(PostDocFields.PageSolved)
                .value(isSolved))._toQuery())
    }

    searchQuery.isWhat.pageDoingStatus foreach { status =>
      boolBuilder.filter(
            es8_qs.TermQuery.of(q => q
                .field(PostDocFields.PageDoingStatus)
                .value(status.toInt))._toQuery())
    }

    // ----- Tags

    // Matching more tags is better, so, if many, use must(). But if just one,
    // use filter(). (Or does ES optimize this, itself?)  _must_if_many   [es_match_all_or_any]
    val useMustForTags = searchQuery.tagTypeIds.size + searchQuery.tagValComps.size >= 2

    if (searchQuery.tagTypeIds.nonEmpty) {
      val q = es8_qs.TermsQuery.of(q => q
                .field(
                    PostDocFields.TagTypeIds)
                .terms(es8_qs.TermsQueryField.of(t => t.value(
                    searchQuery.tagTypeIds
                        .to(Seq).map(es8_FieldValue.of).asJava))))._toQuery()
      if (useMustForTags)
        boolBuilder.must(q)
      else
        boolBuilder.filter(q)
    }

    if (searchQuery.notTagTypeIds.nonEmpty) {
      WOULD_OPTIMIZE // Use filterNot() [filter_not].
      boolBuilder.mustNot(
            es8_qs.TermsQuery.of(q => q
                .field(
                    PostDocFields.TagTypeIds)
                .terms(es8_qs.TermsQueryField.of(t => t.value(
                    searchQuery.notTagTypeIds
                        .to(Seq).map(es8_FieldValue.of).asJava))))._toQuery())
    }

    // ----- Authors

    if (searchQuery.authorIds.nonEmpty) {
      // _must_if_many
      val q = es8_qs.TermsQuery.of(q => q
                .field(
                    PostDocFields.AuthorIds)
                .terms(es8_qs.TermsQueryField.of(t => t.value(
                    searchQuery.authorIds
                        .to(Seq).map(es8_FieldValue.of).asJava))))._toQuery()
      if (searchQuery.authorIds.size >= 2)
        boolBuilder.must(q)
      else
        boolBuilder.filter(q)
    }

    // ----- Category

    BUG; SHOULD // This looks only at one exact cat, ignores sub & sub sub cats.
    // Probably should do a must query that lists all sub cats?  [es_search_sub_cats]
    // But that what we're doing already?? Just that `searchQuery.catIds` doesn't
    // include the sub cats?
    //
    // Or, no. I think it's better to add an ancestor categories field? Because there won't be
    // that many, at most 4 (if sub sub sub cats supported some day), (But there might be
    // really many tags.) Then, if moving a page to another cat, will need to reindex it
    // (incl all comments), but that's pretty ok? Need to reindex it if adding tags too,
    // and that's done much more often.
    //
    // However! Chat pages can have tens of thousands of comments. Are we going to
    // reindex all that, if ... moving the chat page's parent cat to somewhere else?
    // (If moving the chat page itself, we'd reindex all comments regardless.)
    // Maybe per site rate limiting of the indexer would be ok — then mods & admins can move
    // pages and categories however much they like, and they'll make search slightly
    // worse for their own sites only, if they do this too much.
    //
    if (searchQuery.catIds.nonEmpty) {
      // (Each page is in only one category, so it's pointless to use a must() query.)
      boolBuilder.filter(
            es8_qs.TermsQuery.of(q => q
                .field(
                    PostDocFields.PageCatId)
                .terms(es8_qs.TermsQueryField.of(t => t
                    .value(
                        searchQuery.catIds
                            .to(Seq).map(es8_FieldValue.of).asJava))))._toQuery())
    }

    // ----- Site

    boolBuilder.filter(
          es8_qs.TermQuery.of(q => q
              .field(PostDocFields.SiteId)
              .value(siteId))._toQuery())

    // ----- Tag values

    // We need one nested query, per tag value (right?) — since each one of them
    // is in its own nested doc.
    // ((filter() adds another nested query to the same list of filter queries as the
    // earlier filter queries, that is, the tag value queries end up in the same
    // filter-queries-list as the `siteId` and `catIds` queries.))
    for (tagValComp <- searchQuery.tagValComps) {
      // We'll consider only nested tag-value docs of the correct tag type.
      // For example, if the search query is:  "tags:kittens=123", we'll consider only
      // tags of [the tag type with name "kittens"].
      val tagType: TagType = tagValComp._1
      val tagTypeQ =
            es8_qs.TermQuery.of(q => q
                .field(s"${PostDocFields.TagValsNested}.${ValFields.TagTypeId}")
                .value(tagType.id))._toQuery()

      // Compare tag value, depending on the operator (e.g.  '=', '>', '>=').
      val compOpVal: CompOpVal = tagValComp._2

      // Find the _correct_value_field. We use type-specific field names (e.g. "valInt32",
      // "valFlt64", "valKwd") because ES requires a fixed data type per field.
      val valueFieldName = PostDocFields.TagValsNested + "." + ValFields.fieldNameFor(
            // Should always be defined — we [skip_tag_comps_if_tag_type_cant_have_values].
            tagType.valueType getOrDie "TyE5MWSLUFP4")

      // Our search query parser has picked a value type that matches the tag's value type.
      // F.ex., if the tag can have integer values (TagType.valueType == TypeValueType.Int32),
      // we've parsed "123" as a CompVal.Int32, not a CompVal.StrKwd.  [right_comp_val_type]
      val tagValQ: es8._types.query_dsl.Query = compOpVal.compOp match {
        case CompOp.Eq =>
          var q = new es8_qs.TermQuery.Builder()
                        .field(valueFieldName)
          q = compOpVal.compWith match {
            case CompVal.Int32(value) => q.value(value)
            case CompVal.Flt64(value) => q.value(value)
            case CompVal.StrKwd(value) => q.value(value)
            case x => die("TyESECOMPVAL01", s"Forgot to handle CompOp.Eq value type: $x")
          }
          q.build()._toQuery()

        case CompOp.Lt | CompOp.Gt | CompOp.Lte | CompOp.Gte =>
          // Minor combinatorial explosion! Since ES uses different builders
          // for numeric and text range queries. Could break out `compOp match ...` to
          // a template fn?
          // In fact, ES itself uses a template base class: `RangeQueryBase<T>`, and
          // `NumberRangeQuery extends RangeQueryBase<Double>`. — Hmm, so also in ES there's
          // a minor combinatorial explosion: they have NumberRangeQuery, TermRangeQuery,
          // DateRangeQuery, so I guess it's just fine and maybe unavoidable.
          compOpVal.compWith.valueAsFlt64.map((v: f64) => {
            // NumberRangeQuery wants f64 values.
            val q = new es8_qs.NumberRangeQuery.Builder().
                            field(valueFieldName)
            compOpVal.compOp match {
              case CompOp.Lt => q.lt(v)
              case CompOp.Gt => q.gt(v)
              case CompOp.Lte => q.lte(v)
              case CompOp.Gte => q.gte(v)
              case x => die("TyESECOMPSYMB02", s"Forgot to handle valueAsFlt64 comp op: $x")
            }
            q.build()._toRangeQuery()._toQuery()
          }).orElse(compOpVal.compWith.valueAsStr.map((v: St) => {
            // TermRangeQuery wants String values.
            val q = new es8_qs.TermRangeQuery.Builder().
                          field(valueFieldName)
            compOpVal.compOp match {
              case CompOp.Lt => q.lt(v)
              case CompOp.Gt => q.gt(v)
              case CompOp.Lte => q.lte(v)
              case CompOp.Gte => q.gte(v)
              case x => die("TyESECOMPSYMB08", s"Forgot to handle valueAsStr comp op: $x")
            }
            q.build()._toRangeQuery()._toQuery()
          })).getOrDie("TyE073SRKL8")

          // Later, this too:
          // compOpVal.compWith.valueAsDate + DateRangeQuery.

        case x =>
          die("TyESECOMPSYMB03", s"Forgot to handle comp op: $x")
      }

      val tagQ = es8_qs.NestedQuery.of(q => q
            // Path to the nested docs with e.g.:  { tagTypeId: ... valInt32:... }
            .path(PostDocFields.TagValsNested)
            .query(
                  es8_qs.BoolQuery.of(q => q
                      .filter(tagTypeQ)  // right type of tag? (the tag name)
                      .filter(tagValQ)   // tag value matches value in query?
                  )._toQuery())
            // Should a tag have *many* numeric values (they don't), use the average.
            .scoreMode(es8._types.query_dsl.ChildScoreMode.Avg))._toQuery()

      if (useMustForTags)
        boolBuilder.must(tagQ)
      else
        boolBuilder.filter(tagQ)
    }

    // ----- Sort order

    // Docs: https://www.elastic.co/guide/en/elasticsearch/reference/8.17/sort-search-results.html#nested-sorting

    val anySortOpts = searchQuery.sortOrder map {
      case byTagVal: SortHitsBy.TagVal =>
        // Consider only tags of the correct type (when sorting by tag value).
        // For example, if the search query is:  "tags:size:desc", then consider only tags
        // of the tag type named "size".
        //
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
        val tagTypeQ =
              es8_qs.TermQuery.of(q => q
                  .field(s"${PostDocFields.TagValsNested}.${ValFields.TagTypeId}")
                  .value(byTagVal.tagType.id))._toQuery()

        // Pick the _correct_value_field.
        val valueFieldName = PostDocFields.TagValsNested + "." + ValFields.fieldNameFor(
              // Should always be defined — we [skip_sort_if_tag_type_cant_have_values].
              byTagVal.tagType.valueType getOrDie "TyE5MWSLUFP5")

        // ((Couldn't ES realize that this is a sort-by-nested-doc-field, by looking at
        // `valueFieldName` and notice that it starts w PostDocFields.TagValsNested
        // which is a nested document? So, must be a nested doc field sort? — Then there
        // wouldn't be a need for ES' `es8._types.NestedSortValue` class? ES would already
        // know it's a nested doc field sort?))
        //
        val filterNestedTagType = es8._types.NestedSortValue.of(_
              .path(PostDocFields.TagValsNested)
              .filter(tagTypeQ))

        val fieldSort =  es8._types.FieldSort.of(_
              .field(valueFieldName)
              .order(
                  if (byTagVal.asc) es8._types.SortOrder.Asc
                  else es8._types.SortOrder.Desc)
              // .mode() — avg is the default?
              .nested(filterNestedTagType))

        val sortOpts = es8._types.SortOptions.of(_
              .field(fieldSort))

        sortOpts

      case x =>
        die("TyESEUNIMPORD", s"Unimplemented sort order: $x")
    }

    // ----- Highlight matches

    // See: https://www.elastic.co/guide/en/elasticsearch/reference/current/highlighting.html#highlighting-settings

    val highlight = es8.core.search.Highlight.of(_
          .fields(
              PostDocFields.ApprovedPlainText,
              // No special settings.
              es8.core.search.HighlightField.of(identity))
          .fields(
              PostDocFields.ApprTitlePlainText,
              es8.core.search.HighlightField.of(identity))
          // -------
          // Highlighting.
          // ElasticSearch uses <em> to highlight hits, by default. Let's change to <mark>,
          // better, semantically? [es_highlight_mark]
          // See: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/mark.
          //
          // The first tags are used for better matches — but apparently the additional tags
          // are used by the Fast Vector Highlighter (FVH) only
          // see: https://www.elastic.co/guide/en/elasticsearch/reference/current/highlighting.html#highlighting-settings
          // So, specify just "<mark>" once since don't use the FVH.
          .preTags("<mark>") /* !addMarkTagClasses ? ... |
                "<mark class='esHL1'>", "<mark class='esHL2'>", "<mark class='esHL3'>",
                "<mark class='esHL4'>", "<mark class='esHL5'>", "<mark class='esHL6'>",
                "<mark class='esHL7'>")) */
          .postTags("</mark>") // , "</mark>", "</mark>", "</mark>", "</mark>", "</mark>", "</mark>")
          // This'd be '<em class="hlt1">', but <mark> is better.
          //.tagsSchema(es8.core.search.HighlighterTagsSchema.Styled)  <— alternative way?
          // -------
          //
          // This html-escapes the snippet text, and then insert the highlighting tags,
          // thus prevents XSS issues. SECURITY; TESTS_MISSING [safe_hit_highlights]
          .encoder(es8.core.search.HighlighterEncoder.Html))

    // ----- Put it all together

    //r searchReqBuilder = new es8.async_search.SubmitRequest.Builder() // [ES8_async]
    var searchReqBuilder = new es8.core.SearchRequest.Builder()
          .index(IndexName)
          .routing(siteId.toString)  // also when indexing [4YK7CS2]
          .query(boolBuilder.build()._toQuery())
          // Results in a _weird_type_error: "type mismatch;\n found: Any \n required: Integer"
          // .from(anyOffset.getOrElse(0))
          .size(BatchSize)       // num hits to return
          .explain(isDevOrTest)  // includes hit ranking
          .highlight(highlight)

    anySortOpts foreach { opts =>
      searchReqBuilder = searchReqBuilder.sort(opts)
    }

    // Work around the above _weird_type_error.
    // Later, [use_search_results_cursor] instead.
    anyOffset foreach { ofs: Int =>
      searchReqBuilder = searchReqBuilder.from(ofs)
    }

    val searchReq: es8.core.SearchRequest = searchReqBuilder.build()

    // ----- Send to ES

    val promise = Promise[immutable.Seq[SearchHit]]()

    // Bit hacky — had to port from the ES 8 async API to the sync API.
    try {
      // Synchronous execution - this call blocks until a response is received
      val response: es8.core.SearchResponse[es8_JsonData] =
            elasticSearchClient.search(searchReq, classOf[es8_JsonData])
      _handleResponse(response, null, searchQuery.fullTextQuery, searchReq, promise)
    } catch {
      case ex: Exception =>
        _handleResponse(null, ex, searchQuery.fullTextQuery, searchReq, promise)
    }

    /*---- [ES8_async] ----------------------------
    val asyncResp: j_CompletableFuture[es8.async_search.SubmitResponse[es8_JsonData]] =
          // es8.async_search.SubmitResponse[es8_JsonData]  — if sync client and asyncSearch()
          elasticSearchAsyncClient.asyncSearch()
                .submit(searchReq, classOf[es8_JsonData])

    asyncResp.whenComplete((asyncResponseOrNull, exOrNull) =>
          this._handleResponse(asyncResponseOrNull, exOrNull, searchQuery.fullTextQuery,
                searchReq, promise))
    ---------------------------------------------*/

    promise.future
  }

  private def _handleResponse(
           responseOrNull: es8.core.SearchResponse[es8_JsonData],
           exOrNull: Throwable,
           rawQuery: St,
           searchReq: es8.core.SearchRequest,
           promise: Promise[immutable.Seq[SearchHit]]): U = {

    /*---- [ES8_async] ----------------------------
            asyncResponseOrNull: es8.async_search.SubmitResponse[es8_JsonData],
            exOrNull: Throwable,
            rawQuery: St,
            searchReq: es8.async_search.SubmitRequest,
            promise: Promise[immutable.Seq[SearchHit]]): U = {
    // (This is a different thread, controlled by ElasticSearch. [async_search])
    ---------------------------------------------*/

    if (exOrNull != null) {
      // Will this be json?
      logger.error(s"Error when searching, source: ${searchReq.toString} [TyESE_EX]", exOrNull)
      promise.failure(exOrNull)
      return
    }

    /*---- [ES8_async] ----------------------------
    // Shouldn't happen. Either an exception, or a response — we're in `whenComplete()`.
    if (asyncResponseOrNull == null) {
      logger.error(o"""Got nothing from ElasticSearch: No exception, no response,
             when searching for: ${searchReq.toString}  [TyESE_0EX0RES]""")
      promise.failure(new com.debiki.core.QuickMessageException(
            "No response from ElasticSearch [TyESE_0EX0RES2]"))
      return
    }

    val asyncResp = asyncResponseOrNull // not null

    if (asyncResp.isPartial()) {
      // Query still running on some shards (response.isRunning()),
      // or it failed on some shards (!response.isRunning()).
      UX; COULD // show a tips on the search results page? But this basically doesn't happen?
    }

    if (asyncResp.isRunning()) {
      // Query still running. `response.isPartial()` always true.
    }

    val searchResp: es8.async_search.AsyncSearch[es8_JsonData] = asyncResp.response()
    ---------------------------------------------*/

    val searchResp: es8.core.SearchResponse[es8_JsonData] = responseOrNull
    val hitsMetadata: es8.core.search.HitsMetadata[es8_JsonData] = searchResp.hits()
    val hitsList: ju.List[es8.core.search.Hit[es8_JsonData]] = hitsMetadata.hits()

    val results = MutArrBuf[SearchHit]()

    hitsList.forEach((esHit: es8.core.search.Hit[es8_JsonData]) => {
      parseElasticSearchJsonDoc(esHit) match {
        case Good(hit) =>
          results.append(hit)
        case Bad(errorMessage) =>
          logger.error(o"""Error when parsing search query result, query: ``$rawQuery'',
                result: $errorMessage [TyESE_PARSHIT]""")
      }
    })

    promise.success(results.toVector)
  }

}


