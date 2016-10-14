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

package ed.server.search

import collection.JavaConverters._
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.dao.SearchQuery
import org.elasticsearch.action.search.{SearchRequestBuilder, SearchResponse}
import org.elasticsearch.client.Client
import org.elasticsearch.index.query.QueryBuilders
import org.elasticsearch.search.highlight.HighlightBuilder
import org.elasticsearch.action.ActionListener
import org.{elasticsearch => es}
import play.{api => p}
import scala.collection.immutable
import scala.concurrent.{Future, Promise}


class SearchEngine(
  private val siteId: SiteId,
  private val elasticSearchClient: Client) {

  def search(searchQuery: SearchQuery, anyRootPageId: Option[String], user: Option[User])
        : Future[immutable.Seq[SearchHit]] = {

    if (searchQuery.isEmpty)
      return Future.successful(Nil)

    // For filter-by-category-id, see [4FYK85] below.
    val boolQuery = QueryBuilders.boolQuery()

    if (searchQuery.fullTextQuery.nonEmpty)
      boolQuery.must(
        // If is staff, could search unapproved html too, something like:
        // .setQuery(QueryBuilders.multiMatchQuery(phrase, "approvedHtml", "unapprovedSource"))
        // SECURITY ElasticSearch won't interpret any stuff in fullTextQuery as magic commands
        // and start doing weird things? E.g. do a "*whatever" regex search, enabling a DoS attack?
        QueryBuilders.matchQuery(PostDocFields.ApprovedPlainText, searchQuery.fullTextQuery))

    // Form submissions are private, currently for admins only. [5GDK02]
    if (!user.exists(_.isAdmin)) {
      boolQuery.mustNot(
        QueryBuilders.termQuery(PostDocFields.PostType, PostType.CompletedForm.toInt))
    }

    if (searchQuery.tagNames.nonEmpty) {
      boolQuery.must(
        QueryBuilders.termsQuery(
            PostDocFields.Tags, searchQuery.tagNames.asJava))
    }

    if (searchQuery.notTagNames.nonEmpty) {
      boolQuery.mustNot(
        QueryBuilders.termsQuery(
          PostDocFields.Tags, searchQuery.notTagNames.asJava))
    }

    if (searchQuery.categoryIds.nonEmpty) {
      boolQuery.filter(
        QueryBuilders.termsQuery(
            PostDocFields.CategoryId, searchQuery.categoryIds.asJava))
    }

    boolQuery.filter(
      QueryBuilders.termQuery(PostDocFields.SiteId, siteId))

    val highlighter = new HighlightBuilder()
      .field(PostDocFields.ApprovedPlainText)
      // The first tags are used for better matches — but apparently the additional tags
      // are used by the Fast Vector Highlighter only, see:
      //   https://www.elastic.co/guide/en/elasticsearch/reference/master/search-request-highlighting.html#tags
      .preTags("<mark class='esHL1'>", "<mark class='esHL2'>", "<mark class='esHL3'>",
        "<mark class='esHL4'>", "<mark class='esHL5'>", "<mark class='esHL6'>",
        "<mark class='esHL7'>")
      .postTags("</mark>")
      // This escapes any <html> stuff in the text, and thus prevents XSS issues. [7YK24W]
      .encoder("html"); SECURITY; TESTS_MISSING

    val requestBuilder: SearchRequestBuilder = elasticSearchClient.prepareSearch(IndexName)
      .setTypes(PostDocType)
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
      .setFrom(0)        // offset
      .setSize(60)       // num hits to return
      .setExplain(true)  // includes hit ranking
      .setRouting(siteId)  // all data for this site is routed by siteId [4YK7CS2]

    val promise = Promise[immutable.Seq[SearchHit]]()

    requestBuilder.execute(new ActionListener[SearchResponse] {
      def onResponse(response: SearchResponse) {
        // (This isn't the actor's thread. This is some thread controlled by ElasticSearch.)
        import collection.JavaConverters._
        val hits = response.getHits.asScala.map((hit: es.search.SearchHit) => {
          parseElasticSearchJsonDoc(hit)
        })
        promise.success(hits.toVector)
      }

      def onFailure(throwable: Throwable) {
        p.Logger.error(o"""Error when searching for: $boolQuery,
             search source: ${requestBuilder.toString}""", throwable)
        promise.failure(throwable)
      }
    })

    promise.future
  }

  /*

    Old code. Delete later, when highlights and category filtering work.  [4FYK85]

    // Filter by site id and perhaps section id.
    val siteIdFilter = eiq.FilterBuilders.termFilter(JsonKeys.SiteId, siteId)
    val filterToUse = anyRootPageId match {
      case None => siteIdFilter
      case Some(sectionId) =>
        val sectionIdFilter = eiq.FilterBuilders.termFilter(JsonKeys.SectionPageIds, sectionId)
        eiq.FilterBuilders.andFilter().add(siteIdFilter).add(sectionIdFilter)
    }

    // Full-text-search the most recently approved text, for each post.
    // (Don't search the current text, because it might not have been approved and isn't
    // shown, by default. Also, it might be stored in compact diff format, and is
    // not indexed, and thus really not searchable anyway.)
    val queryBuilder = eiq.QueryBuilders.queryString(phrase).field(LastApprovedTextField)

    val filteredQueryBuilder: eiq.FilteredQueryBuilder =
      eiq.QueryBuilders.filteredQuery(queryBuilder,  filterToUse)

    val searchRequestBuilder =
      elasticSearchClient.prepareSearch(indexName)
        .setRouting(siteId)
        .setQuery(filteredQueryBuilder)
        .addHighlightedField(LastApprovedTextField)
        .setHighlighterPreTags(HighlightPreMark)
        .setHighlighterPostTags(HighlightPostMark)

    val futureJavaResponse: ea.ListenableActionFuture[eas.SearchResponse] =
      searchRequestBuilder.execute()

    val resultPromise = Promise[FullTextSearchResult]

    futureJavaResponse.addListener(new ea.ActionListener[eas.SearchResponse] {
      def onResponse(response: eas.SearchResponse) {
        resultPromise.success(buildSearchResults(response))
      }
      def onFailure(t: Throwable) {
        resultPromise.failure(t)
      }
    })

    resultPromise.future
  }


  def debugUnindexPosts(pageAndPostNrs: PagePostNr*) {
    // Mark posts as unindexed in DW1_PAGE_ACTIONS before deleting them from
    // ElasticSearch, in case the server crashes.

    rememberPostsAreIndexed(indexedVersion = 0, pageAndPostNrs: _*)

    for (PagePostNr(pageId, postNr) <- pageAndPostNrs) {
      val id = elasticSearchIdFor(siteId, pageId = pageId, postNr = postNr)
      elasticSearchClient.prepareDelete(IndexName, PostMappingName, id)
        .setRouting(siteId)
        .execute()
        .actionGet()
    }
  }

  private def buildSearchResults(response: SearchResponse): FullTextSearchResult = {
    var pageIds = Set[PageId]()
    var authorIds = Set[String]()

    val jsonAndElasticSearchHits = for (hit: SearchHit <- response.getHits.getHits) yield {
      val jsonString = hit.getSourceAsString
      val json = play.api.libs.json.Json.parse(jsonString)
      val pageId = (json \ PageIdField).as[PageId]
      val authorId = (json \ UserIdField).as[String]
      pageIds += pageId
      authorIds += authorId
      (json, hit)
    }

    val pageMetaByPageId = loadPageMetasAsMap(pageIds.toList)
    // ... Could also load author names ...

    val hits = for ((json, hit) <- jsonAndElasticSearchHits) yield {
      val highlightField: HighlightField = hit.getHighlightFields.get(LastApprovedTextField)
      val htmlTextAndMarks: List[String] = highlightField.getFragments.toList.map(_.toString)
      val textAndMarks = htmlTextAndMarks.map(org.jsoup.Jsoup.parse(_).text())
      val textAndHtmlMarks = textAndMarks.map(
        _.replaceAllLiterally(HighlightPreMark, HighlightPreTag)
          .replaceAllLiterally(HighlightPostMark, HighlightPostTag))
      val post: Post = unimplemented("Search-engine-hitting-Post2 [DwE4JGU8]") // Post.fromJson(json)
      FullTextSearchHit(post, hit.getScore, safeHighlightsHtml = textAndHtmlMarks)
    }

    FullTextSearchResult(hits, pageMetaByPageId)
  }
  */

}


