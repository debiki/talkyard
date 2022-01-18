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
import debiki.EdHttp._
import debiki.{TextAndHtml, TextAndHtmlMaker, TitleSourceAndHtml, MaxLimits}
import talkyard.server.authz.{Authz, ForumAuthzContext, MayMaybe}
import java.{util => ju}
import org.scalactic.{Good, ErrorMessage, Or, Bad}
import scala.collection.{immutable, mutable}
import scala.collection.mutable.ArrayBuffer
import talkyard.server.dao._


case class SectionCategories(
  rootCategory: Category,
  catStuffsExclRoot: immutable.Seq[CategoryStuff]) {

  if (!rootCategory.isRoot) throwIllegalArgument(
    "TyE5AKP036SSD", s"The root category thinks it's not a root category: $rootCategory")

  catStuffsExclRoot.find(_.category.id == rootCategory.id) foreach { badRootCat =>
    throwIllegalArgument(
      "TyE7WKTL02XT4", o"""A category with the same id as the root category is included
        in categoriesExclRoot: $badRootCat""")
  }

  catStuffsExclRoot.find(_.category.isRoot) foreach { badRootCat =>
    throwIllegalArgument(
      "TyE602GPK5R3", s"This category in categoriesExclRoot thinks it's a root cat: $badRootCat")
  }

  catStuffsExclRoot.find(_.category.sectionPageId != rootCategory.sectionPageId) foreach { badCat =>
    throwIllegalArgument(o"""Category $badCat has a different section page id
      than the root cat: $rootCategory [TyE05RMDRYDK4]""")
  }

  catStuffsExclRoot.find(_.category.parentId.isEmpty) foreach { badCat =>
    throwIllegalArgument(s"Category $badCat has no parent cat id [TyE6WKDR203]")
  }

  catStuffsExclRoot.find(c => c.category.parentId.isNot(rootCategory.id) &&
      !catStuffsExclRoot.exists(c2 => c.category.parentId is c2.category.id)
      ) foreach { badCat =>  // [On2]
    throwIllegalArgument("TyE4WHUS25",
      s"Category $badCat has a parent cat in a different site section")
  }

  def sectionPageId: PageId = rootCategory.sectionPageId
  def defaultCategoryId: CategoryId = rootCategory.defaultSubCatId getOrDie "TyE306RD57"
}



/** @param shallBeDefaultCategory — if set, the root category's default category id will be
  *     updated to point to this category.
  * @param createDeletedAboutTopic — creates the About Category topic in a deleted state.
  *     Useful for embedded comments, because then it's not needed — there're no other categories
  *     anyway. However, if the owner changes the site to a comments + also general discussion forum,
  *     then, nice to be able to undelete the About topic, because then it becomes useful.
  */
case class CategoryToSave(
  sectionPageId: PageId,
  parentId: CategoryId,   // RENAME to parentCategoryId ?
  name: String,
  slug: String,
  position: Int,
  // [refactor] [5YKW294] [rename] Should no longer be a list. Change db too, from "nnn,nnn,nnn" to single int.
  newTopicTypes: immutable.Seq[PageType],
  defaultSortOrder: Opt[PageOrderOffset],
  doVoteStyle: Opt[DoVoteStyle],
  doVoteInTopicList: Opt[Bo],
  shallBeDefaultCategory: Boolean,
  unlistCategory: Boolean,
  unlistTopics: Boolean,
  includeInSummaries: IncludeInSummaries,
  description: String,
  createDeletedAboutTopic: Boolean = false,
  extId: Option[ExtId] = None,
  anyId: Option[CategoryId] = None) { // Some() if editing, < 0 if creating COULD change from Option[CategoryId] to CategoryId

  // -------Check cat slug, name, ext id: [05970KF5]----------------
  // (dupl code, will disappear when replacing CategoryToSave with CategoryPatch)

  require(anyId isNot NoCategoryId, "EdE5LKAW0")

  Validation.findCategoryNameProblem(name) foreach { problem =>
    throwIllegalArgument("TyE305RKDTW01", s"Bad category name: $problem")
  }

  Validation.findCategorySlugProblem(slug) foreach { problem =>
    throwIllegalArgument("TyE305RKDTW02", s"Bad category slug: $problem")
  }

  extId.flatMap(Validation.findExtIdProblem) foreach { problem =>
    throwIllegalArgument("TyE305RKDTW03", s"Bad category extId: $problem")
  }
  // ---------------------------------------------------------------

  def isNewCategory: Boolean = anyId.exists(_ < 0)

  def makeAboutTopicTitle(): TitleSourceAndHtml =
    TitleSourceAndHtml(s"Description of the $name category")  // sync with the upserter [G204MF3]  I18N

  def makeAboutTopicBody(textAndHtmlMaker: TextAndHtmlMaker): TextAndHtml =
    textAndHtmlMaker.forBodyOrComment(description) // COULD follow links? Only staff can create categories [WHENFOLLOW]

  def makeCategory(id: CatId, createdAt: ju.Date): Cat = Cat(
    id = id,
    extImpId = extId,
    sectionPageId = sectionPageId,
    parentId = Some(parentId),
    defaultSubCatId = None,
    name = name,
    slug = slug,
    position = position,
    description = {
      val untilNewline = description.trim.takeWhile(_ != '\n').trim
      if (untilNewline.isEmpty) None
      else Some(untilNewline)
    },
    newTopicTypes = newTopicTypes,
    defaultSortOrder = defaultSortOrder,
    doVoteStyle = doVoteStyle,
    doVoteInTopicList = doVoteInTopicList,
    unlistCategory = unlistCategory,
    unlistTopics = unlistTopics,
    includeInSummaries = includeInSummaries,
    createdAt = createdAt,
    updatedAt = createdAt)

}


object CategoryToSave {
  def initFrom(cat: Cat, makeDefault: Bo = false): CategoryToSave = {
    CategoryToSave(
          sectionPageId = cat.sectionPageId,
          parentId = cat.parentId getOrDie "TyE406RKT3",
          name = cat.name,
          slug = cat.slug,
          position = cat.position,
          newTopicTypes = cat.newTopicTypes,
          defaultSortOrder = cat.defaultSortOrder,
          doVoteStyle = cat.doVoteStyle,
          doVoteInTopicList = cat.doVoteInTopicList,
          shallBeDefaultCategory = makeDefault,
          unlistCategory = cat.unlistCategory,
          unlistTopics = cat.unlistTopics,
          includeInSummaries = cat.includeInSummaries,
          description = cat.description getOrDie "TyE7P03SJ35",
          createDeletedAboutTopic = false,
          extId = cat.extImpId,
          anyId = Some(cat.id))
  }
}



case class CreateCategoryResult(
  category: Category,
  pagePath: PagePathWithId,
  permissionsWithIds: immutable.Seq[PermsOnPages])



case class SavePermsResult(
  permsWithIds: immutable.Seq[PermsOnPages],
  wasChangesMade: Bo)



/** Loads and saves categories.
  */
trait CategoriesDao {
  self: SiteDao =>


  // The dao shouldn't live past the current HTTP request anyway.
  private var categoriesById: Map[CategoryId, Category] = _
  private var categoriesByParentId: Map[CategoryId, Vector[Category]] = _
  private var rootCategories: Seq[Category] = _


  /** BUG [4GWRQA28] For now, if many sub communities: Returns a random default category
    * (currently only used when creating embedded comments — and using both emb comments
    * & sub communities = no one does, right now. So this is not urgent.)
    */
  def getDefaultCategoryId(): CategoryId = {
    COULD_OPTIMIZE // remember default category, refresh when saving a root category?
    getAndRememberCategories()
    dieIf(rootCategories.isEmpty, "TyE2FWBK5")
    rootCategories.head.defaultSubCatId getOrDie "TyE2KQBP6"
  }


  def getCategory(categoryId: CategoryId): Option[Category] = {
    getCategoryAndRoot(categoryId).map(_._1)
  }

  def getCategoryByRef(ref: Ref): Option[Category] Or ErrorMessage = {
    parseRef(ref, allowParticipantRef = false) map getCategoryByParsedRef
  }

  def getOrThrowAnyCategoryByRef(catRef: Ref): Category = {
    val any = getCategoryByRef(catRef).getOrIfBad { problem =>
      throwBadRequest("TyEBADCATRF", s"Bad category ref: $problem")
    }
    any getOrElse {
      throwNotFound("TyE404CATRF", s"Category not found, category ref: '$catRef'")
    }
  }

  def getCategoryByParsedRef(parsedRef: ParsedRef): Option[Category] = {
    val cats = getAllCategories()
    parsedRef match {
      case ParsedRef.ExternalId(extId) =>
        cats.find(_.extImpId is extId)
      case ParsedRef.TalkyardId(tyId) =>
        val catId = tyId.toIntOption getOrElse { return None }
        cats.find(_.id == catId)
      case _ =>
        None
    }
  }


  def getAllCategories(): Vector[Category] = {
    getCatsById().values.toVector
  }


  def getCatsById(): Map[CatId, Cat] = {
    getAndRememberCategories()._1
  }


  /** List categories in the site section (forum/blog/whatever) at page pageId.
    * Sorts by Category.position (hmm doesn't make much sense if there are sub categories [subcats]).
    */
  def listMaySeeCategoriesInSection(sectionPageId: PageId, includeDeleted: Boolean,
        authzCtx: ForumAuthzContext): Option[SectionCategories] = {
    getRootCategoryForSectionPageId(sectionPageId) map { rootCategory =>
      makeSectCatStuffs(rootCategory, includeDeleted, authzCtx)
    }
  }


  def listMaySeeCategoriesAllSections(includeDeleted: Boolean, authzCtx: ForumAuthzContext)
        : Seq[Category] = {
    listMaySeeCategoryStuffAllSections(
      includeDeleted = false, authzCtx).flatMap(_.catStuffsExclRoot.map(_.category))
  }


  def listMaySeeCategoryStuffAllSections(includeDeleted: Boolean, authzCtx: ForumAuthzContext)
        : Seq[SectionCategories] = {
    getAndRememberCategories()
    val result = ArrayBuffer[SectionCategories]()
    for (rootCategory <- rootCategories) {
      val sectCats = makeSectCatStuffs(rootCategory, includeDeleted = includeDeleted, authzCtx)
      result.append(sectCats)
    }
    result
  }


  /** Returns (categories, root-category).
    */
  def listMaySeeCategoriesInSameSectionAs(categoryId: CategoryId, authzCtx: ForumAuthzContext)
        : Option[SectionCategories] = {
    getAndRememberCategories()
    if (rootCategories.isEmpty)
      return None

    val rootCategory = getRootCategoryForCategoryId(categoryId) getOrDie "TyEPKDRW0"
    val sectCats = makeSectCatStuffs(rootCategory, includeDeleted = authzCtx.isStaff, authzCtx)
    Some(sectCats)
  }


  private def makeSectCatStuffs(rootCategory: Category, includeDeleted: Bo,
        authzCtx: ForumAuthzContext): SectionCategories = {
    COULD_OPTIMIZE // why not cache this? Or this [cache_cats_stuff]?
    // Doesn't include recent topics,
    // so should be fine? With whole server feature flag, in case of bugs.
    // But first find out if this actually takes time. Usually no db access anyway.

    val categories = listDescendantMaySeeCategories(rootCategory.id, includeRoot = false,
      includeDeleted = includeDeleted, inclCatsWithTopicsUnlisted = true, authzCtx).sortBy(_.position)

    val catStuffs = categories map { category =>
      makeCatStuff(category)
    }

    SectionCategories(
      rootCategory = rootCategory,
      catStuffsExclRoot = catStuffs)
  }


  /** Loads info about the category: its description [502RKDJWF5], any thumbnail url.
    * Maybe activity statistics later?
    */
  private def makeCatStuff(category: Category): CategoryStuff = {
    COULD_OPTIMIZE // cache this or that: [cache_cats_stuff]?
    val anyAboutPageId = getAboutCategoryPageId(category.id)
    val anyAboutPageStuff = getPageStuffById(anyAboutPageId).values.headOption
    val excerpt = anyAboutPageStuff.flatMap(_.bodyExcerpt) getOrElse ""
    val imageUrls = anyAboutPageStuff.map(_.bodyImageUrls) getOrElse Nil
    CategoryStuff(category, excerpt, imageUrls)
  }


  /** List all categories in the sub tree with categoryId as root.
    */
  private def listDescendantMaySeeCategories(categoryId: CategoryId, includeRoot: Boolean,
        includeDeleted: Boolean, inclCatsWithTopicsUnlisted: Boolean,
        authzCtx: ForumAuthzContext): immutable.Seq[Category] = {
    val categories = ArrayBuffer[Category]()
    appendMaySeeCategoriesInTree(categoryId, includeRoot = includeRoot, includeDeleted = includeDeleted,
        inclCatsWithTopicsUnlisted = inclCatsWithTopicsUnlisted, authzCtx, categories)
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
        // a category in the forum, wich has sub categories). The top root shouldn't
        // contain any pages, but subtree roots usually contain pages.)
        listDescendantMaySeeCategories(categoryId, includeRoot = true,
            includeDeleted = pageQuery.pageFilter.includeDeleted,
            inclCatsWithTopicsUnlisted = false, authzCtx).map(_.id)
      }
      else {
        SECURITY // double-think-through this:
        // No this is fine, we're nowadays testing below, with Authz.maySeePage(..).
        // unimplementedIf(!authzCtx.isStaff, "!incl hidden in forum [EsE2PGJ4]")
        Seq(categoryId)
      }

    val okCategoryIds =
      if (pageQuery.pageFilter.filterType != PageFilterType.ForActivitySummaryEmail)
        maySeeCategoryIds
      else
        maySeeCategoryIds filter { id =>
          val category = categoriesById.get(id)
          category.map(_.includeInSummaries) isNot IncludeInSummaries.NoExclude
        }

    // Although we may see these categories, we might not be allowed to see all pages therein.
    // So, both per-category and per-page authz checks.
    val pagesInclForbidden = loadPagesDirectlyInCategories(okCategoryIds, pageQuery, limit)

    // For now. COULD do some of filtering in the db query instead, so won't find 0 pages
    // just because all most-recent-pages are e.g. hidden.
    val filteredPages = pagesInclForbidden filter { page =>
      val categories = getAncestorCategoriesRootLast(page.categoryId)
      val may = talkyard.server.authz.Authz.maySeePage(
            page.meta,
            user = authzCtx.requester,
            groupIds = authzCtx.groupIdsUserIdFirst,
            pageMembers = getAnyPrivateGroupTalkMembers(page.meta),
            catsRootLast = categories,
            tooManyPermissions = authzCtx.tooManyPermissions,
            maySeeUnlisted = false) // pageQuery.pageFilter.includesUnlisted
      may == MayMaybe.Yes
    }

    filteredPages
  }


  def listMaySeeTopicsInclPinned(categoryId: CategoryId, pageQuery: PageQuery,
        includeDescendantCategories: Boolean, authzCtx: ForumAuthzContext, limit: Int)
        : Seq[PagePathAndMeta] = {
    COULD_OPTIMIZE // could cache

    // COULD instead of PagePathAndMeta use some "ListedPage" class that also includes  [7IKA2V]
    // the popularity score, + doesn't include stuff not needed to render forum topics etc.
    SECURITY; TESTS_MISSING  // securified

    val topics: Seq[PagePathAndMeta] = loadMaySeePagesInCategory(
      categoryId, includeDescendantCategories, authzCtx,
      pageQuery, limit)

    // If sorting by bump time, sort pinned topics first. Otherwise, don't.
    // (Could maybe show pinned topics if sorting by newest-first? Flarum & Discourse don't though.)
    val topicsInclPinned = pageQuery.orderOffset match {
      case orderOffset: PageOrderOffset.ByBumpTime if orderOffset.offset.isEmpty =>
        val pinnedTopics = loadMaySeePagesInCategory(
          categoryId, includeDescendantCategories, authzCtx,
          pageQuery.copy(orderOffset = PageOrderOffset.ByPinOrderLoadOnlyPinned), limit)
        val notPinned = topics.filterNot(topic => pinnedTopics.exists(_.id == topic.id))
        val topicsSorted = (pinnedTopics ++ notPinned) sortBy { topic =>
          val meta = topic.meta
          val pinnedGlobally = meta.pinWhere.contains(PinPageWhere.Globally)
          val pinnedInThisCategory = meta.isPinned && meta.categoryId.contains(categoryId)
          val isPinned = pinnedGlobally || pinnedInThisCategory
          if (isPinned) topic.meta.pinOrder.get // 1..100
          else Long.MaxValue - topic.meta.bumpedOrPublishedOrCreatedAt.getTime // much larger
        }
        topicsSorted
      case _ => topics
    }

    topicsInclPinned
  }


  def getAncestorCategoriesRootLast(anyCategoryId: Option[CategoryId]): Vector[Category] = {
    val id = anyCategoryId getOrElse {
      return Vector.empty
    }
    getAncestorCategoriesRootLast(id)
  }


  CLEAN_UP // remove default val for inclSelfFirst
  def getAncestorCategoriesRootLast(categoryId: CategoryId, inclSelfFirst: Bo = true,
          anyTx: Opt[SiteTx] = None)
          : Vec[Category] = {
    val catsById =
            anyTx.map(_.loadCategoryMap()) getOrElse
            getAndRememberCategories()._1

    CatAlgs.getAncestorCatsRootLast(categoryId, catsById, inclSelfFirst = inclSelfFirst)
          .getOrIfBad(errMsg => die("TyECATLOOP", s"s$siteId: $errMsg"))
  }


  /** Returns (category, is-default).
    */
  def getCategoryAndRoot(id: CategoryId): Option[(Category, Category)] = {
    val catsStuff = getAndRememberCategories()
    val catsById = catsStuff._1
    val anyCategory = catsById.get(id)
    anyCategory map { category =>
      val anyRootCategory = rootCategories.find(_.sectionPageId == category.sectionPageId)
      (category, anyRootCategory getOrDie "TyE205KJF45")
    }
  }


  // Some time later: Add a site section page id? So will load the correct category, also
  // if there're many sub communities with the same category slug.
  def getCategoryBySlug(slug: String): Option[Category] = {
    val catsStuff = getAndRememberCategories()
    catsStuff._1.values.find(_.slug == slug)
  }


  def getTheCategoryStuffAndRoot(id: CategoryId): (CategoryStuff, Category) = {
    val (cat, rootCat) = getCategoryAndRoot(id) getOrElse throwNotFound(
      "TyE830DLYUF0", s"s$siteId: No category with id $id")
    val catStuff = makeCatStuff(cat)
    (catStuff, rootCat)
  }


  private def getRootCategoryForCategoryId(categoryId: CategoryId): Option[Category] =
    getAncestorCategoriesRootLast(categoryId).lastOption


  def getSectionPageId(categoryId: CategoryId): Option[PageId] =
    getRootCategoryForCategoryId(categoryId).map(_.sectionPageId)


  def getTheSectionPageId(categoryId: CategoryId): PageId =
    getRootCategoryForCategoryId(categoryId).map(_.sectionPageId) getOrDie "DwE804K2"


  def getAboutCategoryPageId(categoryId: CategoryId): Option[PageId] = {
    memCache.lookup(
      aboutPageIdByCatIdKey(categoryId),
      orCacheAndReturn = Some({
        // This never changes.
        readOnlyTransaction(_.loadAboutCategoryPageId(categoryId))
      })).get
  }


  def getRootCategories(): immutable.Seq[Category] = {
    val categoriesById = getAndRememberCategories()._1
    categoriesById.values.filter(_.parentId isEmpty).toVector
  }


  private def getRootCategoryForSectionPageId(sectionPageId: PageId): Option[Category] = {
    val categoriesById = getAndRememberCategories()._1
    for ((_, category) <- categoriesById) {
      if (category.sectionPageId == sectionPageId && category.parentId.isEmpty)
        return Some(category)
    }
    None
  }


  private def appendMaySeeCategoriesInTree(rootCategoryId: CatId, includeRoot: Bo,
      includeDeleted: Bo,
      inclCatsWithTopicsUnlisted: Bo,
      authzCtx: ForumAuthzContext, categoryList: ArrayBuffer[Category]): Unit = {

    if (categoryList.exists(_.id == rootCategoryId)) {
      // COULD log cycle error
      return
    }

    val (categoriesById, categoriesByParentId) = getAndRememberCategories()
    val startCategory = categoriesById.getOrElse(rootCategoryId, {
      return
    })

    val catsRootLast = getAncestorCategoriesRootLast(rootCategoryId)

    // May we see this category?
    // (Could skip checking the ancestors again, when we've recursed into a child category.)
    // (Skip the root category in this check; cannot set permissions on it. [0YWKG21])
    if (!catsRootLast.head.isRoot) {
      val may = Authz.maySeeCategory(authzCtx, catsRootLast = catsRootLast)
      if (may.maySee isNot true)
        return
    }

    if (!includeDeleted && startCategory.isDeleted)
      return

    COULD // add a [maySeeUnlisted] permission? If in a cat, a certain group should see unlisted topics.
    val onlyForStaff = startCategory.unlistCategory || startCategory.isDeleted  // [5JKWT42]
    if (onlyForStaff && !authzCtx.isStaff)
      return

    if (includeRoot)
      categoryList.append(startCategory)

    val childCategories = categoriesByParentId.getOrElse(rootCategoryId, {
      return
    })
    for (childCategory <- childCategories;
         if !childCategory.unlistTopics || inclCatsWithTopicsUnlisted) {
      appendMaySeeCategoriesInTree(childCategory.id, includeRoot = true, includeDeleted = includeDeleted,
        inclCatsWithTopicsUnlisted = inclCatsWithTopicsUnlisted, authzCtx, categoryList)
    }
  }


  /** Returns (categoriesById, categoriesByParentId).
    */
  private def getAndRememberCategories()
        : (Map[CategoryId, Category], Map[CategoryId, Vector[Category]]) = {
    // We already remember?
    if (categoriesById ne null) {
      dieIf(rootCategories eq null, "TyE046DMR2")
      dieIf(categoriesByParentId eq null, "TyE046DMR3")
      return (categoriesById, categoriesByParentId)
    }

    // Didn't remember. Get from cache.
    val result: (Map[CategoryId, Category], Map[CategoryId, Vector[Category]]) = memCache.lookup(
      allCategoriesKey,
      orCacheAndReturn = Some({
        loadCategories()
      })).get

    // Remember.
    categoriesById = result._1
    categoriesByParentId = result._2
    rootCategories = categoriesById.values.filter(_.isRoot).toVector
    result
  }


  private def loadCategories()
        : (Map[CategoryId, Category], Map[CategoryId, Vector[Category]]) = {
    val catsById: Map[CategoryId, Category] = readOnlyTransaction(tx => {
      tx.loadCategoryMap()
    })

    val catsByParentId = mutable.HashMap[CategoryId, ArrayBuffer[Category]]()

    for ((_, category) <- catsById; parentId <- category.parentId) {
      val siblings = catsByParentId.getOrElseUpdate(parentId, ArrayBuffer[Category]())
      siblings.append(category)
    }

    val catsByParentIdImmutable = Map.apply(catsByParentId.mapValues(_.toVector).toSeq: _*)
    (catsById, catsByParentIdImmutable)
  }


  def uncacheAllCategories(): Unit = {
    memCache.remove(allCategoriesKey)
  }


  def editCategory(editsToDo: CategoryToSave, permissions: immutable.Seq[PermsOnPages],
        who: Who): Category = {
    val (catBef, catAft, permissionsChanged) = readWriteTransaction { tx =>
      val limits = getMaxLimits(UseTx(tx))
      val catId = editsToDo.anyId getOrDie "DwE7KPE0"
      val catBef = tx.loadCategory(catId).getOrElse(throwNotFound(
        "DwE5FRA2", s"Category not found, id: $catId"))

      BUG // Harmless: If changing parent category, the topic counts will be wrong.
      // Could just remove all counts, barely matters? [NCATTOPS]  [subcats]

      val catAft = catBef.copy(
            extImpId = editsToDo.extId,
            parentId = Some(editsToDo.parentId),
            sectionPageId = editsToDo.sectionPageId,
            name = editsToDo.name,
            slug = editsToDo.slug,
            position = editsToDo.position,
            newTopicTypes = editsToDo.newTopicTypes,
            defaultSortOrder = editsToDo.defaultSortOrder,
            doVoteStyle = editsToDo.doVoteStyle,
            doVoteInTopicList = editsToDo.doVoteInTopicList,
            unlistCategory = editsToDo.unlistCategory,
            unlistTopics = editsToDo.unlistTopics,
            includeInSummaries = editsToDo.includeInSummaries,
            updatedAt = tx.now.toJavaDate)

      // This won't detect if the whole tree gets too deep because a sub tree gets
      // moved — we'll check that just below, in findAnyCatsTreeProblem()  [.7M27J525]
      val ancCats = getAndCheckAncestorCatsThrowIfProblem(catAft, tx)

      if (editsToDo.shallBeDefaultCategory) {
        setDefaultCat(catAft, ancCats, tx)
      }

      // (Could skip marking page stale, if only newTopicTypes or ext id changed)
      tx.updateCategoryMarkSectionPageStale(catAft)

      // Check if any sub tree to deep. [.7M27J525]
      val catMapAft = tx.loadCategoryMap()
      CatAlgs.findCatsTreeProblem(catMapAft, startWith = Some(catAft)) ifProblem { p =>
        throwForbidden("TyEBADCATS02", s"$siteId: Categories problem: ${p.message}")
      }

      AUDIT_LOG // fix later

      val savePermsResult =
            __savePermsOnCat(catId, permissions)(tx, limits) getOrIfBad { err =>
              throwForbidden("TyEEDCATPRM", err)
            }

      (catBef, catAft, savePermsResult.wasChangesMade)
    }

    val nameChanged = catBef.name != catAft.name
    val ancestorCatsChanged = catBef.parentId != catAft.parentId
    TESTS_MISSING // Move cat to other cat [TyTE2E305TMP24Z]

    if (nameChanged || ancestorCatsChanged || permissionsChanged) {
      // All pages in this category need to be regenerated, because its name and
      // the names of its ancestor categories are included on the pages.
      //
      // Or if permissions edited: Hard to know precisely which pages are affected,
      // so just empty the whole cache. — Not only pages in `editedCategory` are
      // affected, but also pages *linked from* those pages, since Talkyard shows
      // which other topics link to a topic. And if one of those linking topics
      // becomes access-restricted, then, the linked topic needs to be uncached
      // and rerendered, so the link disappears.  [cats_clear_cache]
      //
      clearDatabaseCacheAndMemCache()
    }
    else {
      // Since this category was edited:
      uncacheAllCategories()
    }

    // Do this even if we just emptied the cache above, because then the forum page
    // will be regenerated earlier.
    refreshPageInMemCache(catBef.sectionPageId)
    refreshPageInMemCache(catAft.sectionPageId)

    catAft
  }


  def createCategory(newCategoryData: CategoryToSave, permissions: immutable.Seq[PermsOnPages],
        byWho: Who): CreateCategoryResult = {
    val result = writeTx { (tx, staleStuff) =>
      createCategoryImpl(newCategoryData, permissions, byWho)(tx, staleStuff)
    }
    // Need to reload permissions and categories, so this new category and its permissions
    // also get included.
    uncacheAllPermissions()
    uncacheAllCategories()
    // Refresh the forum topic list page; it has cached the category list (in JSON in the cached HTML).
    refreshPageInMemCache(result.category.sectionPageId)
    result
  }


  def createCategoryImpl(newCategoryData: CategoryToSave, permissions: ImmSeq[PermsOnPages],
        byWho: Who)(tx: SiteTx, staleStuff: StaleStuff): CreateCategoryResult = {

    val limits = getMaxLimits(UseTx(tx))

    val categoryId = tx.nextCategoryId()  // [4GKWSR1]
    newCategoryData.anyId foreach { id =>
      if (id < 0) {
        // Fine, this means we're to choose an id here. The requester specifies
        // a category id < 0, so the permissions also being saved can identify the
        // category they are about.
      }
      else {
        dieIf(id == 0, "TyE2WBP8")
        dieIf(id != categoryId, "TyE4GKWRQ", o"""transaction.nextCategoryId() = $categoryId
            but newCategoryData.anyId is ${newCategoryData.anyId.get}, site id $siteId""")
      }
    }

    // Can remove this later, when I think I won't want to add more cat perms via db migrations.
    // Edit: What? Why? I don't understand my own comment. Keep the limits I think.
    val maxCats = limits.maxCategories
    throwForbiddenIf(categoryId > maxCats, "TyE2MNYCATS_",
          s"Too many categories, $categoryId > $maxCats") // see [B0GKWU52]

    val category = newCategoryData.makeCategory(categoryId, tx.now.toJavaDate)
    val ancCats = getAndCheckAncestorCatsThrowIfProblem(category, tx)  // [.920946]

    tx.insertCategoryMarkSectionPageStale(category)

    COULD_OPTIMIZE // get as an arg instead?
    val site: Site = tx.loadSite getOrDie "TyE0MWWNJ25"

    val titleSourceAndHtml = newCategoryData.makeAboutTopicTitle()
    val bodyTextAndHtml = newCategoryData.makeAboutTopicBody(textAndHtmlMakerNoTx(site))

    val aboutPagePath = createPageImpl(
        PageType.AboutCategory, PageStatus.Published, anyCategoryId = Some(categoryId),
        anyFolder = None, anySlug = Some("about-" + newCategoryData.slug), showId = true,
        title = titleSourceAndHtml, body = bodyTextAndHtml,
        pinOrder = None, pinWhere = None,
        byWho, spamRelReqStuff = None,
        // We'll notify about this whole category, not its about page.
        skipNotfsAndAuditLog = true,
        // if createDeletedAboutTopic, then TESTS_MISSING [5WAKR02], e2e test won't get created.
        createAsDeleted = newCategoryData.createDeletedAboutTopic,
        )(tx, staleStuff)._1

    if (newCategoryData.shallBeDefaultCategory) {
      setDefaultCat(category, ancCats, tx)
    }

    permissions foreach { p =>
      dieIf(p.onCategoryId != newCategoryData.anyId, "EdE7UKW02")
    }

    val effPerms = permissions.filter(_.hasSomeEffect)
    val permsWithCatId = effPerms.map(_.copy(onCategoryId = Some(categoryId)))
    val savePermsResult =
          __savePermsOnCat(categoryId, permsWithCatId)(tx, limits)
              .getOrIfBad { err =>
                throwForbidden("TyECATPERMS", err)
              }

    if (byWho.isSystem) {
      // Then this category is being auto generated as part of creating
      // the site, or adding a sub community. We'll notify about that
      // high level thing instead, elsewhere.
      // (See createDefaultCategoriesAndTopics() in ForumDao.)
    }
    else {
      AUDIT_LOG
      COULD // notify other staff? admins? who wants to know about new cats?
      //val notfs = notfGenerator(tx).generateForNew Category (...)  [nice_notfs]
    }

    // Not needed — checked above [.920946], but anyway.
    val catMap = tx.loadCategoryMap()
    CatAlgs.findCatsTreeProblem(catMap, startWith = Some(category)) ifProblem { p =>
      throwForbidden("TyEBADCATS01", s"$siteId: Categories problem: ${p.message}")
    }

    CreateCategoryResult(category, aboutPagePath, savePermsResult.permsWithIds)
  }


  private def getAndCheckAncestorCatsThrowIfProblem(cat: Cat, tx: SiteTx): Vec[Cat] = {
    // Check for cycles, if we're moving the cat to another parent cat.
    val ancestorCats: Vec[Cat] = getAncestorCategoriesRootLast(
          cat.parentId.getOrDie("TyE503MRKDG47"), inclSelfFirst = true, Some(tx))

    // Cycle?
    // (Do the cycle test first, so know it works — later when allowing sub sub cats.)
    ancestorCats.find(_.id == cat.id) foreach { c: Cat =>
      throwForbidden("TyECATCYCL03_",
            s"""Cannot make category ${c.idName}" a sub cat of its descendants""")
    }

    // Sub-sub cat?
    // Base cats has 1 ancestor: the root cat. Sub cats have 2, sub sub cats have 3.
    throwForbiddenIf(ancestorCats.length > CatAlgs.MaxCatAncestors,
          "TyECATDEPTH3A_", "Sub sub categories not yet supported")

    // Wrong site section?
    ancestorCats.find(_.sectionPageId != cat.sectionPageId) foreach { c: Cat =>
      throwForbidden("TyECATSECT05_",
            s"""Category ${cat.idName} cannot be in site section ${
            cat.sectionPageId}, that'd be different from ancestor
            cat ${c.idName} which is in site section ${c.sectionPageId}""")
    }

    // Bad section page? [ck_cat_sect_pg]
    def cannotPlace =
      s"Cannot place category ${cat.idName} in site section page: ${cat.sectionPageId}"
    val sectPage = tx.loadPageMeta(cat.sectionPageId) getOrElse {
      throwForbidden("TyESECTPG0FND", cannotPlace + " — page does not exist")
    }
    throwForbiddenIf(!sectPage.pageType.isSection,
          "TyESECTPG0SECT", cannotPlace + " — it's not a section page")
    throwForbiddenIf(sectPage.isDeleted,
          "TyESECTPGDLD", cannotPlace + " — it's been deleted")

    ancestorCats
  }


  def deleteUndeleteCategory(categoryId: CategoryId, delete: Boolean, who: Who): Unit = {
    readWriteTransaction { tx =>
      deleteUndelCategoryImpl(categoryId, delete = delete, who)(tx)
    }
    COULD_OPTIMIZE // clear less — see comment in deleteUndelCategoryImpl
    memCache.clearThisSite()
  }


  CLEAN_UP // change  delete: Boolean to case objects Delete and Undelete.
  def deleteUndelCategoryImpl(categoryId: CategoryId, delete: Boolean, who: Who)(
        tx: SiteTx): Unit = {

    throwForbiddenIf(!tx.isAdmin(who.id), "EdEGEF239S", "Not admin")

    val categoryBefore = tx.loadCategory(categoryId) getOrElse throwNotFound(
          "EdE5FK8E2", s"No category with id $categoryId")
    val categoryAfter = categoryBefore.copy(
          deletedAt = if (delete) Some(tx.now.toJavaDate) else None)

    tx.updateCategoryMarkSectionPageStale(categoryAfter)

    // All pages in the category now needs to be rerendered.
    // And pages *linked from* pages in the categories — for the correct
    // backlinks to appear.
    COULD_OPTIMIZE // only remove-from-cache / mark-as-dirty pages inside the category,
    // plus linked pages — but that's not so easy? Wait with that.  [cats_clear_cache]
    //emptyCache()
    tx.bumpSiteVersion()
  }


  private def setDefaultCat(category: Cat, ancCatsRootLast: Vec[Cat], tx: SiteTx): U = {
    dieIf(ancCatsRootLast.headOption.map(_.id) != category.parentId, "TyE50RJ45")
    val rootCategory = ancCatsRootLast.lastOption getOrDie "EsE2PK8O4"
    if (rootCategory.defaultSubCatId.contains(category.id))
      return ()
    val rootWithNewDefault = rootCategory.copy(defaultSubCatId = Some(category.id))
    // (The section page will be marked as stale anyway;
    // doesn't matter if we do it here too.)
    tx.updateCategoryMarkSectionPageStale(rootWithNewDefault)
  }


  private def __savePermsOnCat(categoryId: CatId,
        permissions: immutable.Seq[PermsOnPages])(tx: SiteTx, lims: MaxLimits)
        : SavePermsResult Or ErrMsg = {

    dieIf(permissions.exists(_.onCategoryId.isNot(categoryId)), "EdE2FK0YU5")

    val permsWithIds = ArrayBuffer[PermsOnPages]()
    val oldPermissionsById: mutable.Map[PermissionId, PermsOnPages] =
      tx.loadPermsOnCategory(categoryId).map(p => (p.id, p))(collection.breakOut)
    var wasChangesMade = false

    permissions foreach { permission =>
      var alreadyExists = false
      if (permission.id >= PermissionAlreadyExistsMinId) {
        oldPermissionsById.remove(permission.id) foreach { oldPerm =>
          alreadyExists = true
          if (oldPerm != permission) {
            wasChangesMade = true
            if (permission.hasNoEffect) {
              // latent BUG: not incl info about this deleted perm in the fn result [0YKAG25L]
              tx.deletePermsOnPages(Seq(permission.id))
            }
            else {
              // If in the user interface we added perms for the same group twice,
              // that'd violate permsonpages_on_cat_u — but the UI doesn't allow that.
              COULD // be nice to return 403 Forbidden instead of Internal Error
              // if that somehow still happened.
              tx.updatePermsOnPages(permission)
              permsWithIds.append(permission)
            }
          }
        }
      }

      if (!alreadyExists && permission.hasSomeEffect) {
        wasChangesMade = true
        val permWithId = tx.insertPermsOnPages(permission)
        permsWithIds.append(permWithId)
      }
    }

    // latent BUG: not incl info about these deleted perms in the fn result [0YKAG25L]
    tx.deletePermsOnPages(oldPermissionsById.keys)
    wasChangesMade ||= oldPermissionsById.nonEmpty

    // Too many permission settings, afterwards?
    val permsAfter = tx.loadPermsOnPages()
    val maxPerms = lims.maxPermsPerSite
    if (permsAfter.length > maxPerms)
      return Bad(o"""Cannot save ${permissions.length} permissions
            would result in ${permsAfter.length} permissions in total, but
            $maxPerms is max [TyEMNYPERMS]""")

    Good(SavePermsResult(
          permsWithIds = permsWithIds.toVector,
          wasChangesMade = wasChangesMade))
  }


  private def aboutPageIdByCatIdKey(categoryId: CategoryId) =
    debiki.dao.MemCacheKey(siteId, s"$categoryId|AbtPgId")

  private val allCategoriesKey = debiki.dao.MemCacheKey(siteId, "AllCats")

}



object CategoriesDao {

  val CategoryDescriptionSource = /* [i18n] */  i"""
    |[Replace this with a short description of the category.]
    |
    |By clicking the <span class="icon-edit"></span> Edit button just below.
    |"""

}



object CatAlgs {

  /* The root cat, base cats and sub cats. But sub sub cats not yet supported. */
  val MaxCatTreeDepth: i32 = 3
  val MaxCatAncestors: i32 = MaxCatTreeDepth - 1

  def findCatsTreeProblem(catsById: Map[CatId, Cat], startWith: Opt[Cat] = None)
          : AnyProblem = {
    // Just for better error messages.
    startWith.foreach { cat =>
      getAncestorCatsRootLast(cat.id, catsById, inclSelfFirst = false) ifBad { errMsg =>
        return Problem(errMsg, siteId = NoSiteId)
      }
    }

    // This is simple, and faster than fast enough (as of 2021-02).
    for (cat <- catsById.values) {
      getAncestorCatsRootLast(cat.id, catsById, inclSelfFirst = false) match {
        case Bad(errMsg) =>
          // A cycle.
          return Problem(errMsg, siteId = NoSiteId)

        case Good(ancCats) =>
          // Any cycle? — Cannot happen, getAncCatsRootLast() would have returned Bad.
          val catAsOwnAncestor = ancCats.find(c => c.id == cat.id)
          dieIf(catAsOwnAncestor.isDefined, o"""Category cycle: Category ${
                cat.idName} would be its own ancestor [TyECATCYCL07_]""")

          // Different sections?
          val wrongSectionCat = ancCats.find(c => c.sectionPageId != cat.sectionPageId)
          wrongSectionCat foreach { ancCat =>
            return Problem(o"""Category ${ancCat.idName} is an ancestor of
                 category ${cat.idName} but they're in different site sections:
                 ${ancCat.sectionPageId} and ${cat.sectionPageId}, respectively.
                 However, since they are in the same category tree,
                 they must be in the same site section. [TyECATSECT08_]""",
                 siteId = NoSiteId)
          }

          // Too deep?
          if (ancCats.length > MaxCatAncestors)
            return Problem(o"""Sub sub cats not supported: Category ${cat.idName},
                 has > $MaxCatAncestors ancestors [TyECATDEPTH3B_]""", siteId = NoSiteId)
      }
    }

    Fine
  }


  def getAncestorCatsRootLast(categoryId: CatId, catsById: Map[CatId, Cat],
          inclSelfFirst: Bo = true): Vec[Cat] Or ErrMsg = {
    val categories = ArrayBuffer[Cat]()
    val startCat = catsById.get(categoryId)
    var current = startCat
    if (!inclSelfFirst) {
      current = current.flatMap(c => c.parentId flatMap catsById.get)
    }
    var lapNr = 0
    while (current.isDefined) {
      if (lapNr > catsById.size)
        return Bad(s"Category ancestors cycle involving category ${
              startCat.get.idName} [TyECATCYCL03_]")
      lapNr += 1
      categories.append(current.get)
      current = current.get.parentId flatMap catsById.get
    }
    Good(categories.toVector)
  }

}

