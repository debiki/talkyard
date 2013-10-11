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

package debiki


/** Creates new websites.
  *
  * If a forum or blog is to be created, creates it at http://server-address/.
  * and nothing else.
  *
  * If a simple website is to be created, creates a homepage at http://server-address/,
  * and nothing else.
  */
object SiteCreator {


  sealed abstract class NewSiteType
  object NewSiteType {
    case object Forum extends NewSiteType
    case object Blog extends NewSiteType
    case object SimpleSite extends NewSiteType
  }


  def createSite(siteType: NewSiteType, dao: debiki.dao.SiteDao) {

  }

}
