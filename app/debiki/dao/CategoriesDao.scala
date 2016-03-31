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
import scala.collection.{immutable, mutable}
import scala.collection.mutable.ArrayBuffer


/** Loads and saves categories.
  */
trait CategoriesDao {
  self: SiteDao =>

  // The dao shouldn't live past the current HTTP request anyway.
  private var categoriesById: Map[CategoryId, Category] = null
  private var categoriesByParentId: mutable.HashMap[CategoryId, ArrayBuffer[Category]] = null


  /** List categories in the site section (forum/blog/whatever) at page pageId.
    * Sorts by Category.position (which doesn't make much sense if there are sub categories).
    * Excludes the root of the category tree.
    */
  def listSectionCategories(pageId: PageId, isStaff: Boolean, restrictedOnly: Boolean)
        : Seq[Category] = {
    loadRootCategory(pageId) match {
      case Some(rootCategory) =>
        listCategoriesInTree(rootCategory.id, includeRoot = false,
          isStaff = isStaff, restrictedOnly = restrictedOnly).sortBy(_.position)
      case None =>
        Nil
    }
  }


  /** List categories with categoryId as their immediate parent.
    */
  def listChildCategories(categoryId: CategoryId, includeUnlisted: Boolean)
        : immutable.Seq[Category] = {
    val categoriesByParentId = loadBuildRememberCategoryMaps()._2
    val children = categoriesByParentId.getOrElse(categoryId, {
      return Nil
    })
    unimplementedIf(!includeUnlisted, "excluding unlisted [EsE4KPKM2]")
    children.to[immutable.Seq]
  }


  /** List all categories in the sub tree with categoryId as root.
    */
  def listCategoriesInTree(categoryId: CategoryId, includeRoot: Boolean,
        isStaff: Boolean, restrictedOnly: Boolean): Seq[Category] = {
    val categories = ArrayBuffer[Category]()
    appendCategoriesInTree(categoryId, includeRoot, isStaff = isStaff,
      restrictedOnly = restrictedOnly, categories)
    categories.to[immutable.Seq]
  }


  /** Lists pages placed directly in one of categoryIds.
    */
  private def listPagesInCategories(categoryIds: Seq[CategoryId], pageQuery: PageQuery, limit: Int)
        : Seq[PagePathAndMeta] = {
    readOnlyTransaction(_.loadPagesInCategories(categoryIds, pageQuery, limit))
  }


  /** Lists pages placed in categoryId, optionally including its descendant categories.
    */
  def listPagesInCategory(categoryId: CategoryId, includeDescendants: Boolean,
        isStaff: Boolean, restrictedOnly: Boolean, pageQuery: PageQuery, limit: Int)
        : Seq[PagePathAndMeta] = {
    val categoryIds =
      if (includeDescendants)
        listCategoriesInTree(categoryId, includeRoot = true,
          isStaff = isStaff, restrictedOnly = restrictedOnly).map(_.id)
      else {
        unimplementedIf(!isStaff, "!incl hidden in forum [EsE2PGJ4]")
        Seq(categoryId)
      }
    listPagesInCategories(categoryIds, pageQuery, limit)
  }


  def loadCategoriesRootLast(categoryId: CategoryId): immutable.Seq[Category] = {
    val categoriesById = loadBuildRememberCategoryMaps()._1
    val categories = ArrayBuffer[Category]()
    var current = categoriesById.get(categoryId)
    while (current.isDefined) {
      categories.append(current.get)
      current = current.get.parentId flatMap categoriesById.get
    }
    categories.to[immutable.Seq]
  }


  def loadCategory(id: CategoryId): Option[Category] =
    loadBuildRememberCategoryMaps()._1.get(id)


  def loadTheCategory(id: CategoryId): Category =
    loadCategory(id) getOrElse throwNotFound("DwE8YUF0", s"No category with id $id")


  def loadRootCategory(categoryId: CategoryId): Option[Category] =
    loadCategoriesRootLast(categoryId).lastOption


  def loadSectionPageId(categoryId: CategoryId): Option[PageId] =
    loadRootCategory(categoryId).map(_.sectionPageId)


  def loadTheSectionPageId(categoryId: CategoryId): PageId =
    loadRootCategory(categoryId).map(_.sectionPageId) getOrDie "DwE804K2"

  def loadSectionPageIdsAsSeq(): Seq[PageId] = {
    loadBuildRememberCategoryMaps()
    categoriesById.values.filter(_.parentId.isEmpty).map(_.sectionPageId).toSeq
  }


  private def loadRootCategory(pageId: PageId): Option[Category] = {
    val categoriesById = loadBuildRememberCategoryMaps()._1
    for ((categoryId, category) <- categoriesById) {
      if (category.sectionPageId == pageId && category.parentId.isEmpty)
        return Some(category)
    }
    None
  }


  private def appendCategoriesInTree(rootCategoryId: CategoryId, includeRoot: Boolean,
      isStaff: Boolean, restrictedOnly: Boolean, categoryList: ArrayBuffer[Category]) {
    if (categoryList.exists(_.id == rootCategoryId)) {
      // COULD log cycle error
      return
    }
    val (categoriesById, categoriesByParentId) = loadBuildRememberCategoryMaps()
    val startCategory = categoriesById.getOrElse(rootCategoryId, {
      return
    })
    val isRestricted = startCategory.unlisted || startCategory.staffOnly
    if (isRestricted && !isStaff)
      return
    if (includeRoot && (!restrictedOnly || isRestricted)) {
      categoryList.append(startCategory)
    }
    val childCategories = categoriesByParentId.getOrElse(rootCategoryId, {
      return
    })
    for (childCategory <- childCategories) {
      appendCategoriesInTree(childCategory.id, includeRoot = true,
        isStaff = isStaff, restrictedOnly = restrictedOnly, categoryList)
    }
  }


  private def loadBuildRememberCategoryMaps(): (Map[CategoryId, Category],
        mutable.HashMap[CategoryId, ArrayBuffer[Category]]) = {
    if (categoriesById ne null)
      return (categoriesById, categoriesByParentId)

    categoriesByParentId = mutable.HashMap[CategoryId, ArrayBuffer[Category]]()
    categoriesById = loadCategoryMap()

    for ((categoryId, category) <- categoriesById; parentId <- category.parentId) {
      val siblings = categoriesByParentId.getOrElseUpdate(parentId, ArrayBuffer[Category]())
      siblings.append(category)
    }

    (categoriesById, categoriesByParentId)
  }

  protected def loadCategoryMap() =
    readOnlyTransaction(_.loadCategoryMap())


  def editCategory(editCategoryData: CreateEditCategoryData,
        editorId: UserId, browserIdData: BrowserIdData): Category = {
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
        staffOnly = editCategoryData.staffOnly,
        updatedAt = transaction.currentTime)
      transaction.updateCategoryMarkSectionPageStale(editedCategory)
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
    refreshPageInAnyCache(oldCategory.sectionPageId)
    refreshPageInAnyCache(editedCategory.sectionPageId)

    editedCategory
  }


  def createCategory(newCategoryData: CreateEditCategoryData, creatorId: UserId,
        browserIdData: BrowserIdData): (Category, PagePath) = {

    val bodyHtmlSanitized = commonmarkRenderer.renderAndSanitizeCommonMark(
      CategoryDescriptionSource, allowClassIdDataAttrs = false, followLinks = true)

    val titleSource = s"About the ${newCategoryData.name} category"
    val titleHtmlSanitized = commonmarkRenderer.sanitizeHtml(titleSource)

    val result = readWriteTransaction { transaction =>
      val categoryId = transaction.nextCategoryId()
      val category = newCategoryData.makeCategory(categoryId, transaction.currentTime)
      transaction.insertCategoryMarkSectionPageStale(category)

      val (aboutPagePath, _) = createPageImpl(
        PageRole.AboutCategory, PageStatus.Published, anyCategoryId = Some(categoryId),
        anyFolder = None, anySlug = Some("about-" + newCategoryData.slug), showId = true,
        titleSource = titleSource,
        titleHtmlSanitized = titleHtmlSanitized,
        bodySource = CategoryDescriptionSource,
        bodyHtmlSanitized = bodyHtmlSanitized,
        pinOrder = Some(ForumDao.AboutCategoryTopicPinOrder),
        pinWhere = Some(PinPageWhere.InCategory),
        authorId = creatorId, browserIdData, transaction)

      // COULD create audit log entry
      (category, aboutPagePath)
    }
    // The forum needs to be refreshed because it has cached the category list
    // (in JSON in the cached HTML).
    refreshPageInAnyCache(result._1.sectionPageId)
    result
  }


  val CategoryDescriptionSource =  // [i18n]
    i"""[Replace this paragraph with a description of the category. Keep it short;
       |the description will be shown on the category list page.]
       |
       |Here, after the first paragraph, you can add more details about the category.
       |"""

}



trait CachingCategoriesDao extends CategoriesDao {
  self: CachingSiteDao =>

  /*
  override def createPage(pageRole: PageRole, pageStatus: PageStatus,
        anyCategoryId: Option[CategoryId], anyFolder: Option[String], anySlug: Option[String],
        titleSource: String, bodySource: String,
        showId: Boolean, authorId: UserId, browserIdData: BrowserIdData)
        : PagePath = {
    val pagePath = super.createPage(pageRole, pageStatus, anyCategoryId,
      anyFolder, anySlug, titleSource, bodySource, showId, authorId, browserIdData)
    firePageCreated(pagePath)
    pagePath
  } */

}

