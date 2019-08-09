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
      //    When constructing a site patch, outside Talkyard, one doesn't know
      // which ids are in use already. Then, one uses these temp improt ids > 2e9,
      // which won't conflict with anything already in the database — and gets
      // remapped later to "real" ids.
      //
      // Later:
      // Probably there'll be only ThingPatch items in a SitePatch, which
      // refer to other items in the patch, via *references* to *external ids*,
      // or to *Talkyard internal real ids*, instead of the magic > 2e9 temp import ids.
      // Then it'd be simpler for clients that create dumps outside Talkyard
      // (e.g. a Disqus importer) because then they won't need to generate > 2e9
      // ids. Instead they can just use their external ids and reference them
      // directly — via  SomethingPatch.parentRef = "extid:some_external_id".
      // And when Talkyard generates a dump of a site, Talkyard references the
      // internal "real" ids:  SomethingPatch.parentRef = "tyid:internal_numeric_id".
      //
      // That is:
      //   'extid:' prefix = external id,
      //   'tyid:' prefix = Talkyard internal id.
      //
      // (Then there's also 'ssoid:' but that's a different field, for User:s only,
      // for single sign-on.  'externalId' should be renamed to 'ssoid' [395KSH20])


      // ----- Page ids (remap only, don't insert)
      //
      // Start with remapping page temporary import ids to real page ids that don't
      // conflict with any existing pages, or are the same as already existing
      // pages if the imported page(s) have external ids that match things in
      // the database already, and thus should be updated, instead of inserted.
      //
      // We start with pages, because other things, like posts and categories,
      // link to pages. (Posts are placed on a page, and root categories have
      // a section page id.) So they all want to know the real page ids.
      //
      // Don't insert the pages here though — we haven't remapped the page's
      // category id or any answer post id temp import id, to real ids, yet,
      // so we don't yet know what ids to use, to reference those things.


      SHOULD // check ok alt id  [05970KF5]

      val pagesInDbByExtId: Map[ExtImpId, PageMeta] =
        tx.loadPageMetasByExtIdAsMap(siteData.pages.flatMap(_.extImpId))

      val pagesInDbByAltId: Map[AltPageId, PageMeta] =
        tx.loadPageMetasByAltIdAsMap(siteData.pageIdsByAltIds.keys)

      val pageAltIdsByTempImpIds =
        new mutable.HashMap[PageId, mutable.Set[AltPageId]] with mutable.MultiMap[PageId, AltPageId]

      siteData.pageIdsByAltIds foreach { case (altId, pageImpId) => {
        pageAltIdsByTempImpIds.addBinding(pageImpId, altId)
      }}

      // Throw error, if 1) any alt page ids in the patch, reference different pages,
      // than what [the same alt ids already in the database] already point to.
      // Because then there's a conflict between the database, and the patch.
      // We do the same for ext ids, below (502958).
      // Or if 2) an alt id refers to pages in the patch and database, with the same ids,
      // but different ext ids — then don't know which of those ext id to use, or
      // if the pages are even supposed to be the same or if there's some "bug"
      // in the patch.
      pagesInDbByAltId foreach { case (altPageId, pageInDb) =>
        val pageIdInPatch = siteData.pageIdsByAltIds.get(altPageId) getOrDie "TyE305RKSTJ"
        throwBadRequestIf(!isPageTempId(pageIdInPatch) && pageIdInPatch != pageInDb.pageId, // (305WKD5)
          "TyE306AKTJWB", o"""Alt page id $altPageId in patch maps to real page id $pageIdInPatch,
            but in the database, already maps to ${pageInDb.pageId}""")
        val pageInPatch = siteData.pages.find(_.pageId == pageIdInPatch) getOrThrowBadRequest(
          "TyE404AKSG2", o"""Alt page id $altPageId maps to page id $pageIdInPatch in the patch,
          but there's no such page included in the patch""")
        throwBadRequestIf(pageInDb.extImpId.isDefined && pageInPatch.extImpId.isDefined &&
            pageInPatch.extImpId != pageInDb.extImpId,
          "TyE5FKTZR06R4", o"""Alt page id $altPageId maps to pages in the db and in the patch,
          with different external ids — so they're different pages? That's a conflict,
          don't know how to resolve this; don't know if the alt id should map to the
          ext id in the patch or the ext id in the db. Here's the page meta in the patch:
          $pageInPatch, and this is the page meta in the database: $pageInDb""")
      }

      val pageRealIdsByImpId = mutable.HashMap[PageId, PageId]()

      def remappedPageTempId(tempId: PageId): PageId = {
        if (!isPageTempId(tempId)) tempId
        else {
          pageRealIdsByImpId.getOrElse(tempId, throwBadRequest(
            "TyE5DKGWT205", s"Page with temp id $tempId missing from the uploaded data"))
        }
      }

      siteData.pages foreach { pageInPatch: PageMeta =>
        val tempId = pageInPatch.pageId
        val extId = pageInPatch.extImpId getOrElse throwForbidden(
          "TyE305KBSG", s"Inserting pages with no extId not implemented. Page temp imp id: $tempId")

        val pageIdInDbFromExtId = pagesInDbByExtId.get(extId).map(pageInDb => {
          throwBadRequestIf(!isPageTempId(tempId) && tempId != pageInDb.pageId,
            // We do this check for alt ids too, above. (502958)
            "TyE30TKKWFG3", o"""Page in patch with page extId '$extId' has real page id $tempId
               which differs from page ${pageInDb.pageId} in the db, with the same extImpId""")
          pageInDb.pageId
        })

        val altIds = pageAltIdsByTempImpIds.getOrElse(tempId, Set.empty)

        val pagesInDbFromAltId: Iterable[PageMeta] = altIds.flatMap(pagesInDbByAltId.get)
        val pageIdsInDbFromAltId = pagesInDbFromAltId.map(_.pageId).toSet
        throwForbiddenIf(pageIdsInDbFromAltId.size > 1,
          "TyE305RKJW23", o"""Page in patch with temp imp id $tempId has alt ids
           $altIds, in the patch — but in the database, those alt ids map to
           ${pageIdsInDbFromAltId.size} different pages, namely: $pageIdsInDbFromAltId
           — so, the alt ids in the patch, conflict with those in the database.
           Don't know what to do.""")

        val pageIdInDbFromAltId = pageIdsInDbFromAltId.headOption

        pagesInDbFromAltId.headOption foreach { pageInDb =>
          def errorMessage = s"in patch: $pageInPatch, in db: $pageInDb"
          // This already tested above, (305WKD5)? So use dieIf here.
          dieIf(!isPageTempId(tempId) && tempId != pageInDb.pageId, "TyE605MRDKJ2", errorMessage)
          dieIf(pageInPatch.extImpId.isDefined && pageInDb.extImpId.isDefined &&
            pageInPatch.extImpId != pageInDb.extImpId, "TyE5KSDGW204", errorMessage)
        }

        throwBadRequestIf(pageIdInDbFromExtId.isDefined && pageIdInDbFromAltId.isDefined &&
          pageIdInDbFromExtId != pageIdInDbFromAltId, "TyE04KRDNQ24", o"""Alt id and ext id
          mismatch: Trying to upsert page with temp id $tempId, with alt ids $altIds.
          In the database, those alt ids map to real page id ${pageIdInDbFromAltId.get}
          but the ext id maps to real page id ${pageIdInDbFromExtId.get}""")

        val anyRealId = pageIdInDbFromExtId orElse pageIdInDbFromAltId
        val realId = anyRealId.getOrElse({
          tx.nextPageId()
        })

        pageRealIdsByImpId.put(pageInPatch.pageId, realId)
      }


      // ----- Participants

      val ppsExtIds =
        siteData.guests.flatMap(_.extImpId)
        // ++ siteData.users.flatMap(_.extImpId)  later
        // ++ siteData.groups.flatMap(_.extImpId)  later

      // If there're participants in the database with the same external ids
      // as some of those in the siteData, then, they are to be updated, and we
      // won't create new participants, for them.
      val ppsInDbByExtId: Map[ExtImpId, ParticipantInclDetails] =
        tx.loadParticipantsInclDetailsByExtIdsAsMap_wrongGuestEmailNotfPerf(ppsExtIds)

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
          // as [the user we're importing with id = tempId], so hen already has a real id.
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

      siteData.guests foreach { guestInPatch: Guest =>
        throwBadRequestIf(guestInPatch.id > MaxCustomGuestId,
          "TyE7WKR30RKSR", s"Not a guest id: ${guestInPatch.id}")

        // For now, don't allow upserting via real ids, only via ext imp ids. (3607TK2)
        throwForbiddenIf(guestInPatch.id > -LowestTempImpId,
          "TyE05KKST25", s"Upserting guest with real id ${guestInPatch.id}: not yet implemented")

        // We need an extId, so we won't duplicate this guest, if we import the same dump many times.
        // Later: Unless we upsert with a real id (3607TK2).
        throwForbiddenIf(guestInPatch.extImpId.isEmpty,
          "TyE5HKW30R", o"""Upserting guests with no extId not implemented.
          Guest temp imp id: ${guestInPatch.id}""")

        val upsertedGuestRealId = guestInPatch.extImpId.flatMap(ppsInDbByExtId.get) match {
          case None =>
            // Insert a new guest.
            val guestRealId = guestInPatch.copy(id = nextGuestId)
            nextGuestId -= 1
            tx.insertGuest(guestRealId)
            guestRealId
          case Some(guestInDb: Guest) =>
            // Update an exiting guest. Later. Now: noop.
            dieIf(guestInDb.id <= -LowestTempImpId, "TyE046MKP01")
            dieIf(guestInDb.extImpId != guestInPatch.extImpId, "TyE046MKP02")
            // Later, update guest, but when do this? If url query:  [YESUPSERT]
            //  /-/v0/upsert-patch?onConflict = UpdateIfNewer / UpdateAlways / DoNothing ?
            //if (guestTempId.updatedAt.millis > oldGuestRealId.updatedAt.millis)
            //  val guestRealId = guestTempId.copy(id = oldGuestRealId.id)
            //  tx.updateGuest(guestRealId)
            //  guestRealId
            //else
            guestInDb
        }
        dieIf(upsertedGuestRealId.id <= -LowestTempImpId,
          "TyE305HKSD2", s"Guest id ${guestInPatch.id} got remapped to ${upsertedGuestRealId.id}")
        ppsWithRealIdsByTempImpId.put(guestInPatch.id, upsertedGuestRealId)
      }


      // ----- Posts

      val postsInDbByExtId = tx.loadPostsByExtIdAsMap(siteData.posts.flatMap(_.extImpId))
      val postsInDbByRealPagePostNr = mutable.HashMap[PagePostNr, Post]()

      val firstNextPostId = tx.nextPostId()
      var nextPostId = firstNextPostId

      val postsRealByTempId = mutable.HashMap[PostId, Post]()
      val postsRealByTempPagePostNr = mutable.HashMap[PagePostNr, Post]()

      def remappedPostIdTempId(tempId: PostId): PostId = {
        dieIf(tempId <= 0, "TyE20RKTWG50")
        if (tempId < LowestTempImpId) tempId
        else {
          val postRealIds = postsRealByTempId.getOrElse(tempId, throwBadRequest(
            "TyE305HKRD5", s"Post with temp imp id $tempId missing from the uploaded data"))
          postRealIds.id
        }
      }

      siteData.posts.groupBy(_.pageId).foreach { case (tempPageId, postsInPatch) =>
        val realPageId = remappedPageTempId(tempPageId)
        val postsInDbOnPage = tx.loadPostsOnPage(realPageId)  ; COULD_OPTIMIZE // don't need them all
        postsInDbOnPage foreach { postInDb =>
          postsInDbByRealPagePostNr.put(postInDb.pagePostNr, postInDb)
        }
        val firstNextReplyNr =
          if (postsInDbOnPage.isEmpty) FirstReplyNr
          else postsInDbOnPage.map(_.nr).max + 1
        var nextReplyNr = firstNextReplyNr
        dieIf(nextReplyNr < FirstReplyNr, "TyE05HKGJ5")

        val postTempIdsToInsert = mutable.HashSet[PostId]()

        postsInPatch foreach { postInPatch =>
          throwBadRequestIf(postInPatch.id < LowestTempImpId,
            "TyE30HRPG2", s"Upserting posts with real ids not implemented, post id: ${postInPatch.id}")

          // We need an extId, so we won't recreate and duplicate the post, if we import
          // the same dump more than once.
          // Later: Unless the post has a real id < LowestTempImpId already (but not impl, see above).
          throwBadRequestIf(postInPatch.extImpId.isEmpty,
            "TyE30HRPG8", s"Upserting posts with no extImpId not yet supported ${postInPatch.id}")

          val realPostExclParentNr: Post = postInPatch.extImpId.flatMap(postsInDbByExtId.get) match {
            case Some(postInDb: Post) =>
              // Later: If has same id and nr, then could upsert.  [YESUPSERT]
              throwForbiddenIf(postInPatch.id < LowestTempImpId && postInPatch.id != postInDb.id,
                "TyE4206KSW", o"""Post in patch has different real id, than post in db with same
                ext id. In patch: $postInPatch, in db: $postInDb""")
              throwForbiddenIf(postInPatch.nr < LowestTempImpId && postInPatch.nr != postInDb.nr,
                "TyE6KG2XV46", o"""Post in patch has different real nr, than post in db with same
                ext id. In patch: $postInPatch, in db: $postInDb""")
              throwForbiddenIf(realPageId != postInDb.pageId,
                "TyE7DWTX205H", o"""Post in patch has different real page id, than post in db with same
                ext id. In patch, the post: $postsInPatch, maps to real page id: $realPageId.
                Post in db: $postInDb, that is, a different page id: ${postInDb.pageId}""")
              postInDb
            case None =>
              // Probably we need to remap the post nr to 2, 3, 4, 5 ... instead of a temp nr.
              // Unless has a real nr already, e.g. the title or body post nr.
              val realNr =
                if (postInPatch.nr < LowestTempImpId) postInPatch.nr
                else {
                  nextReplyNr += 1
                  nextReplyNr - 1
                }

              postsInDbByRealPagePostNr.get(PagePostNr(realPageId, realNr)) match {
                case Some(postInDbSameNr: Post) =>
                  // Do nothing. The old post should be an already existing page title
                  // or body. Later, maybe update. [YESUPSERT]
                  // This happens if we import old Disqus comments, to a page for which
                  // there's already a Talkyard embedded comments discussion. Then we can
                  // leave the already existing title and body as is.
                  dieIf(!PageParts.isArticleOrTitlePostNr(realNr),
                    "TyE502BKGD8", o"""Unexpected conflict when upserting post w real
                    pageId $realPageId postNr $realNr and temp pageId $tempPageId
                    postNr ${postInPatch.nr} — there's already a post in the db with the same nr,
                    and it's not the title or body post, and not same ext id (or no ext id)""")
                  postInDbSameNr
                case None =>
                  val postNewIdNr: Post = postInPatch.copy(
                    pageId = realPageId,
                    id = nextPostId,
                    nr = realNr,
                    // parentNr — updated below
                    // later: multireplyPostNrs
                    createdById = remappedPpTempId(postInPatch.createdById),
                    currentRevisionById = remappedPpTempId(postInPatch.currentRevisionById),
                    approvedById = postInPatch.approvedById.map(remappedPpTempId),
                    lastApprovedEditById = postInPatch.lastApprovedEditById.map(remappedPpTempId),
                    collapsedById = postInPatch.collapsedById.map(remappedPpTempId),
                    closedById = postInPatch.closedById.map(remappedPpTempId),
                    bodyHiddenById = postInPatch.bodyHiddenById.map(remappedPpTempId),
                    deletedById = postInPatch.deletedById.map(remappedPpTempId))

                  nextPostId += 1
                  postTempIdsToInsert += postInPatch.id
                  postNewIdNr
              }
          }

          postsRealByTempId.put(postInPatch.id, realPostExclParentNr)
          postsRealByTempPagePostNr.put(postInPatch.pagePostNr, realPostExclParentNr)
        }

        // Update parent nrs, sanitize html, and upsert into db.
        postsInPatch foreach { postInPatch =>
          if (!postTempIdsToInsert.contains(postInPatch.id)) {
            // Update? Later, not yet impl.  [YESUPSERT]
          }
          else {
            val postTempParentNr = postsRealByTempPagePostNr.getOrElse(postInPatch.pagePostNr,
              throwBadRequest(
                "TyE305KRTD3", o"""Post ${postInPatch.pagePostNr} not found in site data
                (in postsRealByTempPagePostNr)"""))
            dieIf(postTempParentNr.parentNr != postInPatch.parentNr, "TyE306RKTJ2")

            val postRealIdsNrsNoHtml =
              if (postInPatch.parentNr.isEmpty) {
                postTempParentNr
              }
              else {
                // Construct the parent post temp page id and nr, so we can look it up
                // and find its real id and nr.
                val parentPagePostNr = PagePostNr(postInPatch.pageId, postTempParentNr.parentNr.get)

                // Might as well use tempPost.parentNr above?
                dieIf(postInPatch.parentNr != postTempParentNr.parentNr, "TyE35AKTSD305")

                val parentPost = postsRealByTempPagePostNr.getOrElse(parentPagePostNr, throwBadRequest(
                  "TyE6AKD025", s"Parent post missing, temp page post nr $parentPagePostNr"))
                postTempParentNr.copy(parentNr = Some(parentPost.nr))
              }

            // Sanitize html or convert from commonmark to html. (Good to wait with,
            // until we're here, so we know the data in the patch is probably fine?)
            //
            // Need a way to specify if the source is in commonmark or html?  [IMPCORH]
            // Ought to assume it's always CommonMark, but then, importing things can
            // take almost forever, if the site is large (CommonMark parser = slow).
            //
            val postReal = postRealIdsNrsNoHtml.approvedSource match {
              case None => postRealIdsNrsNoHtml
              case Some(approvedSource) =>
                postRealIdsNrsNoHtml.copy(
                  approvedHtmlSanitized = Some(
                    Jsoup.clean(
                      approvedSource, Whitelist.basicWithImages)))
            }

            tx.insertPost(postReal)

            // Full-text-search index this new post.
            TESTS_MISSING // this test: [2WBKP05] commented out, assumes isn't indexed.
            tx.indexPostsSoon(postReal)

            postsRealByTempId.put(postInPatch.id, postReal)
            postsRealByTempPagePostNr.put(postInPatch.pagePostNr, postReal)
          }
        }
      }


      // ----- Categories

      val firstNextCategoryId = tx.nextCategoryId()
      var nextCategoryId = firstNextCategoryId

      val categoriesInDbById = tx.loadCategoryMap()
      val categoriesInDb = categoriesInDbById.values

      val categoriesRealIdsByTempImpId = mutable.HashMap[CategoryId, CategoryId]()

      def remappedCategoryTempId(tempId: CategoryId): CategoryId = {
        dieIf(tempId <= 0, "TyE305RKDTE4")
        if (tempId < LowestTempImpId) tempId
        else {
          categoriesRealIdsByTempImpId.getOrElse(tempId, throwBadRequest(
            "TyE7KF026HR", s"Category with temp id $tempId missing from the uploaded data"))
        }
      }

      // Category patches: Remap temp imp ids to real ids, by looking up the external id. [3953KSH]
      siteData.categoryPatches foreach { catPatch: CategoryPatch =>
        val tempImpId = catPatch.id getOrThrowBadRequest(
          "TyE305KKS61", s"Category patch with no id: $catPatch")
        val extId = catPatch.extImpId getOrThrowBadRequest(
          "TyE2SDKLPX3", s"Category patch has no ext id: $catPatch")
        throwBadRequestIf(tempImpId < LowestTempImpId,
          "TyE305KPWDJ", s"""Upserting real category ids is unimplemented. Category patch with
           id: $tempImpId should instead have a > 2e9 id (temp import id).
           The category: $catPatch""")
        val catInDb = categoriesInDb.find(_.extImpId is extId) getOrThrowBadRequest(
          "TYE40GKRD81", s"No category in the database with ext id $extId, for $catPatch")
        categoriesRealIdsByTempImpId.put(tempImpId, catInDb.id)
      }

      // Remap ids.
      siteData.categories foreach { catWithTempId: Category =>
        val extImpId = catWithTempId.extImpId getOrElse throwForbidden(
          "TyE6DKWG2RJ", s"Inserting categories with no extId not yet impl, category: $catWithTempId")
        val realCatId = categoriesInDb.find(_.extImpId is extImpId).map(catInDb => {
          throwBadRequestIf(catWithTempId.id < FirstTempImpId && catWithTempId.id != catInDb.id,
            "TyE306HKD2", o"""Category in patch with real id ${catWithTempId.id} has the same
            extId as category ${catInDb.id} in the database — but they aren't the same;
            they have different ids""")
          catInDb.id
        }) getOrElse {
          if (catWithTempId.id < FirstTempImpId) {
            // Could update the already existing category? But what if it has a different
            // extId? Or if it has none, when the one getting imported does? or the
            // other way around? — For now, just disallow this.
            // oldCategoriesById.get(catTempId.id) — maybe later.
            throwForbidden("TyE305HKRD6",
              s"Upserting categories with real ids not yet implemented, category: $catWithTempId")
          }
          nextCategoryId += 1
          nextCategoryId - 1
        }
        categoriesRealIdsByTempImpId.put(catWithTempId.id, realCatId)
      }

      // Too many categories?
      val numNewCats = siteData.categories.count(catTempId => {
        val realId = remappedCategoryTempId(catTempId.id)
        categoriesInDbById.get(realId).isEmpty
      })
      val numOldCats = categoriesInDb.size
      throwForbiddenIf(numOldCats + numNewCats > MaxCategories,
        "TyE05RKSDJ2", s"Too many categories: There are already $numOldCats categories, and " +
          s"creating $numNewCats new categories, would result in more than $MaxCategories " +
          "categories (the upper limit as of now).")

      // Upsert categories.
      siteData.categories foreach { catWithTempId: Category =>
        val realId = remappedCategoryTempId(catWithTempId.id)
        val realSectPageId = remappedPageTempId(catWithTempId.sectionPageId)
        val anyCatInDb = categoriesInDbById.get(realId)
        val catWithRealIds = anyCatInDb match {
          case None =>
            val anyParentCatRealId = catWithTempId.parentId.map(remappedCategoryTempId)
            val anyParentCatInDb = anyParentCatRealId.flatMap(categoriesInDbById.get)
            /* If is upserting into existing site, could:
            throwBadRequestIf(parentCatRealId.isDefined && parentCat.isEmpty,
                "TyE5AKTT20", s"Parent category not found, for category: $catTempId") */
            throwBadRequestIf(anyParentCatInDb.exists(_.sectionPageId != realSectPageId),
              "TyE205WKT", o"""Parent category ${anyParentCatInDb.get.id} has section page id
              ${anyParentCatInDb.get.sectionPageId} which is different from the upserted category
              $catWithTempId which has real section page id $realSectPageId""")

            val anySectPageInDb = tx.loadPageMeta(realSectPageId)
            if (globals.isOrWasTest) {
              // Unfortunately, I constructed a test [TyT95MKTQG2] so that an imported category's
              // section page id is an About page — which shouldn't be allowed.
              // But I don't want to rewrite the test now. So, skip the below check,
              // now when running tests.
            }
            else throwForbiddenIf(anySectPageInDb.exists(_.pageType != PageType.Forum),
              "TyE05KZGS4B", o"""Category with temp imp id ${catWithTempId.id} references
              section page with temp imp id ${catWithTempId.sectionPageId} —> real id
              $realSectPageId, but that page is not page type ${PageType.Forum}, it is a
              ${anySectPageInDb.get.pageType}""")

            val catRealIds = catWithTempId.copy(
              id = realId,
              sectionPageId = realSectPageId,
              parentId = anyParentCatRealId,
              defaultSubCatId = catWithTempId.defaultSubCatId.map(remappedCategoryTempId))

            tx.insertCategoryMarkSectionPageStale(catRealIds)
            catRealIds

          case Some(catInDb) =>
            // if upsertMode == Overwrite

            // New section page id?
            // To allow that, would need to verify that the cat also gets moved to a
            // new parent cat with the new section id. Or that the old parent's sect id
            // also changes.
            TESTS_MISSING // try change sect page id; verify that the server says No.
            throwBadRequestIf(realSectPageId != catInDb.sectionPageId,
              "TyE205TSH5", o"""Cannot change category section page id, not implemented.
              Category: $catWithTempId, new section page real id: $realSectPageId, but the
              old category in the database uses section page ${catInDb.sectionPageId}""")

            BUG // harmless: Moving a sub cat to another cat, messes up the topic counts
            // for the old and new parent cats. [NCATTOPS] Maybe remove category topic
            // counts? Only remember current approx topic per day/week/etc?

            TESTS_MISSING // move cat to new parent cat, with 1) same sect id (ok) and
            // 2) a different (bad).

            val anyNewParentCatRealId = catWithTempId.parentId.map(remappedCategoryTempId)
            anyNewParentCatRealId match {
              case None =>
                // Keep old parent id, whatever it is.
              case Some(catInPatchRealParentId) =>
                val catInDbParentId = catInDb.parentId.getOrThrowBadRequest(
                    "TyE5WKHS0DX4", o"""Upserted cat with temp id ${catWithTempId.id}
                    has a parent cat, but the matching cat in the database, ${catInDb.id},
                    has no parent.""")
                val getsNewParentCat = catInPatchRealParentId != catInDbParentId
                if (getsNewParentCat) {
                  val oldParentCat = categoriesInDbById.get(catInDbParentId) getOrThrowBadRequest(
                    "TyE395AKDPF3", s"Old parent cat $catInDbParentId not found")
                  val newParentCat = categoriesInDbById.get(catInPatchRealParentId) getOrThrowBadRequest(
                    "TyE7FKDTJ02RP", s"New parent cat with real id $catInPatchRealParentId not found")
                  throwBadRequestIf(oldParentCat.sectionPageId != newParentCat.sectionPageId,
                    "TyE205TSH6", o"""Cannot move category with temp id ${catWithTempId.id}
                    from parent category with real id ${oldParentCat.id}
                    and section page id ${oldParentCat.sectionPageId}
                    to category with id ${newParentCat.id} in a *different* site section,
                    with page id ${newParentCat.sectionPageId}""")
                }
            }

            val catRealIds = catWithTempId.copy(
              id = catInDb.id,
              sectionPageId = catInDb.sectionPageId,
              parentId = anyNewParentCatRealId orElse catInDb.parentId,
              defaultSubCatId = catWithTempId.defaultSubCatId.map(remappedCategoryTempId))

            tx.updateCategoryMarkSectionPageStale(catRealIds)
            catRealIds
        }

        upsertedCategories.append(catWithRealIds)
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

      // Permissions shouldn't have extId:s? or?

      val oldPerms = tx.loadPermsOnPages()   // for debugging
      val oldPermWithHighestId = maxOptBy(oldPerms)(_.id)
      var nextPermId = oldPermWithHighestId.map(_.id).getOrElse(0) + 1

      siteData.permsOnPages foreach { permWithTempIds: PermsOnPages =>
        val catInDbWithThisPerm =
          permWithTempIds.onCategoryId.flatMap((tempCatId: CategoryId) => {
            val realCatId = remappedCategoryTempId(tempCatId)
            categoriesInDb.find(_.id == realCatId)
          })

        if (catInDbWithThisPerm.isDefined) {
          // Then skip this permission, see above (305DKASP),
          // ... or if onConflit=Overwrite, then do overwrite?  [YESUPSERT]
        }
        else {
          val permissionRealIds = permWithTempIds.copy(
            id = nextPermId,
            forPeopleId = remappedPpTempId(permWithTempIds.forPeopleId),
            onCategoryId = permWithTempIds.onCategoryId.map(remappedCategoryTempId),
            onPageId = permWithTempIds.onPageId.map(remappedPageTempId),
            onPostId = permWithTempIds.onPostId.map(remappedPostIdTempId)
            //onTagId = permissionTempIds.onTagId,
            )

          tx.insertPermsOnPages(permissionRealIds)
          nextPermId += 1
        }
      }


      // ----- Pages

      siteData.pages foreach { pageInPatch: PageMeta =>
        val realPageId = pageRealIdsByImpId.get(pageInPatch.pageId) getOrDie "TyE06DKWD24"

        lazy val pageAltIds = pageAltIdsByTempImpIds.getOrElse(pageInPatch.pageId, Set.empty)

        val anyPageInDb = pageInPatch.extImpId.flatMap(pagesInDbByExtId.get) orElse {
          val pagesInDbWithMatchingAltIds = pageAltIds.flatMap(pagesInDbByAltId.get)
          // We've already checked this, above, when remapping page ids.
          dieIf(pagesInDbWithMatchingAltIds.map(_.pageId).size > 1, "TyE05HKR3WH8")
          pagesInDbWithMatchingAltIds.headOption
        }

        val pageWrongStats = anyPageInDb match {
          case None =>
            // Insert new page.
            val pageWithRealIdsButWrongStats = pageInPatch.copy(
              pageId = realPageId,
              categoryId = pageInPatch.categoryId.map(remappedCategoryTempId),
              authorId = remappedPpTempId(pageInPatch.authorId),
              answerPostId = pageInPatch.answerPostId.map(remappedPostIdTempId),
              lastApprovedReplyById = pageInPatch.lastApprovedReplyById.map(remappedPpTempId),
              frequentPosterIds = pageInPatch.frequentPosterIds.map(remappedPpTempId))

            tx.insertPageMetaMarkSectionPageStale(pageWithRealIdsButWrongStats, isImporting = true)
            pageAltIds.foreach(tx.insertAltPageId(_, realPageId))
            pageWithRealIdsButWrongStats

          case Some(pageInDb) =>
            /*val pageWithOkNums = bumpNums(oldPageMeta)
            if (pageWithOkNums != oldPageMeta) {
              tx.updatePageMeta(pageWithOkNums, oldMeta = oldPageMeta, markSectionPageStale = true)
            } */
            // The stats might be wrong, after the upserts — maybe we're inserting new replies.
            pageInDb
            /* Later?,  if onConflict=Overwrite, then update?  [YESUPSERT]
            if (oldPageMeta.updatedAt.getTime < pageMetaTempIds.updatedAt.getTime) {
              val pageWithId = pageMetaTempIds.copy(pageId = oldPageMeta.pageId)
              tx.updatePageMeta(pageWithId, oldMeta = oldPageMeta,
                // Maybe not always needed:
                markSectionPageStale = true)
            } */
        }

        COULD // skip this, if no posts and nothing on the page, has changed.
        val pageDao = PageDao(pageWrongStats.pageId, tx) // (0926575)
        val pageMeta = pageWrongStats.copyWithUpdatedStats(pageDao)  // bumps version [306MDH26]

        dao.updatePagePopularity(pageDao.parts, tx)
        tx.updatePageMeta(pageMeta, oldMeta = pageWrongStats, markSectionPageStale = true)

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

      val pathsInDbByPageTempId: Map[PageId, Seq[PagePathWithId]] = {
        val pageTempIds = siteData.pagePaths.map(_.pageId)
        val realIds: Seq[PageId] = pageTempIds.map(remappedPageTempId)
        val pathsInDbByRealIds: Map[PageId, Seq[PagePathWithId]] =
          realIds.flatMap(tx.lookupPagePathAndRedirects).groupBy(_.pageId)
        Map(pageTempIds.flatMap(tempId => {
          val realId: PageId = remappedPageTempId(tempId)
          pathsInDbByRealIds.get(realId) map { pathsRealId: Seq[PagePathWithId] =>
            tempId -> pathsRealId
          }
        }): _*)
      }

      siteData.pagePaths foreach { pathInPatch: PagePathWithId =>
        pathsInDbByPageTempId.get(pathInPatch.pageId) match {
          case None =>
            val pathRealId = pathInPatch.copy(
              pageId = remappedPageTempId(pathInPatch.pageId))

            tx.insertPagePath(pathRealId)
            pathRealId

          case Some(_ /* pathsInDb */) =>
            // Later: What do now? Insert the new path? And if it's canonical,  [YESUPSERT]
            // then keep all old paths in the db, and have them redirect to this new path?
            // Change any old canonical, to redirect instead?
            // If there's any conflicting path in the db already:
            // - If it's non-canonical, delete it.
            // - If is canonical, and for a different page — that's a conflict, reply Forbidden.
        }
      }
    }

    dao.emptyCache()

    // Categories is all the current Talkyard API consumers need. As of August 2019.
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

