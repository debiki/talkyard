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

import scala.collection.Seq
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.dao.PageStuff
import debiki.dao.PageStuffDao.ExcerptLength
import co.elastic.clients.{elasticsearch => es8}
import co.elastic.clients.json.{JsonData => es8_JsonData}
import org.scalactic.{Bad, ErrorMessage, Good, Or}
import play.api.libs.json._
import scala.collection.{immutable => imm, mutable => mut}
import scala.collection.immutable
import scala.jdk.CollectionConverters._ // for `.asScala`
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

  /** For now, if a page has more than this number of comments, we won't reindex it.
    * It'd typically be a chat page. See [ix_big_pgs].
    */
  val ReindexLimit = 1000

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
    * Created using ElasticSearch version 9 or later.
    * Always English, for now.  [es_wrong_lang]
    *
    * Format: "posts_" + "es9" (ES version 9) + "_v1_" (the Talkyard epoch )
    *          + language code  + maybe [per_country_code_index]
    *
    * Include language, because: """A single predominant language per document requires
    * a relatively simple setup. Documents from different languages can be stored
    * in separate indices"""
    * See: https://www.elastic.co/guide/en/elasticsearch/guide/current/one-lang-docs.html
    * More: https://www.elastic.co/guide/en/elasticsearch/guide/current/language-intro.html
    *
    * Re country code: Gemini thinks a country code makes sense for Portuguese and Chinese:
    * ..._pt_br  and  ..._pt_pt  for Brazil and Portugal.
    * ..._zh_cn  and  ..._zh_tw  for China and Taiwan.
    * But Spanish is, thinks Gemini, pretty similar everywhere, so no need for "_es_mx"
    * for Mexico for example.
    * Better think more about this later! When adding multi langs & indexes.
    */
  val IndexName = "posts_es9_v1_en"

  // ?? Later, there might be more indexes, e.g. one for deleted posts (which can be
  // good to be able to search, but isn't usually done, no need for high performance). ??
  // [deleted_posts_ix]  [index_for_invisible]
  // ActivePostsIxName   = "posts_active_es6_v3_english"    // normal
  // HiddenPostsIxName   = "posts_inactive_es6_v3_english"  // e.g. not approved or flagged ??
  // DeletedPostsIxName  = "posts_deleted_es6_v3_english"

  // Later: [fuzzy_user_search]  Is one index for all pats enough? (Per lang maybe)
  // val PatsIndexNAme = "pats_es9_v1_en"


  def makeElasticSearchIdFor(siteId: SiteId, post: Post): String =
    makeElasticSearchIdFor(siteId, postId = post.id)

  def makeElasticSearchIdFor(siteId: SiteId, postId: PostId): String =
    s"$siteId:$postId"


  /** The search hits can be a bit out-of-date, and up-to-date stuff should be
    * fetched from the main db (Postgres) instead, when generating a search response
    * based on search hits.  E.g. double checking with the main db if a post
    * is really still accessible (mabye it got deleted, or authors &
    * assignees changed, and there's an entry in job_queue_t to reindex it).
    *
    * Later: Also incl more detailed info about what was hit, e.g. if a tag or
    * a tag value matched the search query. [show_hit_tags]
    *
    * @param approvedTitleHighligtsHtmlSafe Only for the orig post.
    *   We [index_title_and_body_together].
    */
  case class SearchHit(
    siteId: SiteId,
    pageId: PageId,
    postId: PostId,
    postNr: PostNr,
    approvedRevisionNr: Int,
    approvedTextNoHighligtsSafe: Opt[St],
    approvedTextHighligtsHtmlSafe: Opt[ImmSeq[St]],
    currentRevisionNr: Int,
    unapprovedSource: Option[String], // not in use? Later, for mods & oneself
    approvedTitleHighligtsHtmlSafe: Opt[immutable.Seq[String]])(
    private val underlying: es8.core.search.Hit[es8_JsonData]) {

    /** How good this hit is, compared to the other hits. Computed by ElasticSearch. */
    // def score: f32 = ??? // underlying.getScore
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

    // Dupl code [mk_tag_types_set]
    def tagTypeIds: Set[TagTypeId] = {
      val ids = mut.HashSet.empty[TagTypeId]
      UX; SHOULD // incl tags on comments too, not just the page?
      for (pageAndHits <- pagesAndHits; tag <- pageAndHits.pageStuff.pageTags) {
        ids.add(tag.tagTypeId)
      }
      ids.to(imm.Set)
    }
  }


  def makeElasticSearchJsonDocFor(siteId: SiteId, pageMeta: PageMeta,
          post: Post, title: Opt[Post], anyParentDocId: Opt[St], tags: imm.Seq[Tag]) // tags_old: Set[TagLabel])
          : JsObject = {
    // Sync with needs-reindex-or-not [ix_fields].
    val Fields = PostDocFields
    // Might be absent — unapproved posts are indexed too, for mods.  [ix_unappr]
    val approvedPlainText = post.approvedHtmlSanitized.map(org.jsoup.Jsoup.parse(_).text())
    var json = Json.obj(
      Fields.SiteId -> siteId,
      Fields.PageId -> post.pageId,
      Fields.PageType -> pageMeta.pageType.toInt,
      Fields.PageOpen -> pageMeta.isOpen,
      // JsonKeys.SectionPageId -> forum or blog page id,
      Fields.PostId -> post.id,
      Fields.PostNr -> post.nr,
      Fields.PostType -> (
          // Let's reuse postType to know what's a title, orig post or comment. [depr_post_type]
          // We index the title as part of the orig post, not separately.
          if (post.isTitle) die("TyEIX_TitlePostType")
          else if (post.isOrigPost) OrigPostType
          else post.tyype.toInt),
      Fields.PostJoin -> (
          // We index the title and orig post together into a Page "join doc" [es_page_join_doc],
          // when we encounter the orig post.  [index_title_and_body_together]
          // Comments are children of that parent "join doc".
          if (post.isOrigPost) {
            warnDevDieIf(anyParentDocId.isDefined, "TyEIX_ORIG_POST_PARENT_DOC",
                  s"s$siteId: anyParentDocId defined for title + OP, orig post id: ${post.id}")
            Json.obj("name" -> "Page")
          }
          else if (anyParentDocId.isEmpty) {
            // Can this happen? I forgot. Maybe for embedded comments discussions?
            JsNull
          }
          else {
            // This can be a comment, for example. We'll index it as a child doc.
            Json.obj("name" -> "Post", "parent" -> anyParentDocId.get)
          }),
      Fields.ApprovedRevisionNr -> post.approvedRevisionNr,
      Fields.ApprovedPlainText -> JsStringOrNull(approvedPlainText),
      Fields.CurrentRevisionNr -> post.currentRevisionNr,
      Fields.UnapprovedSource -> (  // [ix_unappr]
        if (post.isCurrentVersionApproved) JsNull else JsString(post.currentSource)),

      Fields.PageCatId -> JsNumberOrNull(pageMeta.categoryId),
      // Fields.AncCatIds_unused -> JsArray(ancestorCatIds),   [es_search_sub_cats]
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

    // ----- External ids

    val extIds = MutArrBuf[RefId]()
    post.extImpId.foreach(extIds.append)
    if (post.isOrigPost) {
      pageMeta.extImpId.foreach(extIds.append)
    }

    // [index_title_and_body_together]
    title foreach { ttl =>
      ttl.extImpId.foreach(extIds.append)
      // The title is plain text, not html, so we use the source fields. [title_plain_txt]
      // (But not post.approvedHtmlSanitized + Jsoup.)
      ttl.approvedSource foreach {
        json += Fields.ApprTitlePlainText -> JsString(_)
      }
      ttl.unapprovedSource foreach {
        json += Fields.UnapprTitlePlainText -> JsString(_)
      }
    }

    if (extIds.nonEmpty) {
      json += Fields.ExtIds -> JsArray(extIds.map(JsString))
    }

    // ----- Page statuses

    // Page type and open/closed were included above already.

    // To find *comments* on pages that are open or closed etc, or with certain tags,
    // Or is  PageSolved: false  totally uninteresting, can use  'is:open'  instead?
    // And add  PageSolved  only if is solved?
    if (pageMeta.pageType.canBeSolved) {
      json += Fields.PageSolved -> JsBoolean(pageMeta.answeredAt.isDefined)
    }

    // For all comments on the page, too. [page_statuses]
    // Later, maybe a per-comment doing-status too, for comments-that-are-tasks. [comment_tasks]
    // Or [index_on_page_only], not the child comments?
    if (pageMeta.pageType.hasDoingStatus) {
      json += Fields.PageDoingStatus -> JsNumber(pageMeta.doingStatus.toInt)
    }

    // Wait with this? [es_dont_ix_now]   Maybe better to index the whole embedding url,
    // for example.
    if (pageMeta.embeddingPageUrl.isDefined) {
      json += Fields.IsPageEmbedded -> JsTrue
    }
    /*
    if (..) HasAttachment -> JsTrue?  AttachmentSizeBytes -> JsNum...?
    */

    // ----- Post tags

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
        //      use ValFields.ValTxt instead, wich is of field type 'text',
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
          jOb += ValFields.ValKwd -> JsString(tag.valStr.get)
        }
        arrOfTagValObjs.append(jOb)
      }

      json += Fields.TagValsNested -> JsArray(arrOfTagValObjs)
    }

    json
  }


  def parseElasticSearchJsonDoc(esHit: es8.core.search.Hit[es8_JsonData])
          : SearchHit Or ErrorMessage = {
    val esJsonData: es8_JsonData = esHit.source()
    val jsonAny: jakarta.json.JsonValue = esJsonData.toJson()
    val json: jakarta.json.JsonObject =
          try jsonAny.asJsonObject()
          catch {
            case ex: ClassCastException =>
              return Bad(s"Search hit source is not a json obj, it is a: ${
                    jsonAny.getValueType}, look: ${jsonAny.toString.take(100)} [TySE_HIT0OBJ]")
          }

    // If you do: `SubmitRequest.Builder().explain(true)`, this'll contain
    // some debugging info explaining why this doc was returned & its score.
    //esHit.explanation()

    // Any matching tags and user badges? [show_hit_tags]
    // See: https://www.elastic.co/docs/reference/elasticsearch/rest-apis/retrieve-inner-hits
    // esHit.innerHits()

    val Fields = PostDocFields

    // If we searched for tags or categories, but no text, then, there's nothing
    // to highlight. Then we'll use the plain text of the post whose tags or category
    // matched.
    def approvedTextNoHighligtsSafe(): Opt[St] = Some {
          val textUnsafe: St = json.getString(Fields.ApprovedPlainText, "")
          if (textUnsafe.isEmpty)
            return None

          // If the text is long, not much point in returning all of it. Then it's better
          // to visit the page, and see the real thing instead of a long long plain text line.
          val excerptUnsafe =
                if (textUnsafe.length <= ExcerptLength + 10) textUnsafe
                else textUnsafe.take(ExcerptLength) + "..."

          SECURITY; TESTS_MISSING  // [safe_hit_highlights]
          org.owasp.encoder.Encode.forHtmlContent(excerptUnsafe)
        }

    val postNr = json.getInt(Fields.PostNr)

    def getHighlightedSafe(field: St): Opt[ImmSeq[St]] =
          Option(esHit.highlight().get(field)).map(_.asScala.to(Vec))

    // If we searched for "some words", ElasticSearch highlights any matches.
    // (For example, you search for "cute kittens". Then, highlightFields below
    // could be: ["a carrot for your <em>kittens</em>", "Everyone must eat
    // healthy food, <em>cute kittens<em> too"].)
    //
    // ElasticSearch has sanitized these. Maybe sanitize w Jsoup too?
    SECURITY; TESTS_MISSING // [safe_hit_highlights]
    val approvedTextHighligtsHtmlSafe = getHighlightedSafe(Fields.ApprovedPlainText)
    val approvedTitleHighligtsHtmlSafe = getHighlightedSafe(Fields.ApprTitlePlainText)

    try {
      val siteId = json.getInt(Fields.SiteId)
      Good(SearchHit(
            siteId = siteId,
            pageId = json.getString(Fields.PageId),
            postId = json.getInt(Fields.PostId),
            postNr = postNr,
            approvedRevisionNr = json.getInt(Fields.ApprovedRevisionNr),
            approvedTextNoHighligtsSafe =
                  // Only incl if nothing got highlighted.
                  if (approvedTextHighligtsHtmlSafe.isDefined) None
                  else approvedTextNoHighligtsSafe(),
            approvedTextHighligtsHtmlSafe = approvedTextHighligtsHtmlSafe,
            currentRevisionNr = json.getInt(Fields.CurrentRevisionNr),
            unapprovedSource = Opt(json.getString(Fields.UnapprovedSource, null)),
            approvedTitleHighligtsHtmlSafe = approvedTitleHighligtsHtmlSafe,
            )(underlying = esHit))
    }
    catch {
      case ex: Exception =>
        Bad(s"Error parsing search hit JSON: ${ex.toString}, search hit json: " + json)
    }
  }

  // Could alternatively index nesting depth, instead of post type, hmm. Maybe just 0 (title), 1 (op),
  // and 2 or nothing for everything else.
  val OrigPostType = -1

  object PostDocFields {
    val SiteId = "siteId"
    val PageId = "pageId"

    val PageType = "pageType"
    val PageOpen = "pageOpen"  // true/false  (false if any of:  closed, locked, frozen)
    val PageSolved = "pageSolved"  // true/false, for Questions and Problems
    val PageDoingStatus = "pageDoingStatus" // new -> planned -> started -> done
    val IsPageEmbedded = "pageEmbd"

    // If a comment is a solution to a question/problem.
    // 1 = yes, the accepted solution. 2 = yes, a secondary also good solution (can be many).
    // Absent means it's not currently marked as a solution.
    val SolutionStatus_unused = "solutionStatus"

    /* Maybe later? When comments can be tasks? [comment_tasks]
       The tree would be the comment and its descendants. And such a sub tree might
       have been done, or not yet done,  regardless of if the page itself is
       done or not, or maybe not even a task.
    val TreeOpen = "treeOpen"  // true/false  (false if any of:  closed, locked, frozen)
    val TreeDoingStatus = "treeDoingStatus"
     */

    val PostId = "postId"
    val PostNr = "postNr"
    val PostType = "postType" // currently can be stale [ix_post_type]
    val ExtIds = "extIds"
    val PostJoin = "postJoin" // [es_page_join_doc]
    /* Wait. [es_dont_ix_now]
    val HasAttachment = "hasAttachment"
    */

    // [dupl_es_fields] A bit duplicated fields. Could use two indexes instead: 1) approved
    // and not-deleted posts [index_for_invisible], another 2) for not-yet-approved or
    // has-been-deleted posts.
    val ApprTitlePlainText = "approvedTitle"
    val UnapprTitlePlainText = "unapprovedTitle"

    // For pages: The rev nr of the orig post, not the title.
    // (For comments: The rev nr of the comment, they have no titles.)
    val ApprovedRevisionNr = "approvedRevNr"

    // For pages: The text of the orig post — the title is in `this.ApprTitlePlainText`.
    // (For comments: The text of the comment.)
    val ApprovedPlainText = "approvedText"
    val CurrentRevisionNr = "curRevNr"
    val UnapprovedSource = "unapprovedSrc"
    val CreatedAt = "createdAt"  // stored as type: date, so no Ms or Sec suffix needed.
    val IsDeleted_unused = "isDeleted"  // true/false

    val OwnerIds_later = "ownerIds"
    val AuthorIds = "authorIds"
    val AssigneeIds = "assigneeIds"

    val TagTypeIds = "tagTypeIds"
    val TagValsNested = "tagValsNested"

    /* Maybe later — the page / article / orig post's tags. Or is  [allPageText] better?
    val PageAuthorIds = "pageAuthorIds"
    val PageTagTypeIds = "pageTagTypeIds"
    val PageTagValues = "tagValues" */

    /** The parent category of the page. */
    val PageCatId = "pageCatId"

    /** The parent category and all ancestor categories. [es_search_sub_cats]
      * Or skip? Is it better to send category ids for the whole sub tree of the
      * category one searches in?  In most cases I'd think so?  Unless *very* many?
      */
    val AncCatIds_unused = "ancCatIds"

    // -1 downranks the page. Useful if someone asked a question, there was a long
    // discussion and eventually a solution. Then a concise documentation page
    // with all the relevant things is written. Now, it can be helpful to downrank
    // the long discussion, so people find the much better documentation page, first.
    // Or maybe -2 or -3 if it's something really off-topic. Maybe an off-topic field
    // would be better? Or, rankTweak can be a catch-all reasons?
    val RankTweak_unused = "rankTweak"
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
    val ValKwd = "valKwd"
    val ValTxt = "valTxt"
    val ValVersion = "valVers"
    val ValDate = "valDate"
    val ValDateRange = "valDateRange"
    val ValGeoPoint = "valGeoPoint"  // for:  "type": "geo_point"
    val ValIpAdr = "valIpAdr"

    def fieldNameFor(valType: TypeValueType): St = valType match {
      case TypeValueType.Int32 => ValInt32
      case TypeValueType.Flt64 => ValFlt64
      case TypeValueType.StrKwd => ValKwd
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
    //
    // Let's sort by time — can be nice to be able to more quickly search & find
    // current discussions. Or in a data range.
    //
    def indexSettingsJsonString: St = /* [es_ix_settings] */ i"""{
      |"number_of_shards": 5,
      |"number_of_replicas": 0,
      |"sort.field": "${PostDocFields.CreatedAt}",
      |"sort.order": "desc"
      |}"""

    // See: https://www.elastic.co/guide/en/elasticsearch/reference/8.9/number.html
    val typeText = """"type": "text""""
    val typeBool = """"type": "boolean""""
    val typeByte = """"type": "byte""""
    val typeShort = """"type": "short""""
    val typeInteger = """"type": "integer""""
    val typeLong = """"type": "long""""
    val typeFloat = """"type": "float""""
    val typeDouble = """"type": "double""""
    val typeKeyword = """"type": "keyword""""
    // See: https://www.elastic.co/guide/en/elasticsearch/reference/8.17/version.html
    val typeVersion = """"type": "version""""
    val typeDate = """"type": "date""""
    val typeDateRange = """"type": "date_range""""
    // See: https://www.elastic.co/guide/en/elasticsearch/reference/8.17/geo-point.html
    val typeGeoPoint = """"type": "geo_point""""
    // See: https://www.elastic.co/guide/en/elasticsearch/reference/current/ip.html
    val typeIpAdr = """"type": "ip""""
    val typeNested = """"type": "nested""""
    val typeJoin = """"type": "join""""
    val indexed = """"index": true"""
    val notIndexed = """"index": false"""
    val dynamicFalse = """"dynamic": false"""
    val formatEpochSeconds = """"format": "epoch_second""""
    def analyzerLang = s""""analyzer": "$language""""

    // Makes the unified highlighter faster, see:
    // https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/index-options
    val ixOffsets = """"index_options": "offsets""""

    import PostDocFields._

    // - Don't analyze anything with the standard analyzer. It is good for most European
    //   language documents.
    // - A `type: keyword` field doesn't have any 'analyzer' property (instead,
    //   exact matches only).
    //
    // `dynamic: false`, because ElasticSearch otherwise usually guesses the *wrong*
    // mapping type, e.g. 'long' instead of 'keyword', which is annoying since the mapping
    // type cannot be changed later. (This setting is inherited to inner objects, so
    // probably the 2nd dynamicFalse below isn't needed.)
    // `false` gets inherited to all nested fields, that is, to everything, since
    // defined at the top level, here. See:
    // https://www.elastic.co/guide/en/elasticsearch/reference/8.17/dynamic.html#dynamic-inner-objects
    //
    def postMappingJsonString: St = i"""{
         |$dynamicFalse,
         |"properties": {
         |  $postMappingJsonStringContent
         |}}
         |"""

    /** Why nested docs, to store tag values?  See:
      * https://www.elastic.co/blog/great-mapping-refactoring#_nested_fields_for_each_data_type
      *
      * Why are ids mapped as keywords, not integers? [ids_as_kwd] — Because we don't do
      * range queries on ids, instead, we look up using term queries, and then, the
      * keyword type is faster. See:
      * https://www.elastic.co/guide/en/elasticsearch/reference/current/tune-for-search-speed.html#map-ids-as-keyword
      * But some fields that we don't use for searching anyway (post nr and id)
      * are stored as numbers anyway, that's a tiny bit more compact apparently.
      *
      * We store (most) enums as type keyword too, and as numbers. This takes little
      * storage space, and gives quick term queries. We typically don't currently do
      * ranqe queries on any enums. [enum_as_kwd]
      *
      * We use joins: The title and orig post together form the parent ElasticSearch doc,
      * and all comments are child docs. [es_page_join_doc] See:
      * https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/parent-join
      */
    private def postMappingJsonStringContent: St = i"""
      |    "$SiteId":                { $typeKeyword, $indexed ${/* [ids_as_kwd] */""}},
      |    "$PageId":                { $typeKeyword, $indexed },
      |    "$PageType":              { $typeKeyword, $indexed ${/* [enum_as_kwd] */""}},
      |    "$PageOpen":              { $typeBool,    $indexed },
      |    "$PageSolved":            { $typeBool,    $indexed },
      |    "$PageDoingStatus":       { $typeKeyword, $indexed },
      |    "$PostId":                { $typeInteger, $notIndexed ${/* in doc id already */""}},
      |    "$PostNr":                { $typeInteger, $notIndexed }, ${/*
      |    For the page, this'll be ext ids of the title post, orig post and page itself.
      |    (For a comment, it's any ext ids of the comment, of course.) */""}
      |    "$ExtIds":                { $typeKeyword, $indexed },
      |    "$PostType":              { $typeKeyword, $indexed },
      |    "$PostJoin": {
      |       $typeJoin,
      |       "relations": { "Page": ["Post"] },
      |       $indexed
      |    }, ${""/*
      |    // Let's wait with this. Maybe better to index the embedded url as type keyword,
      |    // and can then prefix-search for embedding pages, e.g. type:
      |    // "website/blog/2022/..." and find all embedded comments from 2022 (if the
      |    // website uses that format).  [es_dont_ix_now]  */}
      |    "$IsPageEmbedded":        { $typeBool,    $indexed }, ${""/*
      |    "$HasAttachment":         { $typeBool,    $indexed }, */}
      |    "$ApprovedRevisionNr":    { $typeInteger, $notIndexed },${""/*
      |    // index_options: offsets is appropriate here? So highlighting will be faster.
      |    // Any drawbacks? GitLab writes, https://gitlab.com/gitlab-org/gitlab/-/issues/28085:
      |    // """Use positions for index_options on fields that require highlighting.
      |    // This saves about ~33% index size.""" While 'docs' option if no
      |    // highlighting & good scoring needed, saves just ~2% index size (in their case).
      |    // But at GitLab, people fork each others' repositories, resulting in lots of
      |    // text to index many many times? Maybe 'offsets' is a problem for them, but
      |    // not for Ty? And, this is just *one* field out of many! So the overall
      |    // size increment, should be negligible.
      |    // Later, could add a 'suggest' subfield for autocomplete search of titles, e.g. typing
      |    // "kitt cu" would quickly match "cute kittens". See [es_autocomplete_titles] in wip/.
      |    "$ApprovedPlainText":     { $typeText,    $indexed, $analyzerLang, $ixOffsets },
      |    "$CurrentRevisionNr":     { $typeInteger, $notIndexed },
      |    "$UnapprovedSource":      { $typeText,    $indexed, $analyzerLang, $ixOffsets },${""/*
      |    // Let's store page title and orig post in same doc. [index_title_and_body_together]
      |    // Let's *not* have the title as a separate ElasticSearch document.
      |    // Especially now with Page-Post join field, it'd be confusing to
      |    // have both a title doc and an orig post doc — which one would
      |    // be the parent of the comments? (The title or the orig post as parent?)
      |    // WOULD_OPTIMIZE: Use `"copy_to": "titleAndText"`? [es_use_copy_to]  */}
      |    "$ApprTitlePlainText":    { $typeText,    $indexed, $analyzerLang, $ixOffsets },
      |    "$UnapprTitlePlainText":  { $typeText,    $indexed, $analyzerLang, $ixOffsets },
      |    "$IsDeleted_unused":      { $typeBool,    $indexed },
      |    "$OwnerIds_later":        { $typeKeyword, $indexed },
      |    "$AuthorIds":             { $typeKeyword, $indexed ${/* [ids_as_kwd] */""}},
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
      |          "${ValFields.ValKwd}":         { $typeKeyword, $indexed },
      |          "${ValFields.ValTxt}":         { $typeText,    $indexed, $analyzerLang },
      |          "${ValFields.ValVersion}":     { $typeVersion, $indexed },
      |          "${ValFields.ValDate}":        { $typeDate,    $indexed },
      |          "${ValFields.ValDateRange}":   { $typeDateRange, $indexed },
      |          "${ValFields.ValGeoPoint}":    { $typeGeoPoint, $indexed },
      |          "${ValFields.ValIpAdr}":       { $typeIpAdr,   $indexed }
      |       }${""/*
      |    Could also, if won't be that many tags with values — but wouldn't work
      |    with multitenancy? Because then all sites together can have many tag types
      |    with values.
      |    Few projects have > 200 tag types, see e.g. github.com/saltstack/salt/labels
      |    and  kubernetes/kubernetes/labels  — they have 264 and 201 labels
      |    but none of those labels can have any values (!).  So having a limit of
      |    at most say 100 or 200 tag types that can have values, per site,
      |    should be ok.
      |    And for self hosted sites, this'd be even more ok.
      |    But let's wait until ElasticSearch 9? Because although Lucene has already
      |    added support for sparse mappings (compressing "null" values so won't
      |    take much disk space), the LLM I asked says ElasticSearch still
      |    expands field values from all docs in-memory (when e.g. sorting on
      |    a specific field), which can require lots of RAM (if sorting on different
      |    fields). Maybe not a problem, but ... The current approach works
      |    ok too, for now.
      |    See:  https://www.elastic.co/guide/en/elasticsearch/reference/current/mapping-explosion.html
      |    and:  https://www.elastic.co/blog/found-crash-elasticsearch#mapping-explosion
      |          "this will require a disproportionate large amount of heap space"
      |          "even at idle status it is doing heavy garbage collection"
      |          "more than 30000 different fields ... struggling"
      |          "mapping is included in the cluster state that is broadcast to all nodes"
      |          "the index on disk is less than 7 MB"  <—— Lucene has optimized sparse mappings,
      |                                                     but ES has not, gets short of RAM.
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
      |          "type207_strTxt": { $typeText,    $indexed, analyzerLang },
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
      |     Let's wait:  [how_ix_page_tags]
      |    "$PageAuthorIds":         { $typeKeyword, $indexed },
      |    "$PageTagTypeIds":        { $typeKeyword, $indexed },
      |    "$PageTagValues":         { $typeNested,  $indexed },
      |     */}
      |    "$PageCatId":             { $typeKeyword, $indexed },${/*
      |    "$AncCatIds_unused":      { $typeKeyword, $indexed }, */""}
      |    "$CreatedAt":             { $typeDate,    $indexed,  $formatEpochSeconds },
      |    "$RankTweak_unused":      { $typeByte,    $indexed ${/* use Post.indexPrio? */""}}
      |"""


    // Later.  [fuzzy_user_search]
    // When adding more indexes, need to review index creation. [only_1_ix].

    def patMappingJsonString: St = i"""{
         |$dynamicFalse,
         |"properties": {
         |  $patMappingJsonStringContent
         |}}
         |"""

    private def patMappingJsonStringContent: St = i"""
      ...
      |""""
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
