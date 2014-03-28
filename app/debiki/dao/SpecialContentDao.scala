/**
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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

package debiki.dao

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import java.{util => ju}
import debiki.dao.CachingDao.CacheKey
import SpecialContentPages._


/** Loads special content pages, e.g. a page with a user-content-license text
  * that can be included as a section on the terms-of-use page.
  */
trait SpecialContentDao {
  self: SiteDao =>


  object specialContentPages {

    def termsOfUseContentLicense: String = {
      val content = loadSpecialContentPage(TermsOfUseContentLicenseId) getOrElse
        TermsOfUseContentLicense
      replaceNamesApplyMarkup(content)
    }

    def termsOfUseJurisdiction: String = {
      val content = loadSpecialContentPage(TermsOfUseJurisdictionId) getOrElse
        TermsOfUseJurisdiction
      replaceNamesApplyMarkup(content)
    }
  }


  protected def loadSpecialContentPage(pageId: PageId): Option[Content] = {
    loadPageBodiesTitles(pageId::Nil).headOption flatMap { case (pageId, pageParts) =>
      pageParts.body map { body =>
        // Return None so the caller fallbacks to the default content, if we are
        // to use the default content.
        if (body.currentText == SpecialContentPages.UseDefaultContentMark)
          return None

        // Special content pages are always auto approved, it's ok to use `currentText`.
        Content(text = body.currentText, markup = body.markup)
      }
    }
  }


  private def replaceNamesApplyMarkup(content: Content): String = {
    var text = content.text.replaceAllLiterally(
      "%{company_short_name}", self.loadWholeSiteSettings().companyShortName.value.toString)
    text = content.markup match {
      case Markup.Html.id =>
        text
      case Markup.Dmd0.id =>
        val nodeSeq = HtmlPageSerializer.markdownToSafeHtml(text, hostAndPort = "???",
          allowClassIdDataAttrs = false, makeLinksNofollow = true)
        nodeSeq.toString
    }
    text
  }

}



trait CachingSpecialContentDao extends SpecialContentDao {
  self: CachingSiteDao =>

  onPageSaved { sitePageId =>
    // if page id == some special content page id, uncache it.
  }

  // override def loadSpecialContentPage(...) ...

}

