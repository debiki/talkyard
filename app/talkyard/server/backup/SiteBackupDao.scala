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

package talkyard.server.backup  // RENAME to  talkyard.server.sitepatch

import com.debiki.core.Prelude._
import com.debiki.core._
import debiki.EdHttp._
import debiki.SpecialContentPages
import debiki.dao.{PageDao, PagePartsDao, SiteDao}
import org.jsoup.Jsoup
import org.jsoup.safety.Whitelist
import scala.collection.mutable
import scala.collection.mutable.ArrayBuffer


case class SiteBackupImporterExporter(globals: debiki.Globals) {  RENAME // to SiteDumpImporter ?


  def upsertIntoExistingSite(siteId: SiteId, siteData: SiteBackup, browserIdData: BrowserIdData)
        : SiteBackup = {

    SHOULD_CODE_REVIEW  // Auto tests work fine though.

    // Tested e.g. here:
    // - api-upsert-categories.2browsers.test.ts  TyT94DFKHQC24
    // - embedded-comments-create-site-import-disqus.2browsers.test.ts  TyT5KFG0P75
    // - SiteDumpImporterAppSpec  TyT2496ANPJ3

    dieIf(siteData.site.map(_.id) isSomethingButNot siteId, "TyE35HKSE")
    val dao = globals.siteDao(siteId)
    val upsertedCategories = ArrayBuffer[Category]()

    dao.readWriteTransaction { tx =>

      // Posts link to pages, and Question type pages link to the accepted answer post,
      // that is, can form foreign key cycles.  And a root category links to the section
      // index page, which links to the root category (also a cycle).
      tx.deferConstraints()

      // Real id = an id to something in the database.
      //
      // External id = some id in the external software system from which we're
      // importing or upserting things. Could be Disqus comment ids, when importing
      // Disqus comments. Or e.g. plugin names, for someone else's software app
      // — and they want to upsert categories, one for each such plugin,
      // so there can be one category, per plugin, in Talkyard, for discussing the plugin.
      //
      // For now:
      // Temp import ids and nrs = ids and nrs > 2e9 that things in the siteData use
      // to link to each other. These ids are then remapped to low values, like 1, 2, 3, 4,
      // before actually inserting into the database. Exactly which low ids and nrs
      // the temp imp ids and nrs get remapped to, depend on what's in the db
      // already — we need to avoid conflicts.
      // However, when constructing a site patch, outside Talkyard, one doesn't know
      // which ids are in use already. Then, one uses these temp improt ids > 2e9,
      // which won't conflict with anything already in the database — and gets
      // remapped later to "real" ids.
      //
      // Later:
      // Probably there'll be only ThingPatch items in a SitePatch, which
      // refer to other items in the patch, via *references* and *external ids*,
      // instead of the magic > 2e9 temp import ids.
      // That's simpler, for clients that create dumps outside Talkyard
      // (e.g. a Disqus importer) because then they won't need to generate > 2e9
      // ids. instead they can just use the external ids and reference them
      // directly — via  SomethingPatch.parentRef = "extid:some_external_id".
      // And when Talkyard generates a dump of a site, Talkyard references the
      // internal "real" ids:  SomethingPatch.parentRef = "tyid:internal_numeric_id".
      //
      // 'extid:' prefix = external id,
      // 'tyid:' prefix = Talkyard internal id.
      //
      // (Then there's also 'ssoid:' but that's a different field, for User:s only,
      // used for single sign-on.  'externalId' shoud be renamed to 'ssoid' [395KSH20])


      // ----- Page ids
      //
      // Start with remapping page temporary import ids to real page ids that don't
      // conflict with any existing pages, or are the same as already existing
      // pages if the imported page(s) have matching external import ids
      // (and thus should be updated, instead of inserted).
      //
      // We start with pages, because other things, like posts and categories,
      // link to pages. (Posts are placed on a page, and root categories have
      // a section page id.) So they all want to know the real page ids.
      //
      // Don't insert the pages here though — we haven't remapped the page's
      // category id or any answer post id temp import id, to real ids, yet,
      // so we don't yet know what ids to use, to reference those things.


      SHOULD // check ok alt id  [05970KF5]

      val oldPagesByExtId: Map[ExtImpId, PageMeta] =
        tx.loadPageMetasByExtImpIdAsMap(siteData.pages.flatMap(_.extImpId))

      val oldPagesByAltId: Map[AltPageId, PageMeta] =
        tx.loadPageMetasByAltIdAsMap(siteData.pageIdsByAltIds.keys)

      val pageAltIdsByImpIds =
        new mutable.HashMap[PageId, mutable.Set[AltPageId]] with mutable.MultiMap[PageId, AltPageId]

      siteData.pageIdsByAltIds foreach { case (altId, pageImpId) => {
        pageAltIdsByImpIds.addBinding(pageImpId, altId)
      }}

      // Throw error, if any alt page ids in the patch, reference different pages,
      // than what [the same alt ids already in the database] already point to.
      // (Because then there's a conflict between the database, and the patch.)
      // (We do the same for ext ids, below (502958).)
      oldPagesByAltId foreach { case (altPageId, pageMeta) =>
        val pageIdInPatch = siteData.pageIdsByAltIds.get(altPageId) getOrDie "TyE305RKSTJ"
        throwBadRequestIf(!isPageTempId(pageIdInPatch) && pageIdInPatch != pageMeta.pageId,
          "TyE306AKTJWB", o"""Alt page id $altPageId in patch maps to real page id $pageIdInPatch,
            but in the database, already maps to ${pageMeta.pageId}""")
      }

      val pageRealIdsByImpId = mutable.HashMap[PageId, PageId]()

      def remappedPageTempId(tempId: PageId): PageId = {
        if (!isPageTempId(tempId)) tempId
        else {
          pageRealIdsByImpId.getOrElse(tempId, throwBadRequest(
            "TyE5DKGWT205", s"Page with temp id $tempId missing from the uploaded data"))
        }
      }

      siteData.pages foreach { pageWithTempId: PageMeta =>
        val tempId = pageWithTempId.pageId
        val extImpId = pageWithTempId.extImpId getOrElse throwForbidden(
          "TyE305KBSG", s"Inserting pages with no extImpId not yet implemented, page temp id: $tempId")

        val anyRealIdByExtId = oldPagesByExtId.get(extImpId).map(oldPage => {
          throwBadRequestIf(!isPageTempId(tempId) && tempId != oldPage.pageId,
            // We do this check for alt ids too, above. (502958)
            "TyE30TKKWFG3", o"""Imported page w extImpId '$extImpId' has real id $tempId
               which differs from page ${oldPage.pageId} in the db, with the same extImpId""")
          oldPage.pageId
        })

        val altIds = pageAltIdsByImpIds.getOrElse(tempId, Set.empty)

        val anyRealMetasByAltId: Iterable[PageMeta] = altIds.flatMap(oldPagesByAltId.get)
        val anyRealPageIdsFromAltIdAsSet = anyRealMetasByAltId.map(_.pageId).toSet
        dieIf(anyRealPageIdsFromAltIdAsSet.size > 1, "TyE305RKJW23")
        val anyRealPageIdFromAltId = anyRealPageIdsFromAltIdAsSet.headOption

        throwBadRequestIf(anyRealIdByExtId.isDefined && anyRealPageIdFromAltId.isDefined &&
          anyRealIdByExtId != anyRealPageIdFromAltId, "TyE04KRDNQ24", o"""Alt id and ext id
          mismatch: Trying to upsert page with temp id $tempId, with alt ids $altIds.
          In the database, those alt ids map to real page id ${anyRealPageIdFromAltId.get}
          but the ext id maps to real page id ${anyRealIdByExtId.get}""")

        val anyRealId = anyRealIdByExtId orElse anyRealPageIdFromAltId
        val realId = anyRealId.getOrElse({
          tx.nextPageId()
        })

        pageRealIdsByImpId.put(pageWithTempId.pageId, realId)
      }


      // ----- Participants

      val ppsExtImpIds =
        siteData.guests.flatMap(_.extImpId)
        // ++ siteData.users.flatMap(_.extImpId)  later
        // ++ siteData.groups.flatMap(_.extImpId)  later

      // If there're participants in the database with the same external ids
      // as some of those in the siteData, then, they are to be updated, and we
      // won't create new participants, for them.
      val oldParticipantsByExtImpId: Map[ExtImpId, ParticipantInclDetails] =
        tx.loadParticipantsInclDetailsByExtImpIdsAsMap_wrongGuestEmailNotfPerf(ppsExtImpIds)

      val ppsWithRealIdsByTempImpId = mutable.HashMap[UserId, ParticipantInclDetails]()
      // Later: if some guests have real ids already, lookup any existing users
      // with those same real ids — then either we'll do nothing, or update
      // those already existing users.  (3607TK2)

      def remappedPpTempId(tempId: UserId): UserId = {
        if (-LowestTempImpId < tempId && tempId < LowestTempImpId) {
          // The import data specifies a real id for an already existing user.
          // We didn't need to remap it; just return it.
          tempId
        }
        else {
          // Either 1) there was already a participant in the db with the same external id
          // as [the user we're importing with id = tempId], and hen already has a real id.
          // Or 2) we're inserting a new user and have assigned it a new real id.
          val anyPpWithRealId = ppsWithRealIdsByTempImpId.get(tempId)
          val ppWithRealId: ParticipantInclDetails = anyPpWithRealId.getOrElse({
            throwBadRequest("TyE305KRD3H", o"""Participant with temp id $tempId
              missing from the uploaded data""")
          })
          dieIf(ppWithRealId.id <= -LowestTempImpId || LowestTempImpId <= ppWithRealId.id, "TyE305KRST2")
          ppWithRealId.id
        }
      }

      val firstNextGuestId = tx.nextGuestId
      var nextGuestId = firstNextGuestId

      val oldGuestEmailNotfPrefs = tx.loadAllGuestEmailNotfPrefsByEmailAddr()

      siteData.guestEmailNotfPrefs.iterator foreach { case (emailAddr, pref) =>
        if (oldGuestEmailNotfPrefs.contains(emailAddr)) {
          // Noop: For now, don't overwrite prefs already in the database. Later,
          // add config options so one can specify what should happen (e.g. update if
          // more recent timestamp?).
        }
        else {
          tx.configIdtySimple(tx.now.toJavaDate, emailAddr, pref)
        }
      }

      siteData.guests foreach { guestTempId: Guest =>
        // For now, don't allow upserting via real ids, only via ext imp ids. (3607TK2)
        throwForbiddenIf(guestTempId.id > -LowestTempImpId,
          "TyE05KKST25", s"Upserting guest with real id ${guestTempId.id}: not yet implemented")

        // We need an extImpId, so we won't duplicate this guest, if we import the same dump many times.
        throwBadRequestIf(guestTempId.extImpId.isEmpty,
          "TyE5HKW30R", s"Upserting guests with no extImpId not yet supported ${guestTempId.id}")

        val upsertedGuestRealId = guestTempId.extImpId.flatMap(oldParticipantsByExtImpId.get) match {
          case None =>
            val guestRealId = guestTempId.copy(id = nextGuestId)
            nextGuestId -= 1
            tx.insertGuest(guestRealId)
            guestRealId
          case Some(oldGuestRealId: Guest) =>
            dieIf(oldGuestRealId.id <= -LowestTempImpId, "TyE046MKP01")
            dieIf(oldGuestRealId.extImpId != guestTempId.extImpId, "TyE046MKP02")
            // Later, update guest, but when do this? If onConflict=Overwrite?  [YESUPSERT]
            //if (guestTempId.updatedAt.millis > oldGuestRealId.updatedAt.millis)
            //  val guestRealId = guestTempId.copy(id = oldGuestRealId.id)
            //  tx.updateGuest(guestRealId)
            //  guestRealId
            //else
            oldGuestRealId
        }
        dieIf(upsertedGuestRealId.id <= -LowestTempImpId,
          "TyE305HKSD2", s"Guest id ${guestTempId.id} got remapped to ${upsertedGuestRealId.id}")
        ppsWithRealIdsByTempImpId.put(guestTempId.id, upsertedGuestRealId)
      }


      // ----- Posts

      val oldPostsByExtImpId = tx.loadPostsByExtImpIdAsMap(siteData.posts.flatMap(_.extImpId))
      val oldPostsByPagePostNr = mutable.HashMap[PagePostNr, Post]()

      val firstNextPostId = tx.nextPostId()
      var nextPostId = firstNextPostId

      val postsRealByTempId = mutable.HashMap[PostId, Post]()
      val postsRealByTempPagePostNr = mutable.HashMap[PagePostNr, Post]()

      def remappedPostIdTempId(tempId: PostId): PostId = {
        if (tempId < LowestTempImpId) tempId
        else {
          val postRealIds = postsRealByTempId.getOrElse(tempId, throwBadRequest(
            "TyE305HKRD5", s"Post with temp imp id $tempId missing from the uploaded data"))
          postRealIds.id
        }
      }

      siteData.posts.groupBy(_.pageId).foreach { case (tempPageId, tempPosts) =>
        val realPageId = remappedPageTempId(tempPageId)
        val allOldPostsOnPage = tx.loadPostsOnPage(realPageId)  ; COULD_OPTIMIZE // don't need them all
        allOldPostsOnPage foreach { oldPost =>
          oldPostsByPagePostNr.put(oldPost.pagePostNr, oldPost)
        }
        val firstNextReplyNr =
          if (allOldPostsOnPage.isEmpty) FirstReplyNr
          else allOldPostsOnPage.map(_.nr).max + 1
        var nextReplyNr = firstNextReplyNr
        dieIf(nextReplyNr < FirstReplyNr, "TyE05HKGJ5")

        val postTempIdsToInsert = mutable.HashSet[PostId]()

        tempPosts foreach { tempPost =>
          throwBadRequestIf(tempPost.id < LowestTempImpId,
            "TyE30HRPG2", s"Upserting posts with real ids not yet implemented, post id: ${tempPost.id}")

          // We need an extImpId, so we won't recreate and duplicate the post, if we import
          // the same dump more than once.
          throwBadRequestIf(tempPost.extImpId.isEmpty,
            "TyE30HRPG8", s"Upserting posts with no extImpId not yet supported ${tempPost.id}")

          val realPostExclParentNr: Post = tempPost.extImpId.flatMap(oldPostsByExtImpId.get) match {
            case Some(oldPostRealIdNr: Post) =>
              // Later: If has same id and nr, then could upsert.  [YESUPSERT]
              // If different id or nr, then, error?
              oldPostRealIdNr
            case None =>
              // Probably we need to remap the post nr to 2, 3, 4, 5 ... instead of a temp nr.
              // Unless has a real nr already, e.g. the title or body post nr.
              val maybeNewRealNr =
                if (tempPost.nr < LowestTempImpId) tempPost.nr
                else { nextReplyNr += 1 ; nextReplyNr - 1 }

              oldPostsByPagePostNr.get(PagePostNr(realPageId, maybeNewRealNr)) match {
                case Some(oldPostSamePostNr: Post) =>
                  // Do nothing. The old post should be an already existing page title
                  // or body. Later, maybe update. [IMPUPD]
                  // This happens e.g. if we import old Disqus comments, to a page for which
                  // there's already a Talkyard embedded comments discussion. Then we can
                  // leave the already existing title and body as is.)
                  dieIf(!PageParts.isArticleOrTitlePostNr(maybeNewRealNr),
                    "TyE502BKGD8", o"""Conflict when upserting post w real pageId $realPageId
                    postNr $maybeNewRealNr and temp pageId $tempPageId postNr ${tempPost.nr}""")
                  oldPostSamePostNr
                case None =>
                  def ifThenIncr(test: Boolean, num: Int) = if (test) num + 1 else num

                  val postNewIdNr: Post = tempPost.copy(
                    pageId = realPageId,
                    id = nextPostId,
                    nr = maybeNewRealNr,
                    // parentNr — updated below
                    // later: multireplyPostNrs
                    createdById = remappedPpTempId(tempPost.createdById),
                    currentRevisionById = remappedPpTempId(tempPost.currentRevisionById),
                    approvedById = tempPost.approvedById.map(remappedPpTempId),
                    lastApprovedEditById = tempPost.lastApprovedEditById.map(remappedPpTempId),
                    collapsedById = tempPost.collapsedById.map(remappedPpTempId),
                    closedById = tempPost.closedById.map(remappedPpTempId),
                    bodyHiddenById = tempPost.bodyHiddenById.map(remappedPpTempId),
                    deletedById = tempPost.deletedById.map(remappedPpTempId))

                  nextPostId += 1
                  postTempIdsToInsert += tempPost.id
                  postNewIdNr
              }
          }

          postsRealByTempId.put(tempPost.id, realPostExclParentNr)
          postsRealByTempPagePostNr.put(tempPost.pagePostNr, realPostExclParentNr)
        }

        // Update parent nrs, sanitize html, and upsert into db.
        tempPosts foreach { tempPost =>
          if (postTempIdsToInsert.contains(tempPost.id)) {
            val postTempParentNr = postsRealByTempPagePostNr.getOrElse(tempPost.pagePostNr,
              throwBadRequest(
                "TyE305KRTD3", s"Parent post ${tempPost.pagePostNr} not found in site data"))
            dieIf(postTempParentNr.parentNr != tempPost.parentNr, "TyE306RKTJ2")

            val postRealNoHtml =
              if (tempPost.parentNr.isEmpty) {
                postTempParentNr
              }
              else {
                val parentPagePostNr = tempPost.pagePostNr.copy(postNr = postTempParentNr.parentNr.get)
                val parentPost = postsRealByTempPagePostNr.getOrElse(parentPagePostNr, throwBadRequest(
                  "TyE6AKD025", s"Parent post missing, temp page post nr $parentPagePostNr"))
                postTempParentNr.copy(parentNr = Some(parentPost.nr))
              }

            // Sanitize html or convert from commonmark to html — good to wait with,
            // until we're here, so we know the imported contents seems well structured?
            // Need a way to specify if the source is in commonmark or html?  [IMPCORH]
            // Ought to assume it's always CommonMark, but then, importing things can
            // take almost forever, if the site is large (CommonMark parser = slow).
            val postReal =
              if (postRealNoHtml.approvedSource.isEmpty) postRealNoHtml
              else {
                postRealNoHtml.copy(
                  approvedHtmlSanitized = Some(Jsoup.clean(
                    postRealNoHtml.approvedSource.get, Whitelist.basicWithImages)))
              }

            tx.insertPost(postReal)

            // Index post too; insert it into the index queue. And update this test: [2WBKP05].

            postsRealByTempId.put(tempPost.id, postReal)
            postsRealByTempPagePostNr.put(tempPost.pagePostNr, postReal)
          }
        }
      }


      // ----- Categories

      val firstNextCategoryId = tx.nextCategoryId()
      var nextCategoryId = firstNextCategoryId

      val oldCategoriesById = tx.loadCategoryMap()
      val oldCategories = oldCategoriesById.values

      val categoriesRealIdsByTempImpId = mutable.HashMap[CategoryId, CategoryId]()

      def remappedCategoryTempId(tempId: CategoryId): CategoryId = {
        if (tempId < LowestTempImpId) tempId
        else {
          categoriesRealIdsByTempImpId.getOrElse(tempId, throwBadRequest(
            "TyE7KF026HR", s"Category with temp id $tempId missing from the uploaded data"))
        }
      }

      // Category patches: Remap temp imp ids to real ids, by looking up the external id. [3953KSH]
      siteData.categoryPatches foreach { catPatchWithTempId: CategoryPatch =>
        val impId = catPatchWithTempId.id getOrThrowBadRequest(
          "TyE305KKS61", "Category with no id")
        val extId = catPatchWithTempId.extImpId getOrThrowBadRequest(
          "TyE2SDKLPX3", s"Category with id $impId needs an ext id")
        throwBadRequestIf(impId < LowestTempImpId,
          "TyE305KPWDJ", s"""Currently a category with real id $impId and extId '$extId',
           should instead have a > 2e9 temp id""")
        val oldCat = oldCategories.find(_.extImpId is extId) getOrThrowBadRequest(
          "TYE40GKRD81", s"No category in the database with ext id $extId")
        categoriesRealIdsByTempImpId.put(impId, oldCat.id)
      }

      // Remap ids.
      siteData.categories foreach { catTempId: Category =>
        val extImpId = catTempId.extImpId getOrElse throwForbidden(
          "TyE6DKWG2RJ", s"Inserting categories with no extImpId not yet impl, category: $catTempId")
        val realId = oldCategories.find(_.extImpId is extImpId).map(oldCatRealId => {
          throwBadRequestIf(catTempId.id < FirstTempImpId && catTempId.id != oldCatRealId.id,
            "TyE306HKD2", o"""Category to import with real id ${catTempId.id} has the same
            extImpId as category ${oldCatRealId.id} — but they aren't the same;
            they have different ids""")
          oldCatRealId.id
        }) getOrElse {
          if (catTempId.id < FirstTempImpId) {
            // Could update the already existing category? But what if it has a different
            // extImpId? Or if it has none, when the one getting imported does? or the
            // other way around? — For now, just disallow this.
            // oldCategoriesById.get(catTempId.id) — maybe later.
            throwForbidden("TyE305HKRD6",
              s"Upserting categories with real ids not yet implemented, category: $catTempId")
          }
          nextCategoryId += 1
          nextCategoryId - 1
        }
        categoriesRealIdsByTempImpId.put(catTempId.id, realId)
      }

      // Too many categories?
      val numNewCats = siteData.categories.count(catTempId => {
        val realId = remappedCategoryTempId(catTempId.id)
        oldCategoriesById.get(realId).isEmpty
      })
      val numOldCats = oldCategories.size
      throwForbiddenIf(numOldCats + numNewCats > MaxCategories,
        "TyE05RKSDJ2", s"Too many categories: There are already $numOldCats categories, and " +
          s"creating $numNewCats new categories, would result in more than $MaxCategories " +
          "categories (the upper limit as of now).")

      // Upsert categories.
      siteData.categories foreach { catTempId: Category =>
        val realId = remappedCategoryTempId(catTempId.id)
        val anyOldCat = oldCategoriesById.get(realId)
        val catRealIds = anyOldCat match {
          case None =>
            val realSectPageId = remappedPageTempId(catTempId.sectionPageId)
            val parentCatRealId = catTempId.parentId.map(remappedCategoryTempId)
            val parentCat = parentCatRealId.flatMap(oldCategoriesById.get)
            /* If is upserting into existing site, could:
            throwBadRequestIf(parentCatRealId.isDefined && parentCat.isEmpty,
                "TyE5AKTT20", s"Parent category not found, for category: $catTempId") */
            throwBadRequestIf(parentCat.exists(_.sectionPageId != realSectPageId),
              "TyE205WKT", o"""Parent category ${parentCat.get.id} has section page id
              ${parentCat.get.sectionPageId} which is different from the upserted category
              $catTempId whose real section page id is $realSectPageId""")
            COULD // also verify that the page is a forum or blog or some valid site section type page.
            val catRealIds = catTempId.copy(
              id = realId,
              sectionPageId = realSectPageId,
              parentId = parentCatRealId,
              defaultSubCatId = catTempId.defaultSubCatId.map(remappedCategoryTempId))
            tx.insertCategoryMarkSectionPageStale(catRealIds)
            catRealIds
          case Some(oldCat) =>
            // if upsertMode == Overwrite

            // To allow this would need to verify that the cat also gets moved to a
            // new parent cat with the new section id. Or that the old parent's sect id
            // also changes.
            TESTS_MISSING // try change sect page id; verify that the server says No.
            throwBadRequestIf(remappedPageTempId(catTempId.sectionPageId) != oldCat.sectionPageId,
              "TyE205TSH5", "Cannot change section page id, not implemented")

            BUG // harmless: Moving a sub cat to another cat, messes up the topic counts
            // for the old and new parent cats. [NCATTOPS] Maybe remove category topic
            // counts? Only remember current approx topic per day/week/etc?

            TESTS_MISSING // move cat to new parent cat, with 1) same sect id (ok) and
            // 2) a different (bad).
            val anyNewParentCatRealId = catTempId.parentId.map(remappedCategoryTempId)
            anyNewParentCatRealId match {
              case None =>
                // Keep old parent id, whatever it is.
              case Some(newRealParentCatId) =>
                val oldCatParentId = oldCat.parentId.getOrThrowBadRequest(
                    "TyE5WKHS0DX4", o"""Upserted cat with temp id ${catTempId.id}
                    has a parent cat, but the matching cat in the database, ${oldCat.id},
                    has no parent.""")
                val getsNewParentCat = newRealParentCatId != oldCatParentId
                if (getsNewParentCat) {
                  val oldParentCat = oldCategoriesById.get(oldCatParentId) getOrThrowBadRequest(
                    "TyE395AKDPF3", s"Old parent cat $oldCatParentId not found")
                  val newParentCat = oldCategoriesById.get(newRealParentCatId) getOrThrowBadRequest(
                    "TyE7FKDTJ02RP", s"New parent cat with real id $newRealParentCatId not found")
                  throwBadRequestIf(oldParentCat.sectionPageId != newParentCat.sectionPageId,
                    "TyE205TSH6", o"""Cannot change category with temp id ${catTempId.id}
                    by changing parent category from ${oldParentCat.id}
                    in site section page id ${oldParentCat.sectionPageId}
                    to category ${newParentCat.id} in *different* site section page id
                    ${newParentCat.sectionPageId}""")
                }
            }

            val catRealIds = catTempId.copy(
              id = oldCat.id,
              sectionPageId = oldCat.sectionPageId,
              parentId = anyNewParentCatRealId orElse oldCat.parentId,
              defaultSubCatId = catTempId.defaultSubCatId.map(remappedCategoryTempId))
            tx.updateCategoryMarkSectionPageStale(catRealIds)
            catRealIds
        }
        upsertedCategories.append(catRealIds)
      }

      SECURITY; SHOULD // Verify all cats in a site section, has the same site section page id.
      TESTS_MISSING // try to create cats with wrong section ids.

      SECURITY; SHOULD // Check for category cycles; if any found, abort.
      TESTS_MISSING // try to create a category cycle?


      // ----- Permissions

      // For now, only import permissions for each category, once? Seems unclear what to
      // do, if after the first import, the admins have changed the permissions in the
      // Talkyard database. Then, if re-importing, maybe they wouldn't want the re-import
      // to "mess with" the permissions they've edited themselves already? (305DKASP)
      // (Could add import/upsert options to let the admins clarify what should happen,
      // if re-importing the same permissions again.)

      // Permissions shouldn't have extImpId:s? or?

      val oldPerms = tx.loadPermsOnPages()   // for debugging
      val oldPermWithHighestId = maxOptBy(oldPerms)(_.id)
      var nextPermId = oldPermWithHighestId.map(_.id).getOrElse(0) + 1

      siteData.permsOnPages foreach { permissionTempIds: PermsOnPages =>
        val oldCategoryWithThisPerm =
          permissionTempIds.onCategoryId.flatMap((tempCatId: CategoryId) => {
            val realCatId = remappedCategoryTempId(tempCatId)
            oldCategories.find(_.id == realCatId)
          })

        if (oldCategoryWithThisPerm.isDefined) {
          // Then skip this permission, see above (305DKASP),
          // ... or if onConflit=Overwrite, then do overwrite?  [YESUPSERT]
        }
        else {
          val permissionRealIds = permissionTempIds.copy(
            id = nextPermId,
            forPeopleId = remappedPpTempId(permissionTempIds.forPeopleId),
            onCategoryId = permissionTempIds.onCategoryId.map(remappedCategoryTempId),
            onPageId = permissionTempIds.onPageId.map(remappedPageTempId),
            onPostId = permissionTempIds.onPostId.map(remappedPostIdTempId)
            //onTagId = permissionTempIds.onTagId,
          )
          tx.insertPermsOnPages(permissionRealIds)
          nextPermId += 1
        }
      }


      // ----- Pages

      siteData.pages foreach { pageWithTempId: PageMeta =>
        // Later: update with any reassigned participant and post ids:
        //   answerPostId (complicated? need assign tempId —> real id to posts first, somewhere above)
        val realId = pageRealIdsByImpId.get(pageWithTempId.pageId) getOrDie "TyE06DKWD24"

        lazy val pageAltIds = pageAltIdsByImpIds.getOrElse(pageWithTempId.pageId, Set.empty)

        val anyOldPage = pageWithTempId.extImpId.flatMap(oldPagesByExtId.get) orElse {
          val oldPages = pageAltIds.flatMap(oldPagesByAltId.get)
          dieIf(oldPages.map(_.pageId).size > 1, "TyE05HKR3")
          oldPages.headOption
        }

        val pageMetaWrongStats = anyOldPage match {
          case None =>
            val pageWithRealIds = pageWithTempId.copy(
              pageId = realId,
              categoryId = pageWithTempId.categoryId.map(remappedCategoryTempId),
              authorId = remappedPpTempId(pageWithTempId.authorId),
              lastApprovedReplyById = pageWithTempId.lastApprovedReplyById.map(remappedPpTempId),
              frequentPosterIds = pageWithTempId.frequentPosterIds.map(remappedPpTempId))
            //val pageWithOkNums = bumpNums(pageWithRealIds)
            tx.insertPageMetaMarkSectionPageStale(pageWithRealIds, isImporting = true)
            pageAltIds.foreach(tx.insertAltPageId(_, realId))
            pageWithRealIds // pageWithOkNums
          case Some(oldPageMeta) =>
            /*val pageWithOkNums = bumpNums(oldPageMeta)
            if (pageWithOkNums != oldPageMeta) {
              tx.updatePageMeta(pageWithOkNums, oldMeta = oldPageMeta, markSectionPageStale = true)
            } */
            oldPageMeta
            /* Later?,  if onConflict=Overwrite, then update?  [YESUPSERT]
            if (oldPageMeta.updatedAt.getTime < pageMetaTempIds.updatedAt.getTime) {
              val pageWithId = pageMetaTempIds.copy(pageId = oldPageMeta.pageId)
              tx.updatePageMeta(pageWithId, oldMeta = oldPageMeta,
                // Maybe not always needed:
                markSectionPageStale = true)
            } */
        }

        COULD // skip this, if no posts and nothing on the page, has changed.
        val pageDao = PageDao(pageMetaWrongStats.pageId, tx) // (0926575)
        val pageMeta = pageMetaWrongStats.copyWithUpdatedStats(pageDao)  // bumps version [306MDH26]

        dao.updatePagePopularity(pageDao.parts, tx)
        tx.updatePageMeta(pageMeta, oldMeta = pageMetaWrongStats, markSectionPageStale = true)

        /*
        // [readlater] export & import page views too, otherwise page popularity here will be wrong.
        // (So here we load all posts again — the ones we just inserted. Should be fine
        // performance wise — it's just one db query, to load all posts, vs one per post,
        // previously when inserting. At least not more than 2x slower, which should be ok
        // (simplicity = more important).
        val pagePartsDao = PagePartsDao(pageMeta.pageId, tx)
        dao.updatePagePopularity(pagePartsDao, tx)
        */
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
            // Later, could update.  [YESUPSERT]
        }
      }
    }

    dao.emptyCache()

    // Categories is all the current Talkyard API consumers need. For the moment.
    SiteBackup.empty.copy(
      categories = upsertedCategories.toVector)
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

    SECURITY; SHOULD // use upsertIntoExistingSite instead, and add post cycles nnd
    // category cycles checks there.

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
      siteData.pages foreach { pageMeta =>  // (0926575)
        // [readlater] export & import page views too, otherwise page popularity here will be wrong.
        // (So here we load all posts again — the ones we just inserted. Should be fine
        // performance wise — it's just one db query, to load all posts, vs one per post,
        // previously when inserting. At least not more than 2x slower, which should be ok
        // (simplicity = more important).
        val pagePartsDao = PagePartsDao(pageMeta.pageId, transaction)
        newDao.updatePagePopularity(pagePartsDao, transaction)
        // For now: (e2e tests: page metas imported before posts, and page meta reply counts = wrong)
        val numReplies = pagePartsDao.allPosts.count(_.isReply)
        val correctMeta = pageMeta.copy(

          // Frequent posters, last approved reply by, and more?  forgotten here:

          numRepliesVisible = numReplies,
          numRepliesTotal = numReplies,
          numPostsTotal = pagePartsDao.numPostsTotal)
        transaction.updatePageMeta(correctMeta, oldMeta = pageMeta, markSectionPageStale = true)
      }
    }

    site
  }

}

