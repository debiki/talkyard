/**
 * Copyright (C) 2013 Kaj Magnus Lindberg (born 1979)
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

package ed.server

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.dao.PageStuff
import org.elasticsearch.search.highlight.HighlightField
import org.{elasticsearch => es}
import debiki.ReactJson._
import play.api.libs.json._
import scala.collection.immutable


/** Full text search and faceted search.
  *
  * 1) There's just one index, for all sites. But each site is routed to just one
  * single ElasticSearch shard (possibly shared with other sites).
  * This is the "user data flow" in this video:
  * and called "shared index" in this doc:
  *  https://www.elastic.co/guide/en/elasticsearch/guide/current/user-based.html
  * excerpt: """[you might be] hosting a search engine for thousands of email forums.
  * Some forums may have a huge amount of traffic, but the majority of forums are
  * quite small. Dedicating an index with a single shard to a small forum is overkill
  * — a single shard could hold the data for many forums.
  *   What we need is a way to share resources across users, to give the impression
  * that each user has his own index without wasting resources on small users
  * """
  *
  * 2) There's a queue with stuff to index. And a single actor (across all servers) that
  * takes stuff from this queue and indexes it, every 10 seconds or so.
  *
  * Read this to understand why works in the way it does:
  *   https://www.elastic.co/blog/found-keeping-elasticsearch-in-sync: [30G23]
  *
  * """an Elasticsearch index is actually composed of multiple Lucene indexes.
  * Each Lucene index is in turn composed of multiple ‘segments’ inside of which
  * documents reside. Lucene segments are essentially immutable collections of
  * documents. Documents inside a segment may not be modified. When an update is made
  * to a document the old document is marked as deleted in its existing segment
  * and the new document is buffered and used to create a new segment. This results
  * in substantial costs for the modification of content since nothing can
  * be changed in-place. Further worsening the performance picture, all analyzers
  * must be re-run for documents whose values change, incurring potentially high
  * CPU utilization. It should also be noted that when the number of segments in
  * the index has grown excessively and/or the ratio of deleted documents in
  * a segment is high, multiple segments are merged into a new single segment by
  * copying documents out of old segments and into a new one, after which the old
  * segments are deleted. It is for these reasons that frequent updates should
  * be avoided"""
  *
  * And: "Marking Source Records is an Anti-Pattern" (also from link [30G23])
  * (i.e. adding an 'indexed_version' column to post3, for example).
  * because:
  * - reindexing everything = rewriting each post (gah!).
  * - mark as done = rewrite that post, bad if large
  * - couples ElasticSearch state with source datastore table
  * - costs more storage (one extra field for all posts, instead of only those in the queue)
  *
  * (If running embedded in the future:
  *  blog.trifork.com/2012/09/13/elasticsearch-beyond-big-data-running-elasticsearch-embedded/ )
  */
package object search {

  /** These are the languages ElasticSearch can index. See:
    *   https://www.elastic.co/guide/en/elasticsearch/reference/master/analysis-lang-analyzer.html
    *       #_configuring_language_analyzers
    */
  val SupportedLanguages = Vector(
    "arabic", "armenian", "basque", "brazilian", "bulgarian", "catalan", "cjk", "czech",
    "danish", "dutch", "english", "finnish", "french", "galician", "german", "greek",
    "hindi", "hungarian", "indonesian", "irish", "italian", "latvian", "lithuanian",
    "norwegian", "persian", "portuguese", "romanian", "russian", "sorani", "spanish",
    "swedish", "turkish", "thai")

  /** Include a version number in the index name. See:
    *  https://www.elastic.co/blog/changing-mapping-with-zero-downtime
    *
    * Include language, because: """A single predominant language per document requires
    * a relatively simple setup. Documents from different languages can be stored
    * in separate indices"""
    * See: https://www.elastic.co/guide/en/elasticsearch/guide/current/one-lang-docs.html
    * More: https://www.elastic.co/guide/en/elasticsearch/guide/current/language-intro.html
    *
    * For now, English only.
    */
  val IndexName = "all_english_v1"

  val PostDocType = "post"


  def makeElasticSearchIdFor(siteId: String, post: Post): String =
    makeElasticSearchIdFor(siteId, postId = post.uniqueId)

  def makeElasticSearchIdFor(siteId: String, postId: UniquePostId): String =
    s"$siteId:$postId"


  case class SearchHit(
    siteId: SiteId,
    pageId: PageId,
    postId: UniquePostId,
    postNr: PostNr,
    approvedRevisionNr: Int,
    approvedTextWithHighligtsHtml: immutable.Seq[String],
    currentRevisionNr: Int,
    unapprovedSource: Option[String])(
    private val underlying: es.search.SearchHit) {

    def score = underlying.score
  }


  case class PageAndHits(
    pageStuff: PageStuff,
    hitsByScoreDesc: immutable.Seq[SearchHit]) {
    def pageId = pageStuff.pageId
    def pageTitle = pageStuff.title
  }


  def makeElasticSearchJsonDocFor(siteId: SiteId, post: Post, categoryId: Option[CategoryId],
        tags: Set[TagLabel]): JsObject = {
    val Fields = PostDocFields
    val approvedPlainText = post.approvedHtmlSanitized.map(org.jsoup.Jsoup.parse(_).text())
    val json = Json.obj(
      Fields.SiteId -> siteId,
      Fields.PageId -> post.pageId,
      // JsonKeys.SectionPageId -> forum or blog page id,
      // JsonKeys.CategoryIds -> list of category ids
      // JsonKeys.TagIds -> list of tag ids
      Fields.PostId -> post.uniqueId,
      Fields.PostNr -> post.nr,
      Fields.PostType -> post.tyype.toInt,
      Fields.ApprovedRevisionNr -> post.approvedRevisionNr,
      Fields.ApprovedPlainText -> JsStringOrNull(approvedPlainText),
      Fields.CurrentRevisionNr -> post.currentRevisionNr,
      Fields.UnapprovedSource -> (
        if (post.isCurrentVersionApproved) JsNull else JsString(post.currentSource)),
      Fields.Tags -> JsArray(tags.toSeq.map(JsString)),
      Fields.CategoryId -> JsNumberOrNull(categoryId),
      Fields.CreatedAtUnixSeconds -> post.createdAtUnixSeconds)

    json
  }


  def parseElasticSearchJsonDoc(hit: es.search.SearchHit) = {
    val Fields = PostDocFields
    val jsonString = hit.getSourceAsString
    val json = play.api.libs.json.Json.parse(jsonString)
    val approvedTextWithHighligtsHtml = {
      hit.getHighlightFields.get(Fields.ApprovedPlainText) match {
        case null =>
          // Why no highlights? Oh well, just return the plain text then.
          val textUnsafe = (json \ Fields.ApprovedPlainText).as[String]
          SECURITY; TESTS_MISSING
          Vector(org.owasp.encoder.Encode.forHtmlContent(textUnsafe))
        case highlightField: HighlightField =>
          // Html already escaped. [7YK24W]
          val fragments = Option(highlightField.getFragments).map(_.toVector) getOrElse Nil
          fragments.map(_.toString)
      }
    }
    SearchHit(
      siteId = (json \ Fields.SiteId).as[SiteId],
      pageId = (json \ Fields.PageId).as[PageId],
      postId = (json \ Fields.PostId).as[UniquePostId],
      postNr = (json \ Fields.PostNr).as[PostNr],
      approvedRevisionNr = (json \ Fields.ApprovedRevisionNr).as[Int],
      approvedTextWithHighligtsHtml = approvedTextWithHighligtsHtml,
      currentRevisionNr = (json \ Fields.CurrentRevisionNr).as[Int],
      unapprovedSource = (json \ Fields.UnapprovedSource).asOpt[String])(
      underlying = hit)
  }


  object PostDocFields {
    val SiteId = "siteId"
    val PageId = "pageId"
    val PostId = "postId"
    val PostNr = "postNr"
    val PostType = "postType"
    val ApprovedRevisionNr = "approvedRevNr"
    val ApprovedPlainText = "approvedText"
    val CurrentRevisionNr = "currentRevNr"
    // Later: index plain text instead of markdown source.
    val UnapprovedSource = "unapprovedSource"
    val CreatedAtUnixSeconds = "createdAt"
    val Tags = "tags"
    val PageTags = "pageTags"  // later
    val CategoryId = "categoryId"
  }


  case class IndexSettingsAndMappings(language: String, shards: Int) {
    require(SupportedLanguages.contains(language), s"Unsupported language: $language [EsE5Y2K7]")

    // Later, for English & the most frequent languages: Change to 50 shards? because each site
    // is placed one shard only, so more shards –> smaller shards –> faster searches?
    // How make this work well both for 1) installations for single forum, single server, only
    // and for 2) many servers serving many 9999 forums? I guess config values will be needed.
    def indexSettingsString: String = i"""
      |number_of_shards: 5
      |number_of_replicas: 0
      |"""

    val typeString = """"type": "string""""
    val typeInteger = """"type": "integer""""
    val typeKeyword = """"type": "keyword""""
    val typeDate = """"type": "date""""
    val notIndexed = """"index": "no""""
    val notAnalyzed = """"index": "not_analyzed""""
    val formatEpochSeconds = """"format": "epoch_second""""
    def analyzerLanguage = s""""analyzer": "$language""""


    import PostDocFields._

    // - Don't analyze anything with the standard analyzer. It is good for most European
    //   language documents.
    // - A type: keyword field doesn't have any 'analyzer' property (instead, exact matches only).
    //
    def postMappingString: String = i"""{
      |"$PostDocType": {
      |  "_all": { "enabled": false  },
      |  "properties": {
      |    "$SiteId":                { $typeString,  $notAnalyzed },
      |    "$PageId":                { $typeString,  $notAnalyzed },
      |    "$PostId":                { $typeInteger, $notIndexed },
      |    "$PostNr":                { $typeInteger, $notIndexed },
      |    "$ApprovedRevisionNr":    { $typeInteger, $notIndexed },
      |    "$ApprovedPlainText":     { $typeString,  $analyzerLanguage },
      |    "$CurrentRevisionNr":     { $typeInteger, $notIndexed },
      |    "$UnapprovedSource":      { $typeString,  $analyzerLanguage },
      |    "$Tags":                  { $typeKeyword },
      |    "$CategoryId":            { $typeInteger, $notAnalyzed },
      |    "$CreatedAtUnixSeconds":  { $typeDate,    $formatEpochSeconds }
      |  }
      |}}
      |"""
  }


  // all built-in languages:
  // https://www.elastic.co/guide/en/elasticsearch/reference/master/analysis-lang-analyzer.html#analysis-lang-analyzer
  val Indexes = Seq[IndexSettingsAndMappings](
    IndexSettingsAndMappings(shards = 5, language = "english"))

}

