/**
 * Copyright (C) 2012-2013 Kaj Magnus Lindberg (born 1979)
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

package controllers

import com.debiki.v0._
import debiki._
import java.{util => ju, io => jio}
import play.api._
import play.api.mvc.{Action => _, _}
import play.api.Play.current
import ApiActions._
import PageActions._
import DebikiHttp._
import Prelude._
import Utils.ValidationImplicits._
import Utils.{OkHtml, OkXml}



/** Shows pages and individual posts.
  */
object AppViewPosts extends mvc.Controller {


  def showActionLinks(pathIn: PagePath, postId: ActionId) =
    PageGetAction(pathIn) { pageReq =>
      val links = Utils.formHtml(pageReq).actLinks(postId)
      OkHtml(links)
    }


  def viewPost(pathIn: PagePath) = PageGetAction(pathIn) {
        pageReq =>
    val pageInfoYaml = pageReq.user.isEmpty ? "" | buildPageInfoYaml(pageReq)
    // If not logged in, then include an empty Yaml tag, so the browser
    // notices that it got that elem, and won't call GET ?page-info.
    val infoNode = <pre class='dw-data-yaml'>{pageInfoYaml}</pre>
    val pageHtml =
      pageReq.dao.renderTemplate(pageReq, appendToBody = infoNode)
    Ok(pageHtml) as HTML
  }


  /**
   * Lists e.g. all posts and ratings by a certain user, on a page.
   *
   * Initially, on page load, all (?) this info is already implicitly included
   * in the html sent by the server, e.g. the user's own posts are highlighted.
   * However, the user might logout and login, without refreshing the page,
   * so we need a way for the browser to fetch authorship info
   * dynamically.
   */
  // COULD rename to listUserPageData?
  def showPageInfo(pathIn: PagePath) = PageGetAction(pathIn) { pageReq =>
    if (!pageReq.request.rawQueryString.contains("&user=me"))
      throwBadReq("DwE0GdZ22", "Right now you need to specify ``&user=me''.")
    val yaml = buildPageInfoYaml(pageReq)
    Ok(yaml)
  }


  // COULD move to separate file? What file? DebikiYaml.scala?
  def buildPageInfoYaml(pageReq: PageRequest[_]): String = {
    import pageReq.{permsOnPage => perms}
    val page = pageReq.page_!
    val my = pageReq.user_!
    val reply = new StringBuilder

    // List permissions.
    reply ++=
      "\npermsOnPage:" ++=
      "\n accessPage: " ++= perms.accessPage.toString ++=
      "\n createPage: " ++= perms.createPage.toString ++=
      "\n moveRenamePage: " ++= perms.moveRenamePage.toString ++=
      "\n hidePageIdInUrl: " ++= perms.hidePageIdInUrl.toString ++=
      "\n editPageTemplate: " ++= perms.editPageTemplate.toString ++=
      "\n editPage: " ++= perms.editPage.toString ++=
      "\n editAnyReply: " ++= perms.editAnyReply.toString ++=
      "\n editGuestReply: " ++= perms.editUnauReply.toString ++=
      "\n collapseThings: " ++= perms.collapseThings.toString ++=
      "\n deleteAnyReply: " ++= perms.deleteAnyReply.toString

    // List posts by this user, so they can be highlighted.
    reply ++= "\nauthorOf:"
    for (post <- page.postsByUser(withId = my.id)) {
      reply ++= s"\n - ${post.id}"
    }

    // List the user's ratings so they can be highlighted so the user
    // won't rate the same post again and again and again each day.
    // COULD list only the very last rating per post (currently all old
    // overwritten ratings are included).
    reply ++= "\nratings:"
    for (rating <- page.ratingsByUser(withId = my.id)) {
      reply ++= s"\n ${rating.postId}: [" ++=
        rating.tags.mkString(",") ++= "]"
    }

    //reply ++= "\nmyUnapprovedComments:"
    //val myPendingPosts =  page.postsByUser(my.id).filter(!_.currentVersionReviewed).map(_.id)
    // for each post, include jsonForPost, + list of ancestor post ids.

    // (COULD include HTML for any notifications to the user.
    // Not really related to the current page only though.)
    // reply ++= "\nnotfs: ..."

    reply.toString
  }

}
