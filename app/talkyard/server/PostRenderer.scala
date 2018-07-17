/**
 * Copyright (c) 2018 Kaj Magnus Lindberg
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
import com.debiki.core.Prelude.die
import debiki.Nashorn


case class PostRendererSettings(
  pageRole: PageRole,
  pubSiteId: PublSiteId)


sealed abstract class IfCached
object IfCached {
  case class Die(errorCode: String) extends IfCached
  case object Ignore extends IfCached
  case object Use extends IfCached
}


class PostRenderer(private val nashorn: Nashorn) {


  // mentions?
  def renderAndSanitize(post: Post, settings: PostRendererSettings, ifCached: IfCached): String = {
    if (ifCached == IfCached.Ignore) {
    }
    else if (post.isCurrentVersionApproved && post.approvedHtmlSanitized.isDefined) {
      ifCached match {
        case IfCached.Die(errorCode) => die("TyE2KPKW3-" + errorCode)
        case _ =>
          // @mentinos?
          return post.approvedHtmlSanitized.get
      }
    }

    val isBody = post.nr == PageParts.BodyNr
    val followLinks = isBody && settings.pageRole.shallFollowLinks
    if (post.nr == PageParts.TitleNr) {
      sanitizeHtml(post.currentSource, followLinks)
    }
    else if (post.tyype == PostType.CompletedForm) {
      CompletedFormRenderer.renderJsonToSafeHtml(post.currentSource) getMakeGood { errorMessage =>
        val unsafeText = s"Error rendering source to html: $errorMessage [EsE7Y4KW8]"
        org.owasp.encoder.Encode.forHtmlContent(unsafeText)
      }
    }
    else {
      val renderResult = nashorn.renderAndSanitizeCommonMark(
          post.currentSource, pubSiteId = settings.pubSiteId,
          allowClassIdDataAttrs = isBody, followLinks = followLinks)
      renderResult.safeHtml
    }
  }


  def sanitizeHtml(text: String, followLinks: Boolean): String = {
    nashorn.sanitizeHtml(text, followLinks)
  }



  def slugifyTitle(title: String): String = {
    nashorn.slugifyTitle(title)
  }

}


case class CommonMarkSourceAndHtml(source: String, html: String)

