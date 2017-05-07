/**
 * Copyright (C) 2015 Kaj Magnus Lindberg
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
import debiki.DebikiHttp.throwNotFound
import ed.server.http.throwForbiddenIf
import debiki.TextAndHtml
import ed.server.auth.{Authz, ForumAuthzContext, MayMaybe}
import java.{util => ju}
import scala.collection.{immutable, mutable}
import scala.collection.mutable.ArrayBuffer




/** @param shallBeDefaultCategory — if set, the root category's default category id will be
  *     updated to point to this category.
  */
case class CategoryToSave(
  sectionPageId: PageId,
  parentId: CategoryId,
  name: String,
  slug: String,
  position: Int,
  // [refactor] [5YKW294] [rename] Should no longer be a list. Change db too, from "nnn,nnn,nnn" to single int.
  newTopicTypes: immutable.Seq[PageRole],
  shallBeDefaultCategory: Boolean,
  unlisted: Boolean,
  description: String,
  anyId: Option[CategoryId] = None, // Some() if editing, < 0 if creating COULD change from Option[CategoryId] to CategoryId
  isCreatingNewForum: Boolean = false) {

  require(anyId isNot NoCategoryId, "EdE5LKAW0")
  def isNewCategory: Boolean = anyId.exists(_ < 0)

  val aboutTopicTitle: TextAndHtml = TextAndHtml.forTitle(s"About the $name category")
  val aboutTopicBody: TextAndHtml = TextAndHtml.forBodyOrComment(description) // COULD follow links? Only staff can create categories [WHENFOLLOW]

  def makeCategory(id: CategoryId, createdAt: ju.Date) = Category(
    id = id,
    sectionPageId = sectionPageId,
    parentId = Some(parentId),
    defaultCategoryId = None,
    name = name,
    slug = slug,
    position = position,
    description = None,
    newTopicTypes = newTopicTypes,
    unlisted = unlisted,
    createdAt = createdAt,
    updatedAt = createdAt)

}


case class CreateCategoryResult(
  category: Category,
  pagePath: PagePath,
  permissionsWithIds: immutable.Seq[PermsOnPages])


/** Loads and saves categories.
  */
trait CategoriesDao {
  self: SiteDao =>

  // The dao shouldn't live past the current HTTP request anyway.
  private var categoriesById: Map[CategoryId, Category] = _
  private var categoriesByParentId: mutable.HashMap[CategoryId, ArrayBuffer[Category]] = _
  private var defaultCategoryId = NoCategoryId
  private var rootCategories: Seq[Category] = _


  /** List categories in the site section (forum/blog/whatever) at page pageId.
    * Sorts by Category.position (which doesn't make much sense if there are sub categories).
    * Returns (categories, default-category-id).
    */
  def listMaySeeSectionCategories(pageId: PageId, authzCtx: ForumAuthzContext)
        : (Seq[Category], CategoryId) = {
    loadRootCategory(pageId) match {
      case Some(rootCategory) =>
        val categories = listDescendantMaySeeCategories(rootCategory.id, includeRoot = false,
          authzCtx).sortBy(_.position)
        (categories, rootCategory.defaultCategoryId getOrDie "EsE4GK02")
      case None =>
        (Nil, NoCategoryId)
    }
  }


  /** Sometimes the section page id is undefined — for example, when talking with someone
    * in a personal chat. That chat topic isn't placed in any section (e.g. blog or forum).
    * Then we want to list all categories, not just all categories in some (undefined) section.
    *
    * Returns (categories, default-category-id).  (Currently there can be only 1 default category)
    */
  def listAllMaySeeCategories(authzCtx: ForumAuthzContext)
        : (Seq[Category], Option[CategoryId]) = {
    if (rootCategories eq null) {
      loadBuildRememberCategoryMaps()
      dieIf(rootCategories eq null, "EsE4KG0W2")
    }
    unimplementedIf(rootCategories.length > 1, "EsU4KT2R8")
    if (rootCategories.isEmpty)
      return (Nil, None)

    val rootCategory = rootCategories.head
    val categories = listDescendantMaySeeCategories(rootCategory.id, includeRoot = false,
      authzCtx).sortBy(_.position)
    (categories, Some(rootCategory.defaultCategoryId getOrDie "EsE4GK02"))
  }


  /** List all categories in the sub tree with categoryId as root.
    */
  private def listDescendantMaySeeCategories(categoryId: CategoryId, includeRoot: Boolean,
        authzCtx: ForumAuthzContext): Seq[Category] = {
    val categories = ArrayBuffer[Category]()
    appendMaySeeCategoriesInTree(categoryId, includeRoot, authzCtx, categories)
    categories.to[immutable.Seq]
  }


  /** Lists pages placed directly in one of categoryIds.
    */
  private def loadPagesDirectlyInCategories(categoryIds: Seq[CategoryId], pageQuery: PageQuery,
        limit: Int): Seq[PagePathAndMeta] = {
    readOnlyTransaction(_.loadPagesInCategories(categoryIds, pageQuery, limit))
  }


  /** Lists pages placed in categoryId, optionally including its descendant categories.
    */
  def loadMaySeePagesInCategory(categoryId: CategoryId, includeDescendants: Boolean,
        authzCtx: ForumAuthzContext, pageQuery: PageQuery, limit: Int)
        : Seq[PagePathAndMeta] = {
    val maySeeCategoryIds =
      if (includeDescendants) {
        // (Include the start ("root") category because it might not be the root of the
        // whole section (e.g. the whole forum) but only the root of a sub section (e.g.
        // a category in the forum). The top root shouldn't contain any pages, but subtree roots
        // usually contain pages. )
        CLEAN_UP // investigate & remove this old comment:
        // (If `restrictedOnly` is true, then most hidden topics won't be included, because
        // they might not be placed inside restricted categories. Everything works fine
        // anyway currently, though, see [7RIQ29]. )
        listDescendantMaySeeCategories(categoryId, includeRoot = true, authzCtx).map(_.id)
      }
      else {
        SECURITY // double-think-through this:
        // No this is fine, we're nowadays testing below, with Authz.maySeePage(..).
        // unimplementedIf(!authzCtx.isStaff, "!incl hidden in forum [EsE2PGJ4]")
        Seq(categoryId)
      }

    // Although we may see these categories, we might not be allowed to see all pages therein.
    // So, both per-category and per-page authz checks.
    val pagesInclForbidden = loadPagesDirectlyInCategories(maySeeCategoryIds, pageQuery, limit)

    // For now. COULD do some of filtering in the db query instead, so won't find 0 pages
    // just because all most-recent-pages are e.g. hidden.
    val filteredPages = pagesInclForbidden filter { page =>
      val categories = loadAncestorCategoriesRootLast(page.categoryId)
      val may = ed.server.auth.Authz.maySeePage(
        page.meta,
        user = authzCtx.requester,
        groupIds = authzCtx.groupIds,
        pageMembers = getAnyPrivateGroupTalkMembers(page.meta),
        categoriesRootLast = categories,
        permissions = authzCtx.permissions,
        maySeeUnlisted = false) // pageQuery.pageFilter.includesUnlisted
      may == MayMaybe.Yes
    }

    filteredPages
  }


  def loadAncestorCategoriesRootLast(anyCategoryId: Option[CategoryId]): immutable.Seq[Category] = {
    val id = anyCategoryId getOrElse {
      return Nil
    }
    loadAncestorCategoriesRootLast(id)
  }


  def loadAncestorCategoriesRootLast(categoryId: CategoryId): immutable.Seq[Category] = {
    val categoriesById = loadBuildRememberCategoryMaps()._1
    val categories = ArrayBuffer[Category]()
    var current = categoriesById.get(categoryId)
    while (current.isDefined) {
      categories.append(current.get)
      current = current.get.parentId flatMap categoriesById.get
    }
    categories.to[immutable.Seq]
  }


  /** Returns (category, is-default).
    */
  def loadCategory(id: CategoryId): Option[(Category, Boolean)] = {
    val catsStuff = loadBuildRememberCategoryMaps()
    val anyCategory = catsStuff._1.get(id)
    val defaultId = catsStuff._3
    anyCategory.map(category => (category, category.id == defaultId))
  }


  def loadCategoryBySlug(slug: String): Option[Category] = {
    val catsStuff = loadBuildRememberCategoryMaps()
    catsStuff._1.values.find(_.slug == slug)
  }


  def loadTheCategory(id: CategoryId): (Category, Boolean) =
    loadCategory(id) getOrElse throwNotFound("DwE8YUF0", s"No category with id $id")


  def loadRootCategory(categoryId: CategoryId): Option[Category] =
    loadAncestorCategoriesRootLast(categoryId).lastOption


  def loadSectionPageId(categoryId: CategoryId): Option[PageId] =
    loadRootCategory(categoryId).map(_.sectionPageId)


  def loadTheSectionPageId(categoryId: CategoryId): PageId =
    loadRootCategory(categoryId).map(_.sectionPageId) getOrDie "DwE804K2"

  def loadSectionPageIdsAsSeq(): Seq[PageId] = {
    loadBuildRememberCategoryMaps()
    categoriesById.values.filter(_.parentId.isEmpty).map(_.sectionPageId).toSeq
  }


  def loadAboutCategoryPageId(categoryId: CategoryId): Option[PageId] = {
    readOnlyTransaction(_.loadAboutCategoryPageId(categoryId))
  }


  private def loadRootCategory(pageId: PageId): Option[Category] = {
    val categoriesById = loadBuildRememberCategoryMaps()._1
    for ((_, category) <- categoriesById) {
      if (category.sectionPageId == pageId && category.parentId.isEmpty)
        return Some(category)
    }
    None
  }


  private def appendMaySeeCategoriesInTree(rootCategoryId: CategoryId, includeRoot: Boolean,
      authzCtx: ForumAuthzContext, categoryList: ArrayBuffer[Category]) {

    if (categoryList.exists(_.id == rootCategoryId)) {
      // COULD log cycle error
      return
    }

    val (categoriesById, categoriesByParentId, _) = loadBuildRememberCategoryMaps()
    val startCategory = categoriesById.getOrElse(rootCategoryId, {
      return
    })

    val categories = loadAncestorCategoriesRootLast(rootCategoryId)

    // (Skip the root category in this check; cannot set permissions on it. [0YWKG21])
    if (!categories.head.isRoot) {
      val may = Authz.maySeeCategory(authzCtx, categories)
      if (may.maySee isNot true)
        return
    }

    COULD // add a seeUnlisted permission? If in a cat, a certain group should see unlisted topics.
    val onlyForStaff = startCategory.unlisted || startCategory.isDeleted
    if (onlyForStaff && !authzCtx.isStaff)
      return

    if (includeRoot)
      categoryList.append(startCategory)

    val childCategories = categoriesByParentId.getOrElse(rootCategoryId, {
      return
    })
    for (childCategory <- childCategories) {
      appendMaySeeCategoriesInTree(childCategory.id, includeRoot = true,
        authzCtx, categoryList)
    }
  }


  private def loadBuildRememberCategoryMaps(): (Map[CategoryId, Category],
        mutable.HashMap[CategoryId, ArrayBuffer[Category]], CategoryId) = {
    if (categoriesById ne null)
      return (categoriesById, categoriesByParentId, defaultCategoryId)

    categoriesByParentId = mutable.HashMap[CategoryId, ArrayBuffer[Category]]()
    categoriesById = loadCategoryMap()

    for ((_, category) <- categoriesById; parentId <- category.parentId) {
      val siblings = categoriesByParentId.getOrElseUpdate(parentId, ArrayBuffer[Category]())
      siblings.append(category)
    }

    rootCategories = categoriesById.values.filter(_.isRoot).toVector
    val anyRoot = categoriesById.values.find(_.isRoot)
    defaultCategoryId = anyRoot.flatMap(_.defaultCategoryId) getOrElse NoCategoryId
    (categoriesById, categoriesByParentId, defaultCategoryId)
  }

  COULD_OPTIMIZE // cache
  private def loadCategoryMap() =
    readOnlyTransaction(_.loadCategoryMap())


  def editCategory(editCategoryData: CategoryToSave, permissions: immutable.Seq[PermsOnPages],
        who: Who): Category = {
    val (oldCategory, editedCategory) = readWriteTransaction { transaction =>
      val categoryId = editCategoryData.anyId getOrDie "DwE7KPE0"
      val oldCategory = transaction.loadCategory(categoryId).getOrElse(throwNotFound(
        "DwE5FRA2", s"Category not found, id: $categoryId"))
      // Currently cannot change parent category because then topic counts will be wrong.
      // Could just remove all counts, who cares anyway
      require(oldCategory.parentId.contains(editCategoryData.parentId), "DwE903SW2")
      val editedCategory = oldCategory.copy(
        name = editCategoryData.name,
        slug = editCategoryData.slug,
        position = editCategoryData.position,
        newTopicTypes = editCategoryData.newTopicTypes,
        unlisted = editCategoryData.unlisted,
        updatedAt = transaction.now.toJavaDate)

      if (editCategoryData.shallBeDefaultCategory) {
        setDefaultCategory(editedCategory, transaction)
      }

      transaction.updateCategoryMarkSectionPageStale(editedCategory)

      addRemovePermsOnCategory(categoryId, permissions)(transaction)
      (oldCategory, editedCategory)
      // COULD create audit log entry
    }

    if (oldCategory.name != editedCategory.name) {
      // All pages in this category need to be regenerated, because the category name is
      // included on the pages.
      emptyCache()
    }

    // Do this even if we just emptied the cache above, because then the forum page
    // will be regenerated earlier.
    refreshPageInMemCache(oldCategory.sectionPageId)
    refreshPageInMemCache(editedCategory.sectionPageId)

    editedCategory
  }


  def createCategory(newCategoryData: CategoryToSave, permissions: immutable.Seq[PermsOnPages],
        byWho: Who): CreateCategoryResult = {
    readWriteTransaction { transaction =>
      createCategoryImpl(newCategoryData, permissions, byWho)(transaction)
    }
  }


  def createCategoryImpl(newCategoryData: CategoryToSave, permissions: immutable.Seq[PermsOnPages],
        byWho: Who)(transaction: SiteTransaction): CreateCategoryResult = {

    val categoryId = transaction.nextCategoryId()

    // Discourse currently has 28 categories so 65 is a lot.
    // Can remove this later, when I think I won't want to add more cat perms via db migrations.
    throwForbiddenIf(categoryId > 65, "EdE7LKG2", "Too many categories, > 65") // see [B0GKWU52]

    val category = newCategoryData.makeCategory(categoryId, transaction.now.toJavaDate)
    transaction.insertCategoryMarkSectionPageStale(category)

    val (aboutPagePath, _) = createPageImpl(
        PageRole.AboutCategory, PageStatus.Published, anyCategoryId = Some(categoryId),
        anyFolder = None, anySlug = Some("about-" + newCategoryData.slug), showId = true,
        titleSource = newCategoryData.aboutTopicTitle.text,
        titleHtmlSanitized = newCategoryData.aboutTopicTitle.safeHtml,
        bodySource = newCategoryData.aboutTopicBody.text,
        bodyHtmlSanitized = newCategoryData.aboutTopicBody.safeHtml,
        pinOrder = Some(ForumDao.AboutCategoryTopicPinOrder),
        pinWhere = Some(PinPageWhere.InCategory),
        byWho, spamRelReqStuff = None, transaction)

    if (newCategoryData.shallBeDefaultCategory) {
      setDefaultCategory(category, transaction)
    }

    permissions foreach { p =>
      dieIf(p.onCategoryId != newCategoryData.anyId, "EdE7UKW02")
    }
    val permsWithCatId = permissions.map(_.copy(onCategoryId = Some(categoryId)))
    val permsWithId = addRemovePermsOnCategory(categoryId, permsWithCatId)(transaction)

    // COULD create audit log entry

    // The forum needs to be refreshed because it has cached the category list
    // (in JSON in the cached HTML).
    if (!newCategoryData.isCreatingNewForum) {
      refreshPageInMemCache(category.sectionPageId)
    }

    CreateCategoryResult(category, aboutPagePath, permsWithId)
  }


  def deleteUndeleteCategory(categoryId: CategoryId, delete: Boolean, who: Who) {
    readWriteTransaction { transaction =>
      throwForbiddenIf(!transaction.isAdmin(who.id), "EdEGEF239S", "Not admin")
      val categoryBefore = transaction.loadCategory(categoryId) getOrElse {
        throwNotFound("EdE5FK8E2", s"No category with id $categoryId")
      }
      val categoryAfter = categoryBefore.copy(
        deletedAt = if (delete) Some(transaction.now.toJavaDate) else None)
      transaction.updateCategoryMarkSectionPageStale(categoryAfter)
    }
    // All pages in the category now needs to be rerendered.
    COULD_OPTIMIZE // only remove-from-cache / mark-as-dirty pages inside the category.
    emptyCache()
  }


  private def setDefaultCategory(category: Category, transaction: SiteTransaction) {
    val rootCategoryId = category.parentId getOrDie "EsE2PK8O4"
    val rootCategory = transaction.loadCategory(rootCategoryId) getOrDie "EsE5KG02"
    if (rootCategory.defaultCategoryId.contains(category.id))
      return
    val rootWithNewDefault = rootCategory.copy(defaultCategoryId = Some(category.id))
    // (The section page will be marked as stale anyway, doesn't matter if we do it here too.)
    transaction.updateCategoryMarkSectionPageStale(rootWithNewDefault)
  }


  private def addRemovePermsOnCategory(categoryId: CategoryId,
        permissions: immutable.Seq[PermsOnPages])(transaction: SiteTransaction)
        : immutable.Seq[PermsOnPages] = {
    dieIf(permissions.exists(_.onCategoryId.isNot(categoryId)), "EdE2FK0YU5")
    val permsWithIds = ArrayBuffer[PermsOnPages]()
    val oldPermissionsById: mutable.Map[PermissionId, PermsOnPages] =
      transaction.loadPermsOnCategory(categoryId).map(p => (p.id, p))(collection.breakOut)
    permissions foreach { permission =>
      var alreadyExists = false
      if (permission.id >= PermissionAlreadyExistsMinId) {
        oldPermissionsById.remove(permission.id) foreach { oldPerm =>
          alreadyExists = true
          if (oldPerm != permission) {
            if (permission.isEverythingUndefined) {
              // latent BUG: not incl info about this deleted perm in the fn result [0YKAG25L]
              transaction.deletePermsOnPages(Seq(permission.id))
            }
            else {
              transaction.updatePermsOnPages(permission)
              permsWithIds.append(permission)
            }
          }
        }
      }
      if (!alreadyExists) {
        val permWithId = transaction.insertPermsOnPages(permission)
        permsWithIds.append(permWithId)
      }
    }
    // latent BUG: not incl info about these deleted perms in the fn result [0YKAG25L]
    transaction.deletePermsOnPages(oldPermissionsById.keys)
    permsWithIds.toVector
  }
}



object CategoriesDao {

  val CategoryDescriptionSource =  // [i18n]
    i"""[Replace this paragraph with a description of the category. Keep it short;
       |the description will be shown on the category list page.]
       |
       |Here, after the first paragraph, you can add more details about the category.
       |"""

}

