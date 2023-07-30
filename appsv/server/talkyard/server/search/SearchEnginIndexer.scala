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

import akka.actor._
import com.debiki.core._
import debiki.dao.SystemDao
import org.elasticsearch.action.bulk.BulkResponse
import org.elasticsearch.action.ActionListener
import org.elasticsearch.action.index.{IndexRequestBuilder, IndexResponse}
import org.{elasticsearch => es}
import scala.concurrent.duration._
import Prelude._
import talkyard.server.{TyLogger, TyLogging}
import talkyard.server.jobs.BackgroundJobsActor
import org.elasticsearch.common.xcontent.XContentType
import org.postgresql.util.PSQLException
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

  def startNewActor(indexerBatchSize: Int, intervalSeconds: Int,
        executionContext: ExecutionContext,
        elasticSearchClient: es.client.Client, actorSystem: ActorSystem, systemDao: SystemDao)
        : ActorRef = {
    implicit val execCtx = executionContext
    val actorRef = actorSystem.actorOf(Props(
      new IndexingActor(indexerBatchSize, elasticSearchClient, systemDao)), name = s"IndexingActor")
    actorSystem.scheduler.schedule(
        initialDelay = intervalSeconds seconds, intervalSeconds seconds, actorRef, IndexStuff)
    actorRef
  }


  /*
  /** The index can be deleted like so:  curl -XDELETE localhost:9200/sites_v0
    * But don't do that in any production environment of course.
    */
  def createIndexAndMappinigsIfAbsent() {
    import es.action.admin.indices.create.CreateIndexResponse

    val createIndexRequest = es.client.Requests.createIndexRequest(IndexName)
      .settings(IndexSettings)
      .mapping(PostMappingName, PostMappingDefinition)

    try {
      val response: CreateIndexResponse =
        client.admin().indices().create(createIndexRequest).actionGet()
      if (response.isAcknowledged)
        logger.info("Created ElasticSearch index and mapping.")
      else
        logger.warn("ElasticSearch index creation request not acknowledged? What does that mean?")
    }
    catch {
      case _: es.indices.IndexAlreadyExistsException =>
        logger.info("ElasticSearch index has already been created, fine.")
      case NonFatal(error) =>
        logger.warn("Error trying to create ElasticSearch index [DwE84dKf0]", error)
        throw error
    }
  }


  def debugDeleteIndexAndMappings() {
    val deleteRequest = es.client.Requests.deleteIndexRequest(IndexName)
    try {
      val response = client.admin.indices.delete(deleteRequest).actionGet()
      if (response.isAcknowledged)
        logger.info("Deleted the ElasticSearch index.")
      else
        logger.warn("ElasticSearch index deletion request not acknowledged? What does that mean?")
    }
    catch {
      case _: org.elasticsearch.indices.IndexMissingException => // ignore
      case NonFatal(ex) => logger.warn("Error deleting ElasticSearch index [DwE5Hf39]:", ex)
    }
  }
  */


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
  private val client: es.client.Client,
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
        BUG; COULD // fix in [ty_v1]? What if, when starting the *very first* time,
        // the server crashes here?  Then, after restart, newIndexes would be empty,
        // and we wouldn't index everything.
        // Can be fixed by deleting the (empty) indexes, or, better, and as mentioned in
        // the comment above:  Insert into queues first, then create the indexes?
        // There are unique keys, so, if already done, nothing would happen.
        // However, once everything has been indexed, the queue would be empty again —
        // then, how do we know that everything has been indexed already? Maybe
        // ask ES for document counts, if >= 1, then, not starting for the 1st time?
        // (Or, if exporting & importing?)
        enqueueEverythingInLanguages(newIndexes.map(_.language).toSet)
        doneCreatingIndexes = true
      }
      deleteAlreadyIndexedPostsFromQueue()
      loadAndIndexPendingPosts()
    case ReplyWhenDoneIndexing =>
      ???
      // If StuffToIndex.postsBySite.isEmpty, then: sender ! "Done indexing."
      // Else, somehow wait untily until isEmpty, then reply.
    case PoisonPill =>
      deleteAlreadyIndexedPostsFromQueue()
  }


  /** Adds all posts and pages in the specified languages to the (re)index queue.
    */
  def enqueueEverythingInLanguages(languages: Set[String]): Unit = {
    systemDao.addEverythingInLanguagesToIndexQueue(languages)
  }


  private def loadAndIndexPendingPosts(): Unit = {
    val stuffToIndex = systemDao.loadStuffToIndex(limit = batchSize)
    stuffToIndex.postsBySite foreach { case (siteId: SiteId, posts: Seq[Post]) =>
      val (toUnindex, toIndex) = posts.partition(post => {
        stuffToIndex.isPageDeleted(siteId, post.pageId) || !post.isVisible
      })
      unindexPosts(siteId, toUnindex)
      indexPosts(siteId, toIndex, stuffToIndex)
    }
  }


  private def indexPosts(siteId: SiteId, posts: Seq[Post], stuffToIndex: StuffToIndex): Unit = {
    if (posts.isEmpty)
      return

    // Later: Use the bulk index API.
    posts foreach { post =>
      indexPost(post, siteId, stuffToIndex)
    }
  }


  private def indexPost(post: Post, siteId: SiteId, stuffToIndex: StuffToIndex): Unit = {
    val pageMeta = stuffToIndex.page(siteId, post.pageId) getOrElse {
      logger.warn(s"Not indexing s:$siteId/p:${post.id} — page gone, was just deleted?")
      return
    }
    val tags = stuffToIndex.tags(siteId, post.id)
    val tags_old = stuffToIndex.tags_old(siteId, post.id)

    val doc = makeElasticSearchJsonDocFor(siteId, pageMeta, post, tags, tags_old)
    val docId = makeElasticSearchIdFor(siteId, post)

    COULD_OPTIMIZE // ES has a bulk API: Could send many documents to index,
    // in one request.
    val requestBuilder: IndexRequestBuilder =
      client.prepareIndex(IndexName, PostDocType, docId)
        //.opType(es.action.index.IndexRequest.OpType.CREATE)
        //.version(...)
        .setSource(doc.toString, XContentType.JSON)
        .setRouting(siteId.toString)  // we set this routing when searching too [4YK7CS2]

    requestBuilder.execute(new ActionListener[IndexResponse] {
      def onResponse(response: IndexResponse): Unit = {
        logger.debug("Indexed site:post " + docId)
        // This isn't the actor's thread. This is some thread controlled by ElasticSearch.
        // So don't call systemDao.deleteFromIndexQueue(post, siteId) from here
        // — because then the index queue apparently gets updated by many threads
        // at the same time, causing serialization errors (SQL state 40001).
        // Instead, remember and delete later:
        postsRecentlyIndexed.add(SiteIdAndPost(siteId, post))
      }

      def onFailure(ex: Exception): Unit = {
        logger.error(i"Error when indexing siteId:postId: $docId", ex)
      }
    })
  }


  private def deleteAlreadyIndexedPostsFromQueue(): Unit = {
    var sitePostIds = Vector[SiteIdAndPost]()
    while (!postsRecentlyIndexed.isEmpty) {
      sitePostIds +:= postsRecentlyIndexed.remove()
    }
    COULD_OPTIMIZE // batch delete all in one statement
    sitePostIds foreach { siteIdAndPost =>
      try systemDao.deleteFromIndexQueue(siteIdAndPost.post, siteIdAndPost.siteId)
      catch {
        case ex: PSQLException if ex.getSQLState == "40001" =>  // [PGSERZERR]
          logger.error(
            o"""PostgreSQL serialization error when deleting
                siteId:postId: $siteIdAndPost from index queue [EdE40001IQ]""", ex)
        case ex: Exception =>
          logger.error(
            s"error when deleting siteId:postId: $siteIdAndPost from index queue [EdE5PKW20]", ex)
      }
    }
  }


  private def unindexPosts(siteId: SiteId, posts: Seq[Post]): Unit = {
    if (posts.isEmpty)
      return

    COULD_OPTIMIZE // Don't unindex once per site. Do all at once instead.
    val bulkRequestBuilder = client.prepareBulk()
    posts foreach { post =>
      val deleteRequestBuilder = client.prepareDelete(
        IndexName, PostDocType, makeElasticSearchIdFor(siteId, post.id)).setRouting(siteId.toString)
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
