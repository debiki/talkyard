/**
 * Copyright (c) 2015-2019 Kaj Magnus Lindberg
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

package talkyard.server.backup

import com.debiki.core.Prelude._
import com.debiki.core._
import debiki.EdHttp._
import debiki.SpecialContentPages
import debiki.dao.{PagePartsDao, SiteDao}
import scala.collection.mutable


case class SiteBackupImporterExporter(globals: debiki.Globals) {  RENAME // to SiteDumpImporter ?


  def upsertIntoExistingSite(siteId: SiteId, siteData: SiteBackup, browserIdData: BrowserIdData) {
    dieIf(siteData.site.map(_.id) isSomethingButNot siteId, "TyE35HKSE")
    val dao = globals.siteDao(siteId)
    dao.readWriteTransaction { tx =>


      // ----- Participants

      val extImpIds =
        siteData.guests.flatMap(_.extImpId)
        // ++ siteData.users.flatMap(_.extImpId)  later
        // ++ siteData.groups.flatMap(_.extImpId)  later

      val oldParticipantsByImpId: Map[ExtImpId, ParticipantInclDetails] =
        tx.loadParticipantsInclDetailsByExtImpIdsAsMap(extImpIds)

      val ppsWithRealIdsByTempImpId = mutable.HashMap[UserId, ParticipantInclDetails]()

      def remappedPpTempId(tempId: UserId): UserId = {
        if (tempId < LowestTempImpId) tempId
        else ppsWithRealIdsByTempImpId.get(tempId).map(_.id).getOrElse({
          throwBadRequest("TyE305KRD3H", o"""Participant with temp id $tempId
            missing from the uploaded data""")
        })
      }

      val firstNextGuestId = tx.nextGuestId
      var nextGuestId = firstNextGuestId

      siteData.guests foreach { guest: Guest =>
        val upsertedGuest = guest.extImpId.flatMap(oldParticipantsByImpId.get) match {
          case None =>
            val guestWithId = guest.copy(id = nextGuestId)
            nextGuestId -= 1
            tx.insertGuest(guestWithId)
            guestWithId
          case Some(oldGuest: Guest) =>
            dieIf(oldGuest.id != guest.id, "TyE046MKP01")  // will fail, remove? ...
            dieIf(oldGuest.extImpId != guest.extImpId, "TyE046MKP02")
            val guestWithId = guest.copy(id = oldGuest.id)
            //if (guest.updatedAt.millis > oldGuest.updatedAt.millis)
            //  tx.updateGuest(guestWithId) ... instead, update the id?
            //  guestWithId
            // else
            oldGuest
        }
        ppsWithRealIdsByTempImpId.put(guest.id, upsertedGuest)
      }


      // ----- Post ids and nrs

      val oldPostsByExtImpId = tx.loadPostsByExtImpIdAsMap(siteData.posts.flatMap(_.extImpId))

      val firstNextPostId = tx.nextPostId()
      var nextPostId = firstNextPostId

      val postsRealIdNrsByTempId = mutable.HashMap[PostId, Post]()
      val postsRealIdNrsByTempPagePostNr = mutable.HashMap[PagePostNr, Post]()

      siteData.posts.groupBy(_.pageId).foreach { case (pageId, postsTempIdNrs) =>
        val allPostsOnPage = tx.loadPostsOnPage(pageId)  ; COULD_OPTIMIZE // don't need them
        dieIf(allPostsOnPage.isEmpty, "TyE05KSDU2KJ", s"Page $pageId has no posts")
        val maxNr = allPostsOnPage.map(_.nr).max
        val firstNextPostNr = maxNr + 1
        var nextPostNr = firstNextPostNr

        postsTempIdNrs map { postTempIdNr =>
          postTempIdNr.extImpId.flatMap(oldPostsByExtImpId.get) match {
            case Some(oldPostRealIdNr) =>
              postsRealIdNrsByTempId.put(postTempIdNr.id, oldPostRealIdNr)
              postsRealIdNrsByTempPagePostNr.put(postTempIdNr.pagePostNr, oldPostRealIdNr)
            case None =>
              // Probably we need a real post nr?
              val maybeNewRealNr =
                if (postTempIdNr.nr < LowestTempImpId) {
                  // This is a real nr already, e.g. the title or body post nr.
                  postTempIdNr.nr
                }
                else {
                  nextPostNr += 1
                  nextPostNr - 1
                }
              val postNewIdNr = postTempIdNr.copy(id = nextPostId, nr = maybeNewRealNr)
              nextPostId += 1
              postsRealIdNrsByTempId.put(postTempIdNr.id, postNewIdNr)
              postsRealIdNrsByTempPagePostNr.put(postTempIdNr.pagePostNr, postNewIdNr)
          }
        }
      }

      def remappedPostNr(pagePostNr: PagePostNr): PostNr = {
        // (The page id might still be a temp id.)
        if (pagePostNr.postNr < LowestTempImpId) pagePostNr.postNr
        else postsRealIdNrsByTempPagePostNr.get(pagePostNr).map(_.pagePostNr.postNr).getOrElse({
          throwBadRequest("TyE8KWHL42B", o"""Post with temp page-post-nr $pagePostNr
            missing from the uploaded data""")
        })
      }


      // ----- Category ids  (don't insert just yet — we don't know their section page ids)

      val firstNextCategoryId = tx.nextCategoryId()
      var nextCategoryId = firstNextCategoryId

      val (oldCategoriesByExtImpId: Map[ExtImpId, Category],
          categoriesRealIdsByTempImpId: Map[CategoryId, Category]) = {
        val oldCategoriesById = tx.loadCategoryMap()
        val oldCategories = oldCategoriesById.values

        val catsTempAndRealIds: Seq[(Category, Category)] =
          siteData.categories.map(catTempId => {
            oldCategories.find(_.extImpId == catTempId.extImpId) match {
              case Some(oldCatRealId) =>
                (catTempId, oldCatRealId)
              case None =>
                val catNewRealId = catTempId.copy(id = nextCategoryId)
                nextCategoryId += 1
                (catTempId, catNewRealId)
            }
          })

        val oldCatsByExtImpId =
          Map(catsTempAndRealIds.flatMap(
            tempAndOld => tempAndOld._1.extImpId.map(extImpId => extImpId -> tempAndOld._2)): _*)
        val oldCatsByTempImpId =
          Map(catsTempAndRealIds.map(
            tempAndOld => tempAndOld._1.id -> tempAndOld._2): _*)

        (oldCatsByExtImpId, oldCatsByTempImpId)
      }

      def remappedCategoryTempId(tempId: CategoryId): CategoryId = {
        if (tempId < LowestTempImpId) tempId
        else categoriesRealIdsByTempImpId.get(tempId).map(_.id).getOrElse({
          throwBadRequest("TyE75KWG25L", o"""Category with temp id $tempId
            missing from the uploaded data""")
        })
      }


      // ----- Pages

      val oldPagesByExtImpId: Map[ExtImpId, PageMeta] =
        tx.loadPageMetasByImpIdAsMap(siteData.pages.flatMap(_.extImpId))

      val pageMetaWithRealIdsByTempImpId = mutable.HashMap[PageId, PageMeta]()

      def remappedPageTempId(tempId: PageId): PageId = {
        if (!isPageTempId(tempId)) tempId
        else pageMetaWithRealIdsByTempImpId.get(tempId).map(_.pageId).getOrElse({
          throwBadRequest("TyE5DKGWT205", o"""Page with temp id $tempId
            missing from the uploaded data""")
        })
      }

      val firstNextPageId = tx.nextPageId().toIntOption.getOrDie("TyE05KSDE2")
      var nextPageId = firstNextPageId

      siteData.pages foreach { pageMetaTempIds: PageMeta =>
        // Later: update with any reassigned participant and post ids:
        //   answerPostId (complicated? need assign tempId —> real id to posts first, somewhere above)
        val pageMetaRealIds = pageMetaTempIds.extImpId.flatMap(oldPagesByExtImpId.get) match {
          case None =>
            val pageMetaRealIds = pageMetaTempIds.copy(
              pageId = nextPageId.toString,
              categoryId = pageMetaTempIds.categoryId.map(remappedCategoryTempId),
              authorId = remappedPpTempId(pageMetaTempIds.authorId),
              lastApprovedReplyById = pageMetaTempIds.lastApprovedReplyById.map(remappedPpTempId),
              frequentPosterIds = pageMetaTempIds.frequentPosterIds.map(remappedPpTempId))
            nextPageId += 1
            tx.insertPageMetaMarkSectionPageStale(pageMetaRealIds, isImporting = true)
            pageMetaRealIds
          case Some(oldPageMeta) =>
            /* Later?:
            if (oldPageMeta.updatedAt.getTime < pageMetaTempIds.updatedAt.getTime) {
              val pageWithId = pageMetaTempIds.copy(pageId = oldPageMeta.pageId)
              tx.updatePageMeta(pageWithId, oldMeta = oldPageMeta,
                // Maybe not always needed:
                markSectionPageStale = true)
            } */
            oldPageMeta
        }
        pageMetaWithRealIdsByTempImpId.put(pageMetaRealIds.pageId, pageMetaRealIds)
      }


      // ----- Page paths

      val oldPathsByPageTempId: Map[PageId, Seq[PagePathWithId]] = {
        val pageTempIds = siteData.pagePaths.map(_.pageId)
        val realIds: Seq[PageId] = pageTempIds.map(remappedPageTempId)
        val pathsByRealIds: Map[PageId, Seq[PagePathWithId]] =
          realIds.flatMap(tx.lookupPagePathAndRedirects).groupBy(_.pageId)
        Map(pageTempIds.flatMap(tempId => {
          val realId: PageId = remappedPageTempId(tempId)
          pathsByRealIds.get(realId).map(
            (pathsRealId: Seq[PagePathWithId]) => tempId -> pathsRealId)
        }): _*)
      }

      siteData.pagePaths foreach { pathTempId: PagePathWithId =>
        oldPathsByPageTempId.get(pathTempId.pageId) match {
          case None =>
            val pathRealId = pathTempId.copy(pageId = remappedPageTempId(pathTempId.pageId))
            tx.insertPagePath(pathRealId)
            pathRealId
          case Some(_ /* pathRealId */) =>
            // Later, could update.
        }
      }


      // ----- Categories

      siteData.categories foreach { catTempId: Category =>
        // Hmm all upserted items need an ext imp id then?
        val alreadyExists = catTempId.extImpId.flatMap(oldCategoriesByExtImpId.get).isDefined
        if (!alreadyExists) {
          val catRealAndTempIds = categoriesRealIdsByTempImpId.getOrDie(catTempId.id, "TyE703KRHF4")
          val catRealIds = catRealAndTempIds.copy(
            sectionPageId = remappedPageTempId(catRealAndTempIds.sectionPageId),
            parentId = catRealAndTempIds.parentId.map(remappedCategoryTempId),
            defaultSubCatId = catRealAndTempIds.defaultSubCatId.map(remappedCategoryTempId))
          tx.insertCategoryMarkSectionPageStale(catRealIds)
        }
      }


      // ----- Posts

      siteData.posts foreach { postTempAll: Post =>
        val oldPostRealAll = postTempAll.extImpId.flatMap(oldPagesByExtImpId.get)
        val alreadyExists = oldPostRealAll.isDefined
        if (!alreadyExists) {
          val postTempPageNr = postsRealIdNrsByTempId.get(postTempAll.id).getOrDie("TyE5FKBG025")
          val tempPageId = postTempPageNr.pageId
          val parentPagePostNr = postTempPageNr.parentNr.map { nr =>
            val parentTempPageIdPostNr = PagePostNr(tempPageId, nr)
            remappedPostNr(parentTempPageIdPostNr)
          }
          val postRealAll = postTempPageNr.copy(
            pageId = remappedPageTempId(postTempPageNr.pageId),
            parentNr = parentPagePostNr,
            // later: multireplyPostNrs
            createdById = remappedPpTempId(postTempPageNr.createdById),
            currentRevisionById = remappedPpTempId(postTempPageNr.currentRevisionById),
            approvedById = postTempPageNr.approvedById.map(remappedPpTempId),
            lastApprovedEditById = postTempPageNr.lastApprovedEditById.map(remappedPpTempId),
            collapsedById = postTempPageNr.collapsedById.map(remappedPpTempId),
            closedById = postTempPageNr.closedById.map(remappedPpTempId),
            bodyHiddenById = postTempPageNr.bodyHiddenById.map(remappedPpTempId),
            deletedById = postTempPageNr.deletedById.map(remappedPpTempId))
          tx.insertPost(postRealAll)
        }

        // TODO:
        // [readlater] Index post too; insert it into the index queue. And update this test: [2WBKP05].
      }
    }
  }


  def importCreateSite(siteData: SiteBackup, browserIdData: BrowserIdData, deleteOldSite: Boolean)
        : Site = {
    for (page <- siteData.pages) {
      val path = siteData.pagePaths.find(_.pageId == page.pageId)
      // Special pages shouldn't be reachable via any page path. Others, should.
      if (SpecialContentPages.isSpecialPageId(page.pageId)) {
        throwBadRequestIf(path.isDefined,
          "TyE2ABKY7", s"Special page has PagePath: $path")
      }
      else {
        throwBadRequestIf(path.isEmpty,
          "TyE5GKY2", s"No PagePath included for page id '${page.pageId}'")
      }
    }

    def isMissing(what: Option[Option[Any]]) = what.isEmpty || what.get.isEmpty || {
      what.get.get match {
        case s: String => s.trim.isEmpty
        case _ => false
      }
    }

    val siteToSave = siteData.site.getOrDie("TyE7KRUGV24")
    val siteSettings = siteData.settings.getOrDie("TyE5KRYTG02")

    throwForbiddenIf(isMissing(siteSettings.orgFullName),
      "EdE7KB4W5", "No organization name specified")

    // COULD do this in the same transaction as the one below — then, would need a function
    // `transaction.continueWithSiteId(zzz)`?
    val site = globals.systemDao.createAdditionalSite(
      siteToSave.pubId,
      siteToSave.name,
      siteToSave.status,
      siteToSave.canonicalHostname.map(_.hostname),
      embeddingSiteUrl = None,
      organizationName = "Dummy organization name [EsM8YKWP3]",  // fix later
      creatorId = SystemUserId,
      browserIdData = browserIdData,
      isTestSiteOkayToDelete = true,
      skipMaxSitesCheck = true,
      deleteOldSite = deleteOldSite,
      pricePlan = "Unknown",  // [4GKU024S]
      createdFromSiteId = None)

    val newDao = globals.siteDao(site.id)

    HACK // not inserting groups, only updating summary email interval. [7FKB4Q1]
    // And in the wrong transaction :-/
    newDao.saveAboutGroupPrefs(AboutGroupPrefs(
      groupId = Group.EveryoneId,
      fullName = Some("Everyone"),
      username = "everyone",
      summaryEmailIntervalMins = Some(siteData.summaryEmailIntervalMins),
      summaryEmailIfActive = Some(siteData.summaryEmailIfActive)), Who.System)

    newDao.readWriteTransaction { transaction =>
      // We might import a forum or a forum category, and then the categories reference the
      // forum page, and the forum page references to the root category.
      transaction.deferConstraints()

      transaction.upsertSiteSettings(siteSettings)

      siteData.guests foreach { guest: Guest =>
        transaction.insertGuest(guest)
      }

      siteData.users foreach { user =>
        transaction.insertMember(user)
        // [readlater] import page notf prefs [2ABKS03R]
        // [readlater] export & import username usages & emails, later. For now, create new here.
        user.primaryEmailInfo.foreach(transaction.insertUserEmailAddress)
        transaction.insertUsernameUsage(UsernameUsage(
          usernameLowercase = user.usernameLowercase, // [CANONUN]
          inUseFrom = transaction.now, userId = user.id))
        // [readlater] export & import UserStats. For now, create new "empty" here.
        transaction.upsertUserStats(UserStats.forNewUser(user.id, firstSeenAt = transaction.now,
          emailedAt = None))
        newDao.joinGloballyPinnedChats(user.briefUser, transaction)
      }
      siteData.pages foreach { pageMeta =>
        //val newId = transaction.nextPageId()
        transaction.insertPageMetaMarkSectionPageStale(pageMeta, isImporting = true)
      }
      siteData.pagePaths foreach { path =>
        transaction.insertPagePath(path)
      }
      siteData.categories foreach { categoryMeta =>
        //val newId = transaction.nextCategoryId()
        transaction.insertCategoryMarkSectionPageStale(categoryMeta)
      }
      siteData.posts foreach { post =>
        //val newId = transaction.nextPostId()
        transaction.insertPost(post)
        // [readlater] Index post too; insert it into the index queue. And update this test: [2WBKP05].
      }
      siteData.permsOnPages foreach { permission =>
        transaction.insertPermsOnPages(permission)
      }
      // Or will this be a bit slow? Kind of loads everything we just imported.
      siteData.pages foreach { pageMeta =>
        // [readlater] export & import page views too, otherwise page popularity here will be wrong.
        val pagePartsDao = PagePartsDao(pageMeta.pageId, transaction)
        newDao.updatePagePopularity(pagePartsDao, transaction)
        // For now: (e2e tests: page metas imported before posts, and page meta reply counts = wrong)
        val numReplies = pagePartsDao.allPosts.count(_.isReply)
        val correctMeta = pageMeta.copy(
          numRepliesVisible = numReplies,
          numRepliesTotal = numReplies,
          numPostsTotal = pagePartsDao.numPostsTotal)
        transaction.updatePageMeta(correctMeta, oldMeta = pageMeta, markSectionPageStale = true)
      }
    }

    site
  }

}

