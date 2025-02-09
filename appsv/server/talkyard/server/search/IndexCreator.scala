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
import com.debiki.core._
import org.{elasticsearch => es}
import es.action.admin.indices.create.{CreateIndexRequest => es_CreateIndexRequest}
import es.action.admin.indices.delete.{DeleteIndexRequest => es_DeleteIndexRequest}
import org.elasticsearch.action.admin.indices.create.CreateIndexResponse
import es.action.support.master.{AcknowledgedResponse => es_AcknowledgedResponse}
import org.elasticsearch.common.xcontent.XContentType
import scala.util.control.NonFatal
import scala.collection.mutable
import talkyard.server.TyLogger
import Prelude._



class IndexCreator {

  private val languagesLogged = mutable.HashSet[String]()
  private val logger = TyLogger("IndexCreator");

  /** Returns all indexes that were created. Everything in the languages used in these
    * indexes should be (re)indexed.
    */
  def createIndexesIfNeeded(client: es.client.Client): Seq[IndexSettingsAndMappings] = {
    Indexes filter { indexSettings =>
      createIndexIfNeeded(indexSettings, client)
    }
  }


  /** Returns true iff the index was created.
    */
  def createIndexIfNeeded(indexSettings: IndexSettingsAndMappings, client: es.client.Client)
        : Boolean = {

    val ixName = IndexName

    SHOULD // use the same language as the site, when creating the index. [es_wrong_lang]

    // (Is there any way to specify `include_type_name=false`, for ES7 compat?)
    val createIndexRequest: es_CreateIndexRequest =
          es.client.Requests.createIndexRequest(ixName)
                .source(indexSettings.indexSettingsJsonString, XContentType.JSON)
                .mapping("_doc", indexSettings.postMappingJsonString, XContentType.JSON)

    // Attempt to create the index, synchronously, and see if there's any
    // it-already-exists exception.
    val wasCreated = try {
      val response: CreateIndexResponse =
        client.admin().indices().create(createIndexRequest).actionGet()
      val message = s"Created search index '$ixName' [TyMCRDSEIX]."
      if (response.isAcknowledged) {
        logger.info(message)
      }
      else {
        logger.warn(o"""$message But the index mappings have not yet propagated
            to all nodes in the cluster [EsW6YKF24].""")
      }
      true
    }
    catch {
      case ex: es.ResourceAlreadyExistsException =>
        if (!languagesLogged.contains(indexSettings.language)) {
          logger.info(o"""Search index '$ixName' already created, fine.
                  Exception message: ${ex.getMessage()}  [TyMIXCRDALRDY]""")
        }
        false
      case NonFatal(error) =>
        logger.error(s"Error creating search index '$ixName' [TyECRSEIX]", error)
        throw error
    }

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
    }

    languagesLogged.add(indexSettings.language)
    wasCreated
  }


  def deleteAnyOldIndex(indexName: St, client: es.client.Client): U = {
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
  }

}

