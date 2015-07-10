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
import com.debiki.core.PageParts.MaxTitleLength
import com.debiki.core.User.SystemUserId
import debiki._
import debiki.DebikiHttp._
import java.{util => ju}


/** Loads and saves pages and page parts (e.g. posts and patches).
  *
  * (There's also a class PageDao (with no 's' in the name) that focuses on
  * one specific single page.)
  */
trait PagesDao {
  self: SiteDao =>


  def createPage(pageRole: PageRole, pageStatus: PageStatus, anyParentPageId: Option[PageId],
        anyFolder: Option[String], anySlug: Option[String], titleSource: String, bodySource: String,
        showId: Boolean, authorId: UserId, browserIdData: BrowserIdData)
        : PagePath = {

    val bodyHtmlSanitized = siteDbDao.commonMarkRenderer.renderAndSanitizeCommonMark(bodySource,
      allowClassIdDataAttrs = true, followLinks = !pageRole.isWidelyEditable)
    if (bodyHtmlSanitized.trim.isEmpty)
      throwForbidden("DwE3KFE29", "Page body should not be empty")

    if (titleSource.length > MaxTitleLength)
      throwBadReq("DwE4HEFW8", s"Title too long, max length is $MaxTitleLength")

    val titleHtmlSanitized = siteDbDao.commonMarkRenderer.sanitizeHtml(titleSource)
    if (titleHtmlSanitized.trim.isEmpty)
      throwForbidden("DwE5KPEF21", "Page title should not be empty")

    readWriteTransaction { transaction =>

      val pageId = transaction.nextPageId()

      // Authorize and determine approver user id. For now:
      val author = transaction.loadUser(authorId) getOrElse throwForbidden("DwE9GK32", "User gone")

      val pageSlug = anySlug match {
        case Some(slug) =>
          if (!author.isStaff)
            throwForbidden("DwE4KFW87", "Only staff may specify page slug")
          slug
        case None =>
          siteDbDao.commonMarkRenderer.slugifyTitle(titleSource)
      }

      val approvedById =
        if (author.isStaff) {
          author.id
        }
        else {
          if (pageRole != PageRole.ForumTopic)
            throwForbidden("DwE0GK3w2", "You may create forum topics only")

          anyParentPageId match {
            case None =>
              throwForbidden("DwE8GKE4", "No parent forum or category specified")
            case Some(parentId) =>
              val parentMeta = loadPageMeta(parentId) getOrElse throwNotFound(
                "DwE78BI21", s"Parent forum or category does not exist, id: '$parentId'")

              if (parentMeta.pageRole != PageRole.ForumCategory &&
                  parentMeta.pageRole != PageRole.Forum)
                throwForbidden("DwE830BIR5", "Parent page is not a Forum or ForumCategory")

              // The System user currently approves all new forum topics.
              // SECURITY COULD analyze the author's trust level and past actions, and
              // based on that, approve, reject or review later.
              SystemUserId
          }
        }

      val folder = anyFolder getOrElse {
        val anyParentPath = anyParentPageId flatMap { id =>
          transaction.loadPagePath(id)
        }
        anyParentPath.map(_.folder) getOrElse "/"
      }

      val pagePath = PagePath(siteId, folder = folder, pageId = Some(pageId),
        showId = showId, pageSlug = pageSlug)

      val titleUniqueId = transaction.nextPostId()
      val bodyUniqueId = titleUniqueId + 1

      val titlePost = Post.createTitle(
        siteId = siteId,
        uniqueId = titleUniqueId,
        pageId = pageId,
        createdAt = transaction.currentTime,
        createdById = authorId,
        source = titleSource,
        htmlSanitized = titleHtmlSanitized,
        approvedById = Some(approvedById))

      val bodyPost = Post.createBody(
        siteId = siteId,
        uniqueId = bodyUniqueId,
        pageId = pageId,
        createdAt = transaction.currentTime,
        createdById = authorId,
        source = bodySource,
        htmlSanitized = bodyHtmlSanitized,
        approvedById = Some(approvedById))

      val pageMeta = PageMeta.forNewPage(pageId, pageRole, authorId, transaction.currentTime,
        parentPageId = anyParentPageId, url = None, publishDirectly = true)

      val auditLogEntry = AuditLogEntry(
        siteId = siteId,
        id = AuditLogEntry.UnassignedId,
        didWhat = AuditLogEntryType.NewPage,
        doerId = authorId,
        doneAt = transaction.currentTime,
        browserIdData = browserIdData,
        pageId = Some(pageId),
        pageRole = Some(pageRole))

      transaction.insertPageMeta(pageMeta)
      transaction.insertPagePath(pagePath)
      transaction.insertPost(titlePost)
      transaction.insertPost(bodyPost)
      insertAuditLogEntry(auditLogEntry, transaction)

      val notifications = NotificationGenerator(transaction)
        .generateForNewPost(PageDao(pageId, transaction), bodyPost)
      transaction.saveDeleteNotifications(notifications)

      pagePath
    }
  }

}



trait CachingPagesDao extends PagesDao {
  self: CachingSiteDao =>


  override def createPage(pageRole: PageRole, pageStatus: PageStatus,
        anyParentPageId: Option[PageId], anyFolder: Option[String], anySlug: Option[String],
        titleSource: String, bodySource: String,
        showId: Boolean, authorId: UserId, browserIdData: BrowserIdData)
        : PagePath = {
    val pagePath = super.createPage(pageRole, pageStatus, anyParentPageId,
      anyFolder, anySlug, titleSource, bodySource, showId, authorId, browserIdData)
    firePageCreated(pagePath)
    pagePath
  }

}

