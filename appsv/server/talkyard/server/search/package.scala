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

package talkyard.server

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.dao.PageStuff
import org.{elasticsearch => es}
import org.elasticsearch.search.fetch.subphase.highlight.HighlightField
import org.scalactic.{Bad, ErrorMessage, Good, Or}
import play.api.libs.json._
import scala.collection.{immutable => imm, mutable => mut}
import scala.collection.immutable
import talkyard.server.JsX._


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

  val BatchSize = 50

  /** These are the languages ElasticSearch can index. See:
    *   https://www.elastic.co/guide/en/elasticsearch/reference/master/analysis-lang-analyzer.html
    *       #_configuring_language_analyzers
    */
  val SupportedLanguages: Vec[St] = Vector(
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
  val OldIndexName = "all_english_v1"

  // Created using ES version 6.8.23.  Always English, for now.  [es_wrong_lang]
  val IndexName = "posts_es6_v2_english"


  def makeElasticSearchIdFor(siteId: SiteId, post: Post): String =
    makeElasticSearchIdFor(siteId, postId = post.id)

  def makeElasticSearchIdFor(siteId: SiteId, postId: PostId): String =
    s"$siteId:$postId"


  case class SearchHit(
    siteId: SiteId,
    pageId: PageId,
    postId: PostId,
    postNr: PostNr,
    approvedRevisionNr: Int,
    approvedTextWithHighligtsHtml: immutable.Seq[String],
    currentRevisionNr: Int,
    unapprovedSource: Option[String])(
    private val underlying: es.search.SearchHit) {

    def score: Float = underlying.getScore
  }


  case class PageAndHits(
    pageStuff: PageStuff,
    pagePath: PagePathWithId,
    hitPosts: imm.Seq[(SearchHit, Post)]) {
    def hitsByScoreDesc: imm.Seq[SearchHit] = hitPosts.map(_._1)
    def pageId: PageId = pageStuff.pageId
    def pageTitle: String = pageStuff.title
    def pageType: PageType = pageStuff.pageRole
  }


  /** The requester can see these pages (permission control has been done).
    */
  case class SearchResultsCanSee(
    pagesAndHits: Seq[PageAndHits],
    // catsCanSeeById: Map[..]  //  [search_results_extra_cat_lookup]  ?
    ) {

    def tagTypeIds: Set[TagTypeId] = {
      val ids = mut.HashSet.empty[TagTypeId]
      UX; SHOULD // incl tags on comments too, not just the page?
      for (pageAndHits <- pagesAndHits; tag <- pageAndHits.pageStuff.pageTags) {
        ids.add(tag.tagTypeId)
      }
      ids.to[imm.Set]
    }
  }


  def makeElasticSearchJsonDocFor(siteId: SiteId, pageMeta: PageMeta,
          post: Post, tags: imm.Seq[Tag], tags_old: Set[TagLabel])
          : JsObject = {
    val Fields = PostDocFields
    val approvedPlainText = post.approvedHtmlSanitized.map(org.jsoup.Jsoup.parse(_).text())
    var json = Json.obj(
      Fields.SiteId -> siteId,
      Fields.PageId -> post.pageId,
      Fields.PageType -> pageMeta.pageType.toInt,
      // JsonKeys.SectionPageId -> forum or blog page id,
      Fields.PostId -> post.id,
      Fields.PostNr -> post.nr,
      Fields.PostType -> post.tyype.toInt,
      Fields.ApprovedRevisionNr -> post.approvedRevisionNr,
      Fields.ApprovedPlainText -> JsStringOrNull(approvedPlainText),
      Fields.CurrentRevisionNr -> post.currentRevisionNr,
      Fields.UnapprovedSource -> (  // [ix_unappr]
        if (post.isCurrentVersionApproved) JsNull else JsString(post.currentSource)),

      Fields.ParentCatId -> JsNumberOrNull(pageMeta.categoryId),
      // Fields.AncCatIds_notInUse -> JsArray(ancestorCatIds),
      //          — needs to reindex if moving to other cat, ok? If throttling reindexing,
      //          & maybe doing with a bit lower prio, than indexing new stuff?

      // (We've told ES that the format is $formatEpochSeconds, in the index mapping.)
      Fields.CreatedAt -> post.createdAtUnixSeconds,

      Fields.AuthorIds -> Json.arr(post.createdById),
      Fields.AssigneeIds -> JsArray(post.assigneeIds.map(JsNumber(_))),
      //Fields.Tags -> JsArray(tags_old.toSeq.map(JsString)),
      Fields.TagTypeIds -> JsArray(tags.map(t => JsNumber(t.tagTypeId))),

      // Wait. Would need to reindex all comments, if a page tag is added  [how_ix_page_tags]
      // or author changed (once implemented).  [es_dont_ix_now]
      // Is it better to incl all comments texts in the orig post, in one single
      // [allPageText] field?
      // Fields.PageAuthorIds -> Json.arr(pageMeta.authorId),
      // Fields.PageTagTypeIds -> Json.arr(tags.map(_.tagTypeId)),
      // Fields.PageTagValues — "multiplied" by all comments!? Bad idea I suppose?
      )

    /* Wait with this? [es_dont_ix_now]   Maybe better to index the whole embedding url,
    // for example. Or indexing the nesting depth, instead of orig-post y/n?
    if (post.isOrigPost) {
      json += Fields.IsOp -> JsTrue
    }
    if (pageMeta.embeddingPageUrl.isDefined) {
      json += Fields.IsEmbedded -> JsTrue
    }
    if (..) HasAttachment -> JsTrue?  AttachmentSizeBytes -> JsNum...?
    */

    if (tags.exists(_.hasValue)) {
      val tagsWithValue = tags.filter(_.hasValue)
      val arrOfTagValObjs = MutArrBuf[JsObject]()

      for (tag <- tagsWithValue) {
        var jOb = Json.obj(ValFields.TagTypeId -> tag.tagTypeId)
        // MaybeValue._anyValueAndValueTypeErr would already have detected any value
        // field inconsistencies, so we can just add all values, for now.
        // Later, need to:  tag.valType match
        //   case TypeValueType.DateMins =>
        //      use ValFields.ValDate instead, wich is of field type 'date',
        //      instead of type 'integer'.
        //   case TypeValueType.StrTxt =>
        //      use ValFields.ValStrTxt instead, wich is of field type 'text',
        //      instead of type 'keyword'.
        //   cases ... e.g. date range,  location-lat-long,
        //      each use their own field of the appropriate ES field type.
        if (tag.valInt32.isDefined) {
          jOb += ValFields.ValInt32 -> JsNumber(tag.valInt32.get)
        }
        if (tag.valFlt64.isDefined) {
          jOb += ValFields.ValFlt64 -> JsNumber(tag.valFlt64.get)
        }
        if (tag.valStr.isDefined) {
          jOb += ValFields.ValStrKwd -> JsString(tag.valStr.get)
        }
        arrOfTagValObjs.append(jOb)
      }

      json += Fields.TagValsNested -> JsArray(arrOfTagValObjs)
    }

    json
  }


  def parseElasticSearchJsonDoc(hit: es.search.SearchHit): SearchHit Or ErrorMessage = {
    val Fields = PostDocFields
    val jsonString = hit.getSourceAsString
    val json = play.api.libs.json.Json.parse(jsonString)
    val approvedTextWithHighligtsHtml = {
      hit.getHighlightFields.get(Fields.ApprovedPlainText) match {
        case null =>
          // Why no highlights? Oh well, just return the plain text then.
          val textUnsafe = (json \ Fields.ApprovedPlainText).as[String]
          SECURITY; TESTS_MISSING  // Hmm. Use Jsoup to sanitize too just in case?
          Vector(org.owasp.encoder.Encode.forHtmlContent(textUnsafe))
        case highlightField: HighlightField =>
          // Html already escaped. [7YK24W]
          val fragments = Option(highlightField.getFragments).map(_.toVector) getOrElse Nil
          fragments.map(_.toString)
      }
    }
    try {
      val siteId = (json \ Fields.SiteId).get match {
        case x: JsString => x.value.toInt  // <— CLEAN_UP remove once I've reindexed edm & edc.
        case x: JsNumber => x.value.toInt
        case x => die("TyESESITEID", s"Bad site id: '$x', type: ${classNameOf(x)}")
      }
      Good(SearchHit(
        siteId = siteId,
        pageId = (json \ Fields.PageId).as[PageId],
        postId = (json \ Fields.PostId).as[PostId],
        postNr = (json \ Fields.PostNr).as[PostNr],
        approvedRevisionNr = (json \ Fields.ApprovedRevisionNr).as[Int],
        approvedTextWithHighligtsHtml = approvedTextWithHighligtsHtml,
        currentRevisionNr = (json \ Fields.CurrentRevisionNr).as[Int],
        unapprovedSource = (json \ Fields.UnapprovedSource).asOpt[String])(
        underlying = hit))
    }
    catch {
      case ex: Exception =>
        Bad(s"Error parsing search hit JSON: ${ex.toString}, search hit json: " + json)
    }
  }


  object PostDocFields {
    val SiteId = "siteId"
    val PageId = "pageId"
    val PageType = "pageType"
    val PostId = "postId"
    val PostNr = "postNr"
    val PostType = "postType"
    /* Wait. [es_dont_ix_now]
    val IsOp = "isOp"
    val IsEmbedded = "isEmb"
    val HasAttachment = "hasAttachment"
    */
    val ApprovedRevisionNr = "approvedRevNr"
    val ApprovedPlainText = "approvedText"
    val CurrentRevisionNr = "currentRevNr"
    val UnapprovedSource = "unapprovedSrc"
    val CreatedAt = "createdAt"  // stored as type: date, so no Ms or Sec suffix needed.

    val AuthorIds = "authorIds"
    val AssigneeIds = "assigneeIds"

    val TagTypeIds = "tagTypeIds"
    val TagValsNested = "tagValsNested"

    /* Maybe later — the page / article / orig post's tags. Or is  [allPageText] better?
    val PageAuthorIds = "pageAuthorIds"
    val PageTagTypeIds = "pageTagTypeIds"
    val PageTagValues = "tagValues" */

    /** The parent category. */
    val ParentCatId = "parentCatId"

    /** The parent category and all ancestor categories.
      * Or skip? Is it better to send category ids for the whole sub tree of the
      * category one searches in?  In most cases I'd think so?  Unless *very* many?
      */
    val AncCatIds_notInUse = "ancCatIds"
  }


  object ValFields {
    // One tag type field:
    val TagTypeId = "tagTypeId"

    // And one of these value fields:
    // (Later, possibly many, e.g. lat & long could use  valInt32 and valInt32b
    // hmm but no, instead,  there's a ES type:  geo_point,  so
    // the database fields  val_int32_c  and val_int32_b_c  would both be
    // combined into one valGeoPoint field:
    //    tagValsNested: [{ valType: TypeValueType.GeoPoint.toInt, valGeoPoint: ... }]
    // — generally, although Ty maybe needed many fields, ES needs just one, because
    // ES has many different & nice field types.
    // (ES complains if a single "value: ..." field was used to store values
    // of different types, e.g. an int32 in one doc, a text in another.  But by
    // appending the value type (e.g. int-32 or float-64) that problum won't happen.)
    val ValInt32 = "valInt32"
    val ValInt64 = "valInt64" // let's call it Int64 although js has only 53 "int bits"
    val ValFlt64 = "valFlt64"
    val ValStrKwd = "valStrKwd"
    val ValStrTxt = "valStrTxt"
    val ValDate = "valDate"
    val ValDateRange = "valDateRange"
    val ValGeoPoint = "valGeoPoint"  // for:  "type": "geo_point"

    def fieldNameFor(valType: TypeValueType): St = valType match {
      case TypeValueType.Int32 => ValInt32
      case TypeValueType.Flt64 => ValFlt64
      case TypeValueType.StrKwd => ValStrKwd
      case _ => unimpl(o"""Searching for tag values of type $valType hasn't been
                         implemented [TyEUNIMPLVALTYP]""")
    }
  }


  case class IndexSettingsAndMappings(language: String, shards: Int) {
    require(SupportedLanguages.contains(language), s"Unsupported language: $language [EsE5Y2K7]")

    // Later, for English & the most frequent languages: Change to 50 shards? because each site
    // is placed one shard only, so more shards –> smaller shards –> faster searches?
    // How make this work well both for 1) installations for single forum, single server, only
    // and for 2) many servers serving many 9999 forums? I guess config values will be needed.
    def indexSettingsJsonString: String = i"""{
      |"number_of_shards": 5,
      |"number_of_replicas": 0
      |}"""

    // See: https://www.elastic.co/guide/en/elasticsearch/reference/8.9/number.html
    val typeText = """"type": "text""""
    val typeBool = """"type": "boolean""""
    val typeShort = """"type": "short""""
    val typeInteger = """"type": "integer""""
    val typeLong = """"type": "long""""
    val typeFloat = """"type": "float""""
    val typeDouble = """"type": "double""""
    val typeKeyword = """"type": "keyword""""
    val typeDate = """"type": "date""""
    val typeDateRange = """"type": "date_range""""
    val typeGeoPoint = """"type": "geo_point""""
    val typeNested = """"type": "nested""""
    val indexed = """"index": true"""
    val notIndexed = """"index": false"""
    val dynamicFalse = """"dynamic": false"""
    val formatEpochSeconds = """"format": "epoch_second""""
    def analyzerLanguage = s""""analyzer": "$language""""


    import PostDocFields._

    // - Don't analyze anything with the standard analyzer. It is good for most European
    //   language documents.
    // - A type: keyword field doesn't have any 'analyzer' property (instead, exact matches only).
    //
    def postMappingJsonString: String = i"""{
      |"_doc": {
      |  "properties": {
      |    $postMappingJsonStringContent
      |  }
      |}}
      |"""

    // Dynamic: false, because ElasticSearch otherwise usually guesses the *wrong*
    // mapping type, e.g. 'long' instead of 'keyword', which is annoying since the mapping
    // type cannot be changed later. (This setting is inherited to inner objects, so
    // probably the 2nd dynamicFalse below isn't needed.)
    //
    def postMappingJsonStringNoDocType: St = i"""{
         |$dynamicFalse,
         |"properties": {
         |  $postMappingJsonStringContent
         |}}
         |"""

    /** Why nested docs, to store tag values?  See:
      * https://www.elastic.co/blog/great-mapping-refactoring#_nested_fields_for_each_data_type
      *
      * Why are ids mapped as keywords, not integers? — Because we don't do range
      * queries on ids, instead, we look up using term queries, and then, the
      * keyword type is faster. See:
      * https://www.elastic.co/guide/en/elasticsearch/reference/current/tune-for-search-speed.html#map-ids-as-keyword
      * But why aren't all ids mapped as keywords? Because I didn't know that was better,
      * back at that time (or maybe it wasn't, back at that time?).
      */
    private def postMappingJsonStringContent: St = i"""
      |    "$SiteId":                { $typeKeyword, $indexed },
      |    "$PageId":                { $typeKeyword, $indexed },
      |    "$PageType":              { $typeKeyword, $indexed },
      |    "$PostId":                { $typeKeyword, $notIndexed /* in doc id already */},
      |    "$PostNr":                { $typeInteger, $notIndexed /* or kwd? */ },
      |    "$PostType":              { $typeKeyword, $indexed },${""/*
      |    // Let's wait with this. Maybe better to index the embedded url as type keyword,
      |    // and can then prefix-search for embedding pages, e.g. type:
      |    // "website/blog/2022/..." and find all embedded comments from 2022 (if the
      |    // website uses that format).  [es_dont_ix_now]
      |    "$IsOp":                  { $typeBool,    $indexed },
      |    "$IsEmbedded":            { $typeBool,    $indexed },
      |    "$HasAttachment":         { $typeBool,    $indexed }, */}
      |    "$ApprovedRevisionNr":    { $typeInteger, $notIndexed },
      |    "$ApprovedPlainText":     { $typeText,    $indexed, $analyzerLanguage },
      |    "$CurrentRevisionNr":     { $typeInteger, $notIndexed },
      |    "$UnapprovedSource":      { $typeText,    $indexed, $analyzerLanguage },
      |    "$AuthorIds":             { $typeKeyword, $indexed },
      |    "$AssigneeIds":           { $typeKeyword, $indexed },
      |    "$TagTypeIds":            { $typeKeyword, $indexed },
      |    "$TagValsNested": {
      |       $typeNested,
      |       $dynamicFalse,
      |       "properties": {${""/*
      |           Always present: */}
      |          "${ValFields.TagTypeId}":      { $typeKeyword, $indexed },${""/*
      |           One of all the values below: */}
      |          "${ValFields.ValInt32}":       { $typeInteger, $indexed },
      |          "${ValFields.ValInt64}":       { $typeLong,    $indexed },
      |          "${ValFields.ValFlt64}":       { $typeDouble,  $indexed },${""/*
      |          Type 'keyword' is Ty's default. But sometimes indexing as 'text' is better? */}
      |          "${ValFields.ValStrKwd}":      { $typeKeyword, $indexed },
      |          "${ValFields.ValStrTxt}":      { $typeText,    $indexed, $analyzerLanguage },
      |          "${ValFields.ValDate}":        { $typeDate,    $indexed },
      |          "${ValFields.ValDateRange}":   { $typeDateRange, $indexed }
      |       }${""/*
      |    Could also, if won't be that many tags with values — but wouldn't work
      |    with multitenancy? Because then all sites together can have many tag types
      |    with values.
      |    Few projects have > 200 tag types, see e.g. github.com/saltstack/salt/labels
      |    and  kubernetes/kubernetes/labels  — they have 264 and 201 labels
      |    but none of those labels can have any values (!).  So having a limit of
      |    at most say 100 or 200 tag types that can have values, per site,
      |    should be ok.
      |    "$TagValuesObj":
      |       $dynamicFalse,
      |        "properties":
      |          "typeNNN_fieldType": { $typeInt/Float/Text...,  $indexed },
      |          // If type changed, we'd use fields with different suffixes,
      |          // for the same Talkyard type id prefix.  Otherwise, if the same
      |          // field name was used, ES would complains (if using the same
      |          // field for different data types).
      |          // e.g.:
      |          "type1_int32":    { $typeInteger, $indexed }, // same type id (1), but
      |          "type1_strKwd":   { $typeKeyword, $indexed }, // different field types
      |          "type4_int32":    { $typeInteger, $indexed },
      |          "type57_flt64":   { $typeDouble,  $indexed },
      |          "type207_strTxt": { $typeText,    $indexed, analyzerLanguage },
      |          "type207_int64":  { $typeLong,    $indexed },
      |          // COULD_OPTIMIZE: Start with the above tag-value-in-single-field
      |          // (instead of nested objects) approach, for a new site, and
      |          // if number-of-tags-with-values ever approaches the limit,
      |          // then, for that site, switch to the nested documents approach?
      |          // (Might need to reindex.)  Might even use the tags-in-fields
      |          // approach for the most commonly searched tags, and nested-doc-tags
      |          // for infrequently used tags? Getting complicated...
      |        */}
      |    },${""/*
      |     Or is it too bad for performance to repeat all page tag values,
      |     for *every comment* (!) on the page? — Maybe it'd be better to
      |     add an  [allPageText]  field to the OriginalPost?
      |     Let's wait:
      |    "$PageAuthorIds":         { $typeKeyword, $indexed },
      |    "$PageTagTypeIds":        { $typeKeyword, $indexed },
      |    "$PageTagValues":         { $typeNested,  $indexed },
      |     */}
      |    "$ParentCatId":           { $typeKeyword, $indexed /*
      |    "$AncCatIds_notInUse":    { $typeKeyword, $indexed }, */},
      |    "$CreatedAt":             { $typeDate,    $indexed,  $formatEpochSeconds }
      |"""
  }


  // all built-in languages:
  // https://www.elastic.co/guide/en/elasticsearch/reference/master/analysis-lang-analyzer.html#analysis-lang-analyzer
  val Indexes = Seq[IndexSettingsAndMappings](
    IndexSettingsAndMappings(shards = 5, language = "english"))

}

/*  Maybe nice to see how & when the index mappings have been updated?
    Here:   [index_mapping_changelog]:

    201x-??-??: Created the index, inital mapping.
    2023-08-04: Added:
                  - tag type id field, tag values
                  - anc cat ids
                  - page type,  is orig post,  author ids,  assignee ids

 */
