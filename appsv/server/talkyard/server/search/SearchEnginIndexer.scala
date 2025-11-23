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
import akka.actor._
import com.debiki.core
import com.debiki.core._
import debiki.dao.SystemDao

import co.elastic.clients.{elasticsearch => es8}
import co.elastic.clients.transport.endpoints.{BooleanResponse => es8_BooleanResponse}
import es8._types.{ElasticsearchException => es8_ElasticsearchException}
/*
import org.elasticsearch.action.bulk.BulkResponse
import org.elasticsearch.action.ActionListener
import org.elasticsearch.action.index.{IndexRequestBuilder, IndexResponse}
import org.{elasticsearch => es}
*/
import scala.concurrent.duration._
import Prelude._
import talkyard.server.{TyLogger, TyLogging}
import talkyard.server.jobs.BackgroundJobsActor
//import org.elasticsearch.common.xcontent.XContentType
import org.postgresql.util.PSQLException
import java.io.IOException
import scala.concurrent.ExecutionContext



/** Periodically looks at the stuff-to-index queue, and indexes (some of) that stuff.
  * A single actor is used for this (just one, across all servers) so we can
  * avoid indexing stuff, or even the same thing, too frequently.
  * Because frequent updates should be avoided, see link [30G23] in package.scala.
  *
  * Would it make sense to index backlinks here too? [rebuild_reindex_posts]
  * Maybe can reindex whatever that's missing, e.g. full text search, tags,
  * mentions, or backlinks — look at each post in the queue, find out what's missing.
  * Because it's faster to look at each post just once, and reindex
  * everything at once, for that post, than to load and look at it, once per
  * index type?
  */
object SearchEngineIndexer extends TyLogging {

  def startNewActor(indexerBatchSize: Int, initialDelaySecs: i32, intervalSeconds: Int,
        executionContext: ExecutionContext,
        elasticSearchClient: es8.ElasticsearchClient,
        actorSystem: ActorSystem, systemDao: SystemDao)
        : ActorRef = {
    implicit val execCtx = executionContext
    val actorRef = actorSystem.actorOf(Props(
      new IndexingActor(indexerBatchSize, elasticSearchClient, systemDao)), name = s"IndexingActor")
    actorSystem.scheduler.scheduleWithFixedDelay(
        initialDelay = initialDelaySecs seconds, intervalSeconds seconds, actorRef, IndexStuff)
    actorRef
  }


  /** Waits for the ElasticSearch cluster to start. (Since I've specified 2 shards, it enters
    * yellow status only, not green status, since there's one ElasticSearch node only (not 2).)
    */
   def debugWaitUntilSearchEngineStarted(): Unit = {
    ??? /*
    import es.action.admin.cluster.{health => h}
    val response: h.ClusterHealthResponse =
      client.admin.cluster.prepareHealth().setWaitForYellowStatus().execute().actionGet()
    val green = response.getStatus == h.ClusterHealthStatus.GREEN
    val yellow = response.getStatus == h.ClusterHealthStatus.YELLOW
    if (!green && !yellow) {
      die("TyE74b0f3", s"Bad ElasticSearch status: ${response.getStatus}")
    }
    */
  }


  /** Waits until all pending index requests have been completed.
    * Intended for test suite code only.
    */
  def debugRefreshIndexes(): Unit = {
    /*
    Await.result(
      ask(indexingActorRef, ReplyWhenDoneIndexing)(Timeout(999 seconds)),
      atMost = 999 seconds)

    val refreshRequest = es.client.Requests.refreshRequest(IndexName)
    client.admin.indices.refresh(refreshRequest).actionGet()
    */
  }

}



case object IndexStuff
case object ReplyWhenDoneIndexing


class IndexingActor(
  private val batchSize: i32,
  private val client: es8.ElasticsearchClient,
  private val systemDao: SystemDao) extends BackgroundJobsActor("IndexActor") {

  val globals: debiki.Globals = systemDao.globals

  val indexCreator = new IndexCreator()
  val postsRecentlyIndexed = new java.util.concurrent.ConcurrentLinkedQueue[SiteIdAndPost]

  @volatile
  var doneCreatingIndexes: Bo = false

  def tryReceiveUnlessJobsPaused(message: Any): U = message match {
    case IndexStuff =>
      // BUG race condition. Could instead: 1) find out in which languages indexes are missing.
      // 2) insert into the index queue entries for stuff in those languages. 3) create indexes.
      // Edit 2023: ?? Why not create indexes first, once, on startup, and thereafter add stuff
      // to the index queue ?? Whatever, this `if` works too, avoids create-index noops:
      // (Except for once per startup if already exists.)
      if (!doneCreatingIndexes) {
        val newIndexes: Seq[IndexSettingsAndMappings] =
              indexCreator.createIndexesIfNeeded(client)
        BUG; COULD // fix in [ty_v2]? [search_hmm] What if, when starting the *very first* time,
        // the server crashes here?  Then, after restart, newIndexes would be empty,
        // and we wouldn't index everything.
        // Can be fixed by deleting the (empty) indexes, or, better, and as mentioned in
        // the comment above:  Insert into queues first, then create the indexes?
        // There are unique keys, so, if already done, nothing would happen.
        // However, once everything has been indexed, the queue would be empty again —
        // then, how do we know that everything has been indexed already? Maybe
        // ask ES for document counts, if >= 1, then, not starting for the 1st time?
        // (Or, if exporting & importing?)
        if (newIndexes.nonEmpty) {
          enqueueEverythingInLanguages(newIndexes.map(_.language).toSet)
        }

        // Too old indexes prevent newer major versions of ElasticSearch from starting.
        //indexCreator.deleteAnyOldIndex(OldIndexName, client)

        doneCreatingIndexes = true
      }
      deleteAlreadyIndexedPostsFromQueue()
      _addPendingPostsFromTimeRanges()
      loadAndIndexPendingPosts()
    case ReplyWhenDoneIndexing =>
      ???
      // If PostsToIndex.postsToIndexBySite.isEmpty, then: sender ! "Done indexing."
      // Else, somehow wait untily until isEmpty, then reply.
    case PoisonPill =>
      deleteAlreadyIndexedPostsFromQueue()
  }


  /** Adds all posts and pages in the specified languages to the (re)index queue.
    */
  def enqueueEverythingInLanguages(languages: Set[String]): Unit = {
    systemDao.addEverythingInLanguagesToIndexQueue(languages)
  }


  /** If there are time ranges in  job_queue_t  for which all posts should get reindexed,
    * this'll find the most recently created  posts in those time ranges, add those
    * posts to the queue, and decrease the ends of the time ranges.
    */
  private def _addPendingPostsFromTimeRanges(): U = {
    systemDao.addPendingPostsFromTimeRanges(
          // Let's add a few batches each time, so we don't need to run SQL queries so
          // often to find the next posts.  Not too fast, if testing — or
          // this e2e test:  reindex-sites.2br.f  TyTREINDEX3
          // would run into race conditions and become flappy. [dont_index_too_fast_if_testing]
          desiredQueueLen = batchSize * (if (!core.isDevOrTest) 4 else 1))
  }

  private def loadAndIndexPendingPosts(): Unit = {
    WOULD_OPTIMIZE // If there's more than X posts, can set the index
    // refresh_interval to -1, to avoid refreshes when indexing a lot.
    // And set it back to 1s (the default?) or 2s afterwards. See:
    // https://www.elastic.co/guide/en/elasticsearch/reference/8.17/indices-update-settings.html#bulk
    // But the default behavior is nice to bulk indexing already, see:
    // https://www.elastic.co/guide/en/elasticsearch/reference/8.17/index-modules.html#index-modules-settings
    val postsToIndex: PostsToIndex = systemDao.loadPostsToIndex(limit = batchSize)
    postsToIndex.postsToIndexBySite foreach { case (siteId: SiteId, posts: Seq[Post]) =>
      val (toUnindex, toIndex) = posts.partition(post => {
        // Later: COULD index also deleted and hidden posts, and make available to staff.
        // Or, better?: Store in two separate indexes [index_for_invisible].
        // Bit hacky: We [index_title_and_body_together], so, do unto the title,
        // what we do to the orig post.
        val relevantPost =
              if (!post.isTitle) post else {
                posts.find(otr => otr.pageId == post.pageId && otr.isOrigPost) getOrElse {
                  // Weird, we load them together. One missing, but why?
                  // logger.warn(... ?)
                  post
                }
              }
        val unindex = postsToIndex.isPageDeleted(siteId, relevantPost.pageId) ||
                        !relevantPost.isVisible
        unindex
      })
      _unindexPosts(siteId, toUnindex)
      _indexPosts(siteId, toIndex, postsToIndex)
    }
  }


  private def _indexPosts(siteId: SiteId, posts: Seq[Post], postsToIndex: PostsToIndex): Unit = {
    if (posts.isEmpty)
      return

    // Later: Use the bulk index API.
    posts foreach { post =>
      _indexPost(post, siteId, postsToIndex)
    }
  }


  private def _indexPost(post: Post, siteId: SiteId, postsToIndex: PostsToIndex): Unit = {
    if (post.isTitle) {
      // We'll index the title & body into one ElasticSearch doc, when we encounter
      // the body post (they're always loaded together).  [index_title_and_body_together]
      // But skip the title here, so won't index the (tilet + body) twice.
      COULD // debug warn if body not in postsToIndex list.
      return
    }

    val pagePostNr = s"page ${post.pageId} nr ${post.nr}"
    val pageMeta = postsToIndex.page(siteId, post.pageId) getOrElse {
      logger.warn(s"Not indexing siteid:postid $siteId:${post.id
            }, $pagePostNr — page gone, deleted?")
      return
    }
    val tags = postsToIndex.tags(siteId, post.id)
    val tags_old = postsToIndex.tags_old(siteId, post.id)

    val titlePostId: Opt[PostId] = postsToIndex.titleIdsBySitePageId.get(
          SitePageId(siteId, post.pageId))
    var anyTitlePost: Opt[Post] = None

    // [ElasticSearch_join_parent_id]
    val anyParentDocId: Opt[St] = titlePostId.map(makeElasticSearchIdFor(siteId, _))

    val (doc, docId) =
      if (post.nr == PageParts.BodyNr) {
        anyTitlePost = Some(
              titlePostId.flatMap(titleId =>
                    postsToIndex.postsToIndexBySite(siteId).find(_.id == titleId)) getOrElse {
                logger.warn(s"s$siteId: Not indexing title + body on page ${post.pageId
                      } — title post missing, only body post id ${post.id} found.")
                return
              })

        val doc = makeElasticSearchJsonDocFor(
              siteId, pageMeta, post, title = anyTitlePost, anyParentDocId, tags)
        val docId = makeElasticSearchIdFor(siteId, anyTitlePost.get)
        (doc, docId)
      }
      else {
        val doc = makeElasticSearchJsonDocFor(siteId, pageMeta, post, title = None, anyParentDocId, tags) // tags_old)
        val docId = makeElasticSearchIdFor(siteId, post)
        (doc, docId)
      }

    val input: java.io.Reader = new java.io.StringReader(doc.toString);

    val indexReq = new es8.core.IndexRequest.Builder()
          // Can use `waitFor(..)` when running e2e tests? So won't have to poll.  [es8_e2e]
          // .refresh(es8._types.Refresh.WaitFor)
          .index(IndexName)
          .id(docId)
          .withJson(input)
          .routing(siteId.toString)
          .build()

    // Synchronous. Might as well? Will work as some simple "back pressure".
    // (But we use async search *queries* thuogh.) [async_search]
    val response: es8.core.IndexResponse =
          try {
            client.index(indexReq)
          }
          catch {
            case ex: IOException =>
              logger.warn("IO error indexing [TyESIX_IXPO1]", ex)
              return
            case ex: es8_ElasticsearchException =>
              val prettyReason = ex.response().error().reason()
              logger.warn(o"""ElasticsearchException indexing docId: $docId site: $siteId,
                    error: $prettyReason [TyESIX_IXPO2]""", ex)
              return
          }

    postsRecentlyIndexed.add(SiteIdAndPost(siteId, post))

    // We [index_title_and_body_together] — don't forget to add the title post too here,
    // (if it got indexed) so it'll get removed from the job queue.
    anyTitlePost.foreach(ttl => postsRecentlyIndexed.add(SiteIdAndPost(siteId, ttl)))

    // logger.info("Indexed with version " + response.version());
    /*

    COULD_OPTIMIZE // ES has a bulk API: Could send many documents to index,
    // in one request.
    val requestBuilder: IndexRequestBuilder =
      client.prepareIndex(IndexName, "_doc", docId)
        //.opType(es.action.index.IndexRequest.OpType.CREATE)
        //.version(...)
        .setSource(doc.toString, XContentType.JSON)
        .setRouting(siteId.toString)  // we set this routing when searching too [4YK7CS2]

    requestBuilder.execute(new ActionListener[IndexResponse] {
      def onResponse(response: IndexResponse): Unit = {
        logger.debug(s"Indexed site:post $docId, $pagePostNr")
        // This isn't the actor's thread. This is some thread controlled by ElasticSearch.
        // So don't call systemDao.deleteFromIndexQueue(post, siteId) from here
        // — because then the index queue apparently gets updated by many threads
        // at the same time, causing serialization errors (SQL state 40001).
        // Instead, remember and delete later:
        postsRecentlyIndexed.add(SiteIdAndPost(siteId, post))
      }

      def onFailure(ex: Exception): Unit = {
        logger.error(i"Error when indexing siteId:postId $docId, $pagePostNr:", ex)
      }
    })
    */
  }


  private def deleteAlreadyIndexedPostsFromQueue(): Unit = {
    var sitePostIds = Vector[SiteIdAndPost]()
    while (!postsRecentlyIndexed.isEmpty) {
      sitePostIds +:= postsRecentlyIndexed.remove()
    }
    val postsBySiteId: Map[SiteId, ImmSeq[Post]] = sitePostIds.groupMap(_.siteId)(_.post)
    postsBySiteId foreach { case (siteId: SiteId, posts: ImmSeq[Post]) =>
      try {
        logger.debug(o"""s$siteId: Deleting ${posts.length} now indexed posts
              from the job queue... [TyMSIX_DELIXD]""")
        systemDao.deleteFromIndexQueue(posts, siteId)
      }
      catch {
        case ex: PSQLException if ex.getSQLState == "40001" =>  // [PGSERZERR]
          logger.error(
            o"""s$siteId: PostgreSQL serialization error when deleting
                ${posts.length} posts from index queue [TyESIX_40001RM]""", ex)
        case ex: Exception =>
          logger.error(
                s"s$siteId: Error when deleting ${posts.length
                } posts from index queue [TyESIX_5PKW20]", ex)
      }
    }
  }


  private def _unindexPosts(siteId: SiteId, posts: ImmSeq[Post]): U = {
    if (posts.isEmpty)
      return

    COULD_OPTIMIZE // Don't unindex once per site. Do all at once instead.

    val bulkOpsList = new java.util.ArrayList[es8.core.bulk.BulkOperation]()

    posts foreach { post =>
      val docId = makeElasticSearchIdFor(siteId, post)
      val deleteOp = new es8.core.bulk.DeleteOperation.Builder()
            .index(IndexName)
            .id(docId)
            .routing(siteId.toString)
            .build()
      val bulkOp = new es8.core.bulk.BulkOperation.Builder().delete(deleteOp).build()
      bulkOpsList.add(bulkOp)
    }

    val bulkDeleteReq = new es8.core.BulkRequest.Builder()
          // .refresh(es8._types.Refresh.WaitFor)  — could, if e2e tests  [es8_e2e]
          .operations(bulkOpsList)
          .build()

    val response: es8.core.BulkResponse =
          try {
            // Synchronous, ok. [async_search]
            client.bulk(bulkDeleteReq)
          }
          catch {
            case ex: IOException =>
              logger.error(s"s$siteId: IO error unindexing posts [TyESIX_UNIXPO1]", ex)
              return
            case ex: es8_ElasticsearchException =>
              val prettyReason = ex.response().error().reason()
              logger.error(o"""s$siteId: ElasticsearchException unindexing ${posts.length} posts:
                      $prettyReason [TyESIX_UNIXPO2]""", ex)
              return
          }

    logger.debug(s"""s$siteId: Unindexed ${posts.length} posts, deleting from
          job queue ... [TyMSIX_Y5KF0]""")
    systemDao.deleteFromIndexQueue(posts, siteId)

    /*
    val bulkRequestBuilder = client.prepareBulk()
    posts foreach { post =>
      val deleteRequestBuilder = client.prepareDelete(
        IndexName, "_doc", makeElasticSearchIdFor(siteId, post.id)).setRouting(siteId.toString)
      bulkRequestBuilder.add(deleteRequestBuilder)
    }

    bulkRequestBuilder.execute(new ActionListener[BulkResponse] {
      def onResponse(response: BulkResponse): Unit = {
        // (This isn't the actor's thread. This is some thread controlled by ElasticSearch.)
        if (response.hasFailures) {
          val theError = response.buildFailureMessage
          logger.error(o"""Unindexed ${posts.length} posts, but something went wrong:
               $theError [EsE4GKY2]""")
          COULD // analyze the response and delete from the index queue those that were
          // successfully unindexed.
        }
        else {
          logger.debug(s"Unindexed ${posts.length} posts [EsM2Y5KF0]")
          COULD_OPTIMIZE // batch delete
          posts.foreach(systemDao.deleteFromIndexQueue(_, siteId))
        }
      }

      def onFailure(ex: Exception): Unit = {
        logger.error(s"Error when bulk unindexing ${posts.length} posts [EsE5YK02]", ex)
      }
    })
    */
  }

}

/*  Old index settings:

  /** Settings for the currently one and only ElasticSearch index.
    *
    * Over allocate shards ("user based data flow", and in Debiki's case, each user is a website).
    * We'll use routing to direct all traffic for a certain site to a single shard always.
    *
    * About ElasticSearch's Snowball analyzer: "[it] uses the standard tokenizer,
    * with standard filter, lowercase filter, stop filter, and snowball filter",
    * see: http://www.elasticsearch.org/guide/reference/index-modules/analysis/snowball-analyzer/
    * Use such an analyzer, but add the html_strip char filter.
    */
  val IndexSettings = i"""
    |number_of_shards: 5 — change to 50? because each site = one shard only, smaller –> faster searches?
    |number_of_replicas: 1
    |analysis:
    |  analyzer:
    |    HtmlSnowball:
    |      type: custom
    |      tokenizer: standard
    |      filter: [standard, lowercase, stop, snowball]
    |      char_filter: [HtmlStrip]
    |  char_filter :
    |    HtmlStrip :
    |      type : html_strip
    |#     escaped_tags : [xxx, yyy]  -- what's this?
    |#     read_ahead : 1024        -- what's this?
    |"""


*/
