/**
 * Copyright (c) 2016–2026 Kaj Magnus Lindberg
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
import com.debiki.core._
import co.elastic.clients.{elasticsearch => es8}
import co.elastic.clients.transport.endpoints.{BooleanResponse => es8_BooleanResponse}
import es8._types.{ElasticsearchException => es8_ElasticsearchException}
import scala.util.control.NonFatal
import scala.collection.mutable
import talkyard.server.TyLogger
import java.io.IOException
import Prelude._
import org.scalactic.{Good, Or, Bad}



class IndexCreator {

  private val logger = TyLogger("IndexCreator");

  // This is just for writing better log messages.
  @volatile
  private var _numConnFails = 0
  private val _NumOkConnFails = 10

  @volatile
  private var _esHasStarted = false

  /** Returns all indexes that were created. Everything in the languages used in these
    * indexes should be (re)indexed.
    */
  def createIndexesIfNeeded(client: es8.ElasticsearchClient)
        : Seq[IndexSettingsAndMappings] Or ErrMsg = Good {
    Indexes filter { indexSettings =>
      val wasCreated = _createIndexIfNeeded(indexSettings, client) getOrIfBad { msg =>
        // Since there's currently [only_1_ix], this works:
        return Bad(msg)
      }
      wasCreated
    }
  }


  /** Returns Good(true) iff the index was created, false if it already exists.
    *
    * Returns Bad(info-message) if there's a problem, e.g. ElasticSearch not yet started.
    */
  private def _createIndexIfNeeded(indexSettings: IndexSettingsAndMappings,
        client: es8.ElasticsearchClient): Bo Or ErrMsg = {

    // Index already created?   (Synchronous, fine. Runs very infrequently.)
    // See: https://www.elastic.co/docs/api/doc/elasticsearch/v8/operation/operation-indices-exists
    val existsReq = es8.indices.ExistsRequest.of(_.index(IndexName))
    val existsResp: es8_BooleanResponse =
          try client.indices().exists(existsReq)
          catch {
            case ex: IOException =>
              // Let's log the cause so we can construct more precise error messages, but let's
              // log the original exception, `ex`, not the cause, because the orignal exception
              // will show both the exception ElasticSearch threw to us, and its cause.
              ex.getCause match {
                case _: java.net.UnknownHostException =>
                  // This happen if the ES container is stopped (or not created?).
                  val msg = o"""Can't find the 'search' container: UnknownHostException,
                              when checking if search index '$IndexName' exists"""
                  logger.warn(o"""$msg [TyESIX_CHKEXST0]""", ex)
                  return Bad(msg)

                case _: java.net.ConnectException =>
                  // This happen ES is offline, e.g. hasn't started yet.
                  val msg = o"""Connection to 'search' container refused, when checking" +
                              if search index '$IndexName' exists"""
                  _numConnFails += 1
                  if (_esHasStarted) {
                    logger.warn(s"ElasticSearch stopped working: $msg. [TyESIX_ESBROKE]")
                  }
                  else if (_numConnFails <= _NumOkConnFails) {
                    logger.info(s"ElasticSearch not yet started? ${msg
                            }. Probably fine. [TyMSIX_WAIT4ES]")
                  }
                  else {
                    logger.warn(o"""ElasticSearch should have started by now?
                                 $msg [TyESIX_CHKEXST0]""", ex)
                  }
                  return Bad(msg)

                // (`ex.getCause` is Java code, may be null)
                case _ =>
                  val msg = s"IO error checking if search index '$IndexName' exists"
                  logger.error(s"$msg [TyESIX_CHKEXST1]", ex)
                  return Bad(msg)
              }
            case ex: es8_ElasticsearchException =>
              val prettyReason = ex.response().error().reason()
              val msg = o"""ElasticsearchException checking if search index '$IndexName'
                            exists: $prettyReason"""
              logger.error(s"$msg [TyESIX_CHKEXST2]", ex)
              return Bad(msg)
          }

    _esHasStarted = true

    if (existsResp.value())
      return Good(false)

    this._doCreateIndex(indexSettings, client)
  }


  /** Returns Good(true) iff the index was created.
    *
    * Doesn't return Good(false) any more, instead Bad(error-message). Oh well.
    */
  private def _doCreateIndex(indexSettings: IndexSettingsAndMappings,
        client: es8.ElasticsearchClient): Bo Or ErrMsg = {

    val ixName = IndexName

    val mapper: co.elastic.clients.json.JsonpMapper = client._transport().jsonpMapper()

    // Deserialize JSON for indexes and mappings:

    val ixSettingsParser: jakarta.json.stream.JsonParser = mapper.jsonProvider().createParser(
          new java.io.StringReader(
                indexSettings.indexSettingsJsonString))

    val postMappingParser: jakarta.json.stream.JsonParser = mapper.jsonProvider().createParser(
          new java.io.StringReader(
                indexSettings.postMappingJsonString))

    // Later, add an index for searching usernames, bios, email adrs, too.  [fuzzy_user_search]
    //val patsMappingParser = ...

    val ixSettings = es8.indices.IndexSettings._DESERIALIZER.deserialize(
          ixSettingsParser, mapper)

    val postMappings = es8._types.mapping.TypeMapping._DESERIALIZER.deserialize(
          postMappingParser, mapper)

    // See: https://www.elastic.co/docs/api/doc/elasticsearch/v8/operation/operation-indices-create
    var builder = new es8.indices.CreateIndexRequest.Builder().index(ixName)
    builder = builder.settings(ixSettings)
    builder = builder.mappings(postMappings)

    val request: es8.indices.CreateIndexRequest = builder.build()

    val wasCreated = try {
      // (Synchronous, fine. Runs very infrequently.)
      val response: es8.indices.CreateIndexResponse =
            client.indices().create(request)

      val message = s"Created search index '$ixName' [TyMCRDSEIX]."
      if (response.acknowledged()) {
        logger.info(message)
      }
      else if (response.shardsAcknowledged()) {
        logger.info(o"""$message But the index mappings have not yet propagated
            to all nodes in the cluster [EsW6YKF24].""")
      }
      else {
        val msg = s"Timeout when creating index '$ixName', what happened?"
        logger.warn(s"$msg [TyESIX_CREA0]")
        // Better: Return false, retry later? But if then already exists,
        // *do* start reindexing everythign — because means it got cretated,
        // is empty.  [retry_create_ixs]
        // But do NOT return Bad(err) here, and without remembering that: The index *maybe*
        // got created — and that when we know for sure, we need to index everything
        // that should be in that index.
      }
      true
    }
    catch {
      case ex: es8_ElasticsearchException =>
        // This is an error, since ES is running (it replied to the indices.ExistsRequest).
        val prettyReason = ex.response().error().reason()
        val msg = o"ElasticsearchException creating search index '$ixName': $prettyReason"
        logger.error(s"$msg [TyESIX_CREA1]", ex)
        return Bad(msg)
      case NonFatal(error) =>
        val msg = s"Error creating search index '$ixName'"
        logger.error(s"$msg [TyESIX_CREA2]", error)
        return Bad(msg)
    }

    // This no longer needed. Index recreated, with updated mapping, as part of
    // migrating to ElasticSearch 9. — Let's keep, nice to review if need to do again.
    /*
    // Update the mapping: Include tags.  Ok to do many times (once each server startup).
    // See the [index_mapping_changelog].
    val putMappingReq = es.client.Requests.putMappingRequest(ixName)
          .`type`("_doc")
          .source(
              indexSettings.postMappingJsonStringNoDocType, XContentType.JSON)

    val mappingRequestOk_ignored = try {
      val response: es_AcknowledgedResponse =
            client.admin().indices().putMapping(putMappingReq).actionGet()
      val message = s"Updated search index mapping for '$ixName' [TyMSEMAPPINGUPD]."
      if (response.isAcknowledged) {
        logger.info(message)
      }
      else {
        logger.warn(o"""$message  But the index mappings have not yet propagated
            to all nodes in the cluster? [TyMSEMAPPIN0UPD]""")
      }
      // But it might not have changed. So don't reindex everything.
      true
    }
    catch {
      case NonFatal(error) =>
        // Continue anyway? What else to do, refuse to start?
        logger.error(s"Error updating search index mapping for '${ixName
              }' [TyEESUPDMAPNG]", error)
        false
    } */

    Good(wasCreated)
  }


  def deleteAnyOldIndex(indexName: St, client: es8.ElasticsearchClient): U = {
    // Right now there are no too old indexes. Everything recreated & reindexed
    // as part of migrating to ElasticSearch 9.  So this old ES 6 code not currently needed,
    // but let's keep, so can review, if we need to delete indexes again.
    /*
    val deleteIndexRequest: es_DeleteIndexRequest =
          es.client.Requests.deleteIndexRequest(indexName)

    try {
      val response: es_AcknowledgedResponse =
            client.admin().indices().delete(deleteIndexRequest).actionGet()
      val message = s"Deleted old search index '$indexName' [TyMDELDOLDIX]."
      if (response.isAcknowledged) {
        logger.info(message)
      }
      else {
        logger.warn(o"""$message  But not yet propagated to all nodes
              in the cluster? [TyWDELD0DNE3256].""")
      }
    }
    catch {
      case ex: org.elasticsearch.index.IndexNotFoundException =>
        logger.info(s"Old search index '$indexName' not present, fine. Exception message: ${
                  ex.getMessage()}  [TyM0OLDIX]")
      case NonFatal(error) =>
        // Continue anyway. If can't be deleted, might cause problems not now but much later,
        // if trying to major version upgrade ES.
        COULD; NOTIFY_ADMINS
        logger.error(s"Error deleting search index '$indexName' [TyEDELOLDIX]", error)
    }
    */
  }

}

