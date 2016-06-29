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

import com.debiki.core._
import org.elasticsearch.action.admin.indices.create.CreateIndexResponse
import org.elasticsearch.indices.IndexAlreadyExistsException
import org.{elasticsearch => es}
import play.{api => p}
import scala.util.control.NonFatal
import scala.collection.mutable
import Prelude._



class IndexCreator {

  private val languagesLogged = mutable.HashSet[String]()

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
    val createIndexRequest = es.client.Requests.createIndexRequest(IndexName)
      .settings(indexSettings.indexSettingsString)
      .mapping(PostDocType, indexSettings.postMappingString)
    def language = indexSettings.language

    // Attempt to create the index, synchronously, and see if there's any
    // it-already-exists exception.
    val wasCreated = try {
      val response: CreateIndexResponse =
        client.admin().indices().create(createIndexRequest).actionGet()
      val message = s"Created search index for '$language' [EsM8KZO2]."
      if (response.isAcknowledged) {
        p.Logger.info(message)
      }
      else {
        p.Logger.warn(o"""$message But the index mappings have not yet propagated
            to all nodes in the cluster [EsW6YKF24].""")
      }
      true
    }
    catch {
      case _: IndexAlreadyExistsException =>
        if (!languagesLogged.contains(indexSettings.language)) {
          p.Logger.info(o"""Search index already created for '$language', fine [EsM2FG40]""")
        }
        false
      case NonFatal(error) =>
        p.Logger.error(s"Error creating search index for '$language' [EsE8BF5]", error)
        throw error
    }

    languagesLogged.add(indexSettings.language)
    wasCreated
  }

}

