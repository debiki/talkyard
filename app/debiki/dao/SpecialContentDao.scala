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
import debiki.DebikiHttp._
import SpecialContentPages._


/** Loads special content pages, e.g. a page with a user-content-license text
  * that can be included as a section on the terms-of-use page.
  *
  * COULD avoid generating HTML for code pages (per site CSS)
  * COULD generate HTML from CommonMark and reuse, before replacing magic values (e.g.
  * replace the company name placeholder in the cached HTML, not in the raw source).
  */
trait SpecialContentDao {
  self: SiteDao =>

  memCache.onPageSaved { sitePageId =>
    // if page id == some special content page id, uncache it.
  }

  // override def loadSpecialContentPage(...) ...


  def loadSpecialContentPage(pageId: PageId, replaceNamesApplyMarkup: Boolean): Option[Content] = {
    readOnlyTransaction { transaction =>
      transaction.loadPost(pageId, PageParts.BodyNr) map { bodyPost =>
        // Return None so the caller fallbacks to the default content, if we are
        // to use the default content.
        if (bodyPost.currentSource == SpecialContentPages.UseDefaultContentMark)
          return None

        val source =
          if (replaceNamesApplyMarkup)
            doReplaceNamesApplyMarkup(bodyPost.currentSource, transaction)
          else
            bodyPost.currentSource

        // Special content pages are always auto approved, it's ok to use `currentSource`.
        Content(text = source)
      }
    }
  }


  def saveSpecialContent(rootPageId: PageId, contentId: PageId, anyNewSource: Option[String],
        resetToDefaultContent: Boolean, editorId: UserId) {

    if (contentId != SpecialContentPages.StylesheetId &&
        contentId != SpecialContentPages.JavascriptId)
      throwBadReq("DwE44RF8", s"Bad special content page id: `$contentId'")

    if (anyNewSource.isDefined && resetToDefaultContent)
      throwBadReq("DwE5FSW0", "Both new-text and reset-to-default-content specified")

    val newSource = anyNewSource getOrElse {
      if (resetToDefaultContent) SpecialContentPages.UseDefaultContentMark
      else throwBadReq("DwE2GY05", "No new text specified")
    }

    val pageId = s"$rootPageId$contentId"

    val approvedHtmlSanitized =
      commonmarkRenderer.renderAndSanitizeCommonMark(newSource,
        allowClassIdDataAttrs = false, followLinks = false)

    readWriteTransaction { transaction =>
      // BUG: Race condition, lost update bug -- but it's mostly harmless,
      // admins will be active only one at a time? Solve by passing body version to server,
      // so we can detect if someone else has changed it in between.

      // Verify that root page id exists and is a section.
      if (rootPageId.nonEmpty) {
        def theRootPage = s"Root page '$rootPageId', site '$siteId',"
        val meta = transaction.loadPageMeta(rootPageId) getOrElse
          throwForbidden("Dw0FfR1", s"$theRootPage does not exist")
        if (!meta.pageRole.isSection)
          throwForbidden("Dw7GBR8", s"$theRootPage is not a section")
      }

      transaction.loadPost(pageId, PageParts.BodyNr) match {
        case None =>
          createSpecialContentPage(pageId, authorId = editorId, newSource,
            htmlSanitized = approvedHtmlSanitized, transaction)
        case Some(oldPost) =>
          updateSpecialContentPage(oldPost, newSource, htmlSanitized = approvedHtmlSanitized,
            editorId, transaction)
      }
    }
  }


  protected def createSpecialContentPage(pageId: PageId, authorId: UserId,
      source: String, htmlSanitized: String, transaction: SiteTransaction) {
    val pageMeta = PageMeta.forNewPage(pageId, PageRole.SpecialContent, authorId,
      transaction.now.toJavaDate, categoryId = None, url = None, publishDirectly = true)

    val uniqueId = transaction.nextPostId()

    val bodyPost = Post.createBody(
      uniqueId = uniqueId,
      pageId = pageId,
      createdAt = transaction.now.toJavaDate,
      createdById = authorId,
      source = source,
      htmlSanitized = htmlSanitized,
      approvedById = Some(authorId))

    transaction.insertPageMetaMarkSectionPageStale(pageMeta)
    transaction.insertPost(bodyPost)

    val dummyPagePath = PagePath(siteId, "/", Some(pageId), showId = true, pageSlug = "dummy")
    if (affectsWholeSite(pageId)) {
      emptyCacheImpl(transaction)
    }
    else {
      memCache.firePageCreated(dummyPagePath)
    }
  }


  protected def updateSpecialContentPage(oldPost: Post, newSource: String, htmlSanitized: String,
        editorId: UserId, transaction: SiteTransaction) {
    if (oldPost.currentSource == newSource)
      return

    // For now, just keep updating the current revision.
    val nextRevisionNr = oldPost.currentRevisionNr
    val forNowEditorId = oldPost.createdById // later, create revisions & use: editorId

    val editedPost = oldPost.copy(
      currentRevLastEditedAt = Some(transaction.now.toJavaDate),
      currentRevisionById = forNowEditorId,
      currentSourcePatch = None,
      currentRevisionNr = nextRevisionNr,
      lastApprovedEditAt = Some(transaction.now.toJavaDate),
      lastApprovedEditById = Some(forNowEditorId),
      approvedSource = Some(newSource),
      approvedHtmlSanitized = Some(htmlSanitized),
      approvedAt = Some(transaction.now.toJavaDate),
      approvedById = Some(editorId),
      approvedRevisionNr = Some(nextRevisionNr))

    transaction.updatePost(editedPost)

    if (affectsWholeSite(oldPost.pageId)) {
      emptyCacheImpl(transaction)
    }
    else {
      memCache.firePageSaved(SitePageId(siteId = siteId, pageId = oldPost.pageId))
    }
  }


  private def doReplaceNamesApplyMarkup(source: String, transaction: SiteTransaction): String = {
    val shortName = self.loadWholeSiteSettings(transaction).orgShortName
    var text = source.replaceAllLiterally("%{company_short_name}", shortName)
    val nodeSeq = ReactRenderer.renderAndSanitizeCommonMark(
      text, allowClassIdDataAttrs = false, followLinks = false)
    nodeSeq.toString
  }


  private def affectsWholeSite(pageId: PageId) =
    true // currently always

}

