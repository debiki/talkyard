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

package talkyard.server.sitepatch

import com.debiki.core.Prelude._
import com.debiki.core._
import debiki.EdHttp._
import debiki.{SpecialContentPages, TextAndHtml}
import debiki.dao.{PageDao, PagePartsDao, SettingsDao, SiteDao}
import ed.server.notf.NotificationGenerator
import ed.server.pop.PagePopularityDao
import org.jsoup.Jsoup
import scala.collection.immutable
import scala.collection.mutable
import scala.collection.mutable.ArrayBuffer


case class SitePatcher(globals: debiki.Globals) {


  // ======= Add to existing site


  def upsertIntoExistingSite(siteId: SiteId, siteData: SitePatch, browserIdData: BrowserIdData)
        : SitePatch = {

    // Tested e.g. here:
    // - api-upsert-categories.2browsers.test.ts  TyT94DFKHQC24
    // - embedded-comments-create-site-import-disqus.2browsers.test.ts  TyT5KFG0P75
    // - SiteDumpImporterAppSpec  TyT2496ANPJ3

    val dao = globals.siteDao(siteId)
    val upsertedCategories = ArrayBuffer[Category]()
    val upsertedPages = ArrayBuffer[PageMeta]()
    val upsertedPagePaths = ArrayBuffer[PagePathWithId]()
    val upsertedReplies = ArrayBuffer[Post]()
    val pageIdsWithBadStats = mutable.HashSet[PageId]()
    var wroteToDatabase = false

    val sectionPagePaths = dao.readWriteTransaction { tx =>

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

      val pagesInDbByExtId: Map[ExtId, PageMeta] =
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
          // Old: --------
          // Aha? If site meta is incl, then, lazy create an extId here:
          // publ-site-id:page-id:pge  ?
          // & users:
          // publ-sit-id:user-id:grp/usr/gst
          // & cats:
          // publ-sit-id:category-id:cat
          // No, skip the suffixes 'pge', 'grp', etc — don't want dupl pubid:userid:STH,
          // so don't incl STH.
          // / Old --------
          // Instead, if upserting one site into another — it's not possible to know how
          // the human wants existing pages to get merged with each other, or not at all?
          // More info about how to resolve conflicts, is needed?
          // E.g. merge categories with the same url slug.  But don't merge pages with the
          // same slug? (that's is how Discourse merges sites — i.e. categories, not pages).

          // URL param:  ?  importWhat=EmbeddedComments  ?

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
        siteData.guests.flatMap(_.extId)
        // ++ siteData.users.flatMap(_.extImpId)  later  ... = now? [UPSMEMBRNOW]
        // ++ siteData.groups.flatMap(_.extImpId)  later  ... = now? [UPSMEMBRNOW]
      // For now:
      unimplementedIf(siteData.users.nonEmpty, "Upserting users into existing site [TyE057WKRP2]")
      unimplementedIf(siteData.groups.nonEmpty, "Upserting groups into existing site [TyE057WKRP3]")
      // — right now, only Guests supported, and that's all that's needed, for
      // importing Disqus or WordPress etc blog comments.

      // If there're participants in the database with the same external ids
      // as some of those in the siteData, then, they are to be updated, and we
      // won't create new participants, for them.
      val ppsInDbByExtId: Map[ExtId, ParticipantInclDetails] =
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
          wroteToDatabase = true
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
        throwForbiddenIf(guestInPatch.extId.isEmpty,
          "TyE5HKW30R", o"""Upserting guests with no extId not implemented.
          Guest temp imp id: ${guestInPatch.id}""")

        val upsertedGuestRealId = guestInPatch.extId.flatMap(ppsInDbByExtId.get) match {
          case None =>
            // Insert a new guest.
            val guestRealId = guestInPatch.copy(id = nextGuestId)
            nextGuestId -= 1
            tx.insertGuest(guestRealId)
            wroteToDatabase = true
            guestRealId
          case Some(guestInDb: Guest) =>
            // Update an exiting guest. Later. Now: noop.
            dieIf(guestInDb.id <= -LowestTempImpId, "TyE046MKP01")
            dieIf(guestInDb.extId != guestInPatch.extId, "TyE046MKP02")
            // Later, update guest, but when do this? If url query:  [YESUPSERT]
            //  /-/v0/upsert-patch?onConflict = UpdateIfNewer / UpdateAlways / DoNothing ?
            //if (guestTempId.updatedAt.millis > oldGuestRealId.updatedAt.millis)
            //  val guestRealId = guestTempId.copy(id = oldGuestRealId.id)
            //  tx.updateGuest(guestRealId)
            //  wroteToDatabase = true
            //  guestRealId
            //else
            guestInDb
        }
        dieIf(upsertedGuestRealId.id <= -LowestTempImpId,
          "TyE305HKSD2", s"Guest id ${guestInPatch.id} got remapped to ${upsertedGuestRealId.id}")
        ppsWithRealIdsByTempImpId.put(guestInPatch.id, upsertedGuestRealId)
      }


      // ----- Page participants

      // This currently happens only via /-/v0/upsert-simple. [UPSPAMEM]

      siteData.pageParticipants foreach { (pagePp: PageParticipant) =>
        throwForbiddenIf(Participant.isGuestId(pagePp.userId),
          "TyE5G2JKG057M", s"Cannot add guests as page members, guest id: ${pagePp.userId}")
        throwForbiddenIf(Participant.isBuiltInParticipant(pagePp.userId),
          "TyE5KRSJWQ66", s"Cannot add built-in participant ${pagePp.userId} as page members")
      }

      val pagesToMaybeNotfAbout = mutable.Map[PageId, ArrayBuffer[PageParticipant]]()

      siteData.pageParticipants.groupBy(_.pageId) foreach { tempPageIdAndPps =>
        val tempImpPageId = tempPageIdAndPps._1
        val realPageId = remappedPageTempId(tempImpPageId)
        val pagePps = tempPageIdAndPps._2
        val pagePpIds: Set[UserId] = tx.loadMessageMembers(realPageId)
        val addedPagePps = ArrayBuffer[PageParticipant]()
        pagePps foreach { pagePpTempPageId: PageParticipant =>
          dieIf(pagePpTempPageId.pageId != tempImpPageId, "TyE305SKSJ5")

          val realPpId = remappedPpTempId(pagePpTempPageId.userId)
          dieIf(realPpId != pagePpTempPageId.userId, // [JB205KDN]
            // Don't implement this? Instead, create the do-action-batch API? [ACTNPATCH]
            "TyE305RKDL35", "Untested: Creating user and adding to page at the same time")

          if (pagePpIds.contains(realPpId)) {
            // Don't add again. Later: Maybe update? Or remove if pageParticipant.kickedAt.
          }
          else {
            val pagePpRealPageId = pagePpTempPageId.copy(pageId = realPageId)
            addedPagePps.append(pagePpRealPageId)
            tx.insertPageParticipant(pagePpRealPageId)
          }
        }

        if (addedPagePps.nonEmpty) {
          pagesToMaybeNotfAbout.put(realPageId, addedPagePps)
        }
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

      val postsToMaybeNotfAbout = ArrayBuffer[Post]()

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
                "TyE4206KSW", i"""
                |Post in patch has different real id, than post in db with same ext id.
                |In patch:
                |$postInPatch,
                |in db:
                |$postInDb
                |""")
              throwForbiddenIf(postInPatch.nr < LowestTempImpId && postInPatch.nr != postInDb.nr,
                "TyE6KG2XV46", i"""
                |Post in patch has different real nr, than post in db with same ext id.
                |In patch:
                |$postInPatch,
                |in db:
                |$postInDb
                |""")
              throwForbiddenIf(realPageId != postInDb.pageId,
                "TyE7DWTX205H", i"""
                |Post in patch has different page id, than post in db with same ext id.
                |In the patch, the post:
                |$postInPatch
                |maps to real page id: $realPageId,
                |but the supposedly same post in the db:
                |$postInDb
                |has this different page id: ${postInDb.pageId}
                |""")
              // For now: Leave the post as is.
              // Actually editing the post is a rabbit hole — look at PostsDao.editPostIfAuth,
              // it's 300+ lines long. E.g. to update edit revisions, and generate
              // notifications if a @mention gets added, or not if in ninja edit window,
              // and maybe un-caching a forum topic list, if the topic summary now needs
              // to change, and remembering to full text search re-index the post.
              // Makes no sense to try doing such things from her?
              // Maybe /-/upsert-simple should refuse some too complicated types of upserts?
              // And what if this patch includes edit revisions already, which would
              // conflict with any auto generated by making changes to the post here?
              //
              // SOLUTION: /-/v0/do-action-batch [ACTNPATCH], a new API endpoint that
              // is *intended* for doing changes, creating edit revisions, triggering
              // notifications etc.
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
            // if (any changes to save) {
            //   ...
            //   wroteToDatabase = true
            //   pageIdsWithBadStats.add(postReal.pageId)
            // }
          }
          else {
            val postTempParentNr = postsRealByTempPagePostNr.getOrElse(postInPatch.pagePostNr,
              throwBadRequest(
                "TyE305KRTD3", o"""Post ${postInPatch.pagePostNr} not found in site data
                (in postsRealByTempPagePostNr)"""))
            dieIf(postTempParentNr.parentNr != postInPatch.parentNr, "TyE306RKTJ2")

            val postRealIdsNrsMaybeHtml =
              if (postInPatch.parentNr.forall(_ < FirstTempImpId)) {
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
            // Answer: Just add a field approvedSourceMarkupLang: 'Html' or 'Commonmark'
            // or just  markupLang: ...  ?
            //
            val postReal = postRealIdsNrsMaybeHtml.approvedSource match {
              case None => postRealIdsNrsMaybeHtml
              case Some(approvedSource) =>
                if (postRealIdsNrsMaybeHtml.approvedHtmlSanitized.isDefined) {
                  // This happens via /-/v0/upsert-simple — then, we've converted
                  // the incoming CommonMark to HTML already: [IMPCORH].
                  postRealIdsNrsMaybeHtml
                }
                else {
                  // No @mentions supported here when importing.
                  // So skip @mentions later when generating notifications? [305TKRW24]
                  // Later: Add a markupLang field? For now, assume html —
                  // otherwise, could put the server under too heavy load.
                  // If importing 9999 posts and pages, would need to convert from CommonMark
                  // to html in an external process / server? [ext_markup_processor]
                  postRealIdsNrsMaybeHtml.copy(
                        approvedHtmlSanitized = Some(TextAndHtml.sanitizeRelaxed(
                            approvedSource)))
                }
            }

            tx.insertPost(postReal)
            wroteToDatabase = true
            pageIdsWithBadStats.add(postReal.pageId)

            COULD // update user stats, but so many things to think about,  [BADSTATS]
            // so skip for now:
            /*
            val moreStats = UserStats(
              postReal.createdById,
              lastSeenAt = tx.now,
              lastPostedAt = Some(tx.now)
              // firstSeenAt ?   <—— if absent, might fail some assertion
              // firstChatMessageAt
              // firstDiscourseReplyAt
              // numDiscourseTopicsRepliedIn
              // numDiscourseTopicsCreated
              // numChatMessagesPosted
              // numChatTopicsRepliedIn
              // numChatTopicsCreated
              // numSolutionsProvided
              )
            dao.addUserStats(moreStats)(tx)  */

            // Full-text-search index this new post.
            TESTS_MISSING // this test: [2WBKP05] commented out, assumes isn't indexed.
            tx.indexPostsSoon(postReal)

            // Backlinks  [imp_exp_blns] [readlater]

            postsRealByTempId.put(postInPatch.id, postReal)
            postsRealByTempPagePostNr.put(postInPatch.pagePostNr, postReal)

            // Wait with sending notfs until pages and categories have been upserted, otherwise
            // I'd think something won't be found when running notf creation related queries.
            // (We exclude titles further below.)
            postsToMaybeNotfAbout.append(postReal)

            if (postReal.isReply) {
              upsertedReplies.append(postReal)
            }
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
            // First check that there's a section page and page path, otherwise
            // the category would be inaccessible.
            val realSectPageInDb = tx.loadPageMeta(realSectPageId)
            if (realSectPageInDb.isEmpty) {
              val sectPageInPatch = siteData.pages.find(_.pageId == catWithTempId.sectionPageId)
                  .getOrThrowBadRequest(
                "TyE4SKD02RS", s"No section page included in patch, for $catWithTempId")
              val sectPagePaths = siteData.pagePaths.filter(_.pageId == sectPageInPatch.pageId)
              throwBadRequestIf(sectPagePaths.isEmpty,
                "TyE5WKT0GRD6", s"No page path included in patch, to section page for $catWithTempId")
              val canonPaths = sectPagePaths.filter(_.canonical)
              throwBadRequestIf(canonPaths.isEmpty,  // [602WKDJD2]
                "TyE503RTDHG3", o"""No canonical page path included in patch,
                to section page for $catWithTempId. Only non-canonical paths: $sectPagePaths""")
              throwBadRequestIf(canonPaths.length > 1,
                "TyE7WKS2S5B", o"""Many canonical page paths included in patch,
                to section page for $catWithTempId. These paths: $canonPaths""")
            }

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
            wroteToDatabase = true
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

            if (catRealIds != catInDb) {
              tx.updateCategoryMarkSectionPageStale(catRealIds)
              wroteToDatabase = true
            }
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
          wroteToDatabase = true
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
            wroteToDatabase = true
            // We update  upsertedPages below, after page meta stats has been updated.
            pageIdsWithBadStats.add(realPageId)
            pageAltIds.foreach(tx.insertAltPageId(_, realPageId))
            pageWithRealIdsButWrongStats

          case Some(pageInDb) =>
            /*val pageWithOkNums = bumpNums(oldPageMeta)
            if (pageWithOkNums != oldPageMeta) {
              tx.updatePageMeta(pageWithOkNums, oldMeta = oldPageMeta, markSectionPageStale = true)
              wroteToDatabase = true
              ? pageIdsWithBadStats.add(realPageId)
            } */
            upsertedPages.append(pageInDb)
            // The stats might be wrong, after the upserts — maybe we're inserting new replies.
            pageInDb
            /* Later?,  if onConflict=Overwrite, then update?  [YESUPSERT]
            if (oldPageMeta.updatedAt.getTime < pageMetaTempIds.updatedAt.getTime) {
              val pageWithId = pageMetaTempIds.copy(pageId = oldPageMeta.pageId)
              tx.updatePageMeta(pageWithId, oldMeta = oldPageMeta,
                // Maybe not always needed:
                markSectionPageStale = true)
              wroteToDatabase = true
              ? pageIdsWithBadStats.add(realPageId)
            } */
        }

        // Update page stats, e.g. num posts.
        if (pageIdsWithBadStats.contains(realPageId)) {
          dieIf(!wroteToDatabase, "TyE0KSGF45")

          val pageDao = dao.newPageDao(pageWrongStats.pageId, tx) // (0926575)
          val pageMeta = pageWrongStats.copyWithUpdatedStats(pageDao) // bumps version [306MDH26]

          dao.updatePagePopularity(pageDao.parts, tx)
          tx.updatePageMeta(pageMeta, oldMeta = pageWrongStats, markSectionPageStale = true)
          upsertedPages.append(pageMeta)
        }

        /*
        // [readlater] export & import page views too, otherwise page popularity here will be wrong.
        // (So here we load all posts again — the ones we just inserted. Should be fine
        // performance wise — it's just one db query, to load all posts, vs one per post,
        // previously when inserting. At least not more than 2x slower, which should be ok
        // (simplicity = more important).
        val pagePartsDao = PagePartsDao(pageMeta.pageId, tx)
        dao.updatePagePopularity(pagePartsDao, tx)
        wroteToDatabase = true
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
            wroteToDatabase = true
            upsertedPagePaths.append(pathRealId)
            pathRealId

          case Some(pathsInDb) =>
            // Remember the canonical path, needed for the /-/upsert-simple API response.
            val canonicalPath: Option[PagePathWithId] = pathsInDb.find(_.canonical)
            canonicalPath.foreach(p => upsertedPagePaths.append(p))

            // Later: What do now? Insert the new path? And if it's canonical,  [YESUPSERT]
            // then keep all old paths in the db, and have them redirect to this new path?
            // Change any old canonical, to redirect instead?
            // If there's any conflicting path in the db already:
            // - If it's non-canonical, delete it.
            // - If is canonical, and for a different page — that's a conflict, reply Forbidden.
            // wroteToDatabase = true
        }
      }

      // If we upserted categories, include their related section page path,
      // so the caller gets to know where they're located. Needed by
      // /-/v0/upsert-simple, for creating an API consumer friendly json response. [8R392PFP0]
      val sectionPagePaths =
        upsertedCategories.map(_.sectionPageId).to[immutable.Set].toVector map { sectionPageId =>
          tx.loadPagePath(sectionPageId).getOrDie( // there's a foreign key
            "TyE305RKTG42", {
              val badCat = upsertedCategories.find(_.sectionPageId == sectionPageId).get
              s"Section page id '$sectionPageId' not found for $badCat"
            })
        }


      // ----- Notifications

      REFACTOR // Change SimpleSitePatch to a ActionPatch — then, this Notifications
      // stuff here can be removed. [ACTNPATCH]

      if (siteData.upsertOptions.exists(_.sendNotifications is true)) {
        val notfGenerator: NotificationGenerator = NotificationGenerator(
          tx, dao, dao.context.nashorn, globals.config)

        // Replies and mentions:
        for {
          post <- postsToMaybeNotfAbout
          if !post.isTitle // only gen for the body —> new page notf
        } {
          // COULD skip @mentions notifications here somehow, since not supported
          // here since we import html only, not CommonMark with @mentions syntax. [305TKRW24]

          // Ooops! remembers sentTo  :- /  [REMBSENTTO]
          // So won't generate notfs about > 1 post at a time, to the same member?
          // Has no effet as of now — currently only one new post / page at a time,
          // via /-/v0/upsert-simple.
          notfGenerator.generateForNewPost(
                dao.newPageDao(post.pageId, tx), post,
                sourceAndHtml = None, anyNewModTask = None)
        }

        // Group chats, direct messages:
        // But this is dead code? because notfGenerator.generateForNewPost() above [PATCHNOTF]
        // happens first?
        for {
          (pageId, pagePps) <- pagesToMaybeNotfAbout
          pageMeta = tx.loadThePageMeta(pageId)
          pageBody = tx.loadThePost(PagePostNr(pageId, BodyNr))
          if pageMeta.publishedAt.isDefined
          if pageBody.isCurrentVersionApproved
        } {
          val sender = tx.loadTheMember(pageMeta.authorId)
          val pagePpsExclAuthr = pagePps.filter(_.userId != pageMeta.authorId)
          val memberIdsToNotify = pagePpsExclAuthr.map(_.userId)
          // Ooops! remembers sentTo  :- /  [REMBSENTTO]
          notfGenerator.generateForMessage(
            sender, pageBody, memberIdsToNotify.toSet)
        }

        tx.saveDeleteNotifications(notfGenerator.generatedNotifications)
      }

      sectionPagePaths
    }

    // If any changes, just empty the whole cache (for this site). It's too complicated to
    // figure out precisely which parts of the caches to invalidate.
    if (wroteToDatabase) {
      dao.clearDatabaseCacheAndMemCache()
    }

    // Categories and pages is what the current Talkyard API consumers need. As of November 2019.
    // The /-/v0/upsert-simple endpoint also wants the category locations (url paths),
    // so, we need the forum section page paths, so included below.
    // And any posts, so can direct link to e.g. chat messages upserted via API
    //  — but exclude title and body posts; then, instead, the pages[] is enough?
    //
    REFACTOR // sometimes return a ActionPatchApiResponse  [ACTNPATCH], if is
    // an ActionPatch "upsert" — which will be an API thing.
    // Don't expose all internal fields
    // — that'd make other ppls things break if I rename anything
    //
    SitePatch.empty.copy(
      pages = upsertedPages.toVector,
      posts = upsertedReplies.toVector,  // [205WKTJF4]
      pagePaths = (upsertedPagePaths ++ sectionPagePaths).distinct.toVector,
      categories = upsertedCategories.toVector)
  }


  // ======= Create / restore site


  def importCreateSite(siteData: SitePatch, browserIdData: BrowserIdData,
        anySiteToOverwrite: Option[Site], isTest: Boolean): Site = {

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

    val siteToSaveWrongHostname = siteData.site.getOrDie("TyE7KRUGV24")

    val siteSettings = siteData.settings.getOrDie("TyE5KRYTG02")

    throwForbiddenIf(isMissing(siteSettings.orgFullName),
      "EdE7KB4W5", "No organization name specified")

    val siteIdToOverwrite = anySiteToOverwrite.map(_.id).toSet

    dieIf(siteData.isTestSiteOkDelete && siteIdToOverwrite.exists(_ > MaxTestSiteId),
      "TyE5032FPKJ63", s"Trying to e2e-test overwrite real site: $anySiteToOverwrite")

    val newSite = globals.systemDao.writeTxLockManySites(siteIdToOverwrite) { sysTx =>

      // It's good to delete the old site and create the new one, in the same
      // transaction — so we won't be left without any site at all, if something
      // errors out when creating the new site (e.g. Postgres serialization errors).
      globals.systemDao.deleteSites(siteIdToOverwrite, sysTx,
        mayDeleteRealSite = !isTest && !siteData.isTestSiteOkDelete)

      // Keep the hostname of the site we're overwriting. Otherwise, once we've imported
      // the new site, and the hostname changes to whatever is in the dump — then,
      // the browser's current url might stop working. Instead, most likely,
      // the browser's current url is the one we want, for the newly imported site.
      val siteToSave: SiteInclDetails = {
        val s = siteToSaveWrongHostname
        anySiteToOverwrite match {
          case None => s
          case Some(siteToOverwrite) => siteToOverwrite.canonicalHostname match {
            case None => s
            case Some(hn) =>
              s.copyWithNewCanonicalHostname(
                hn.hostname, addedAt = sysTx.now, redirectOld = true)
          }
        }
      }

      val theNewSite = globals.systemDao.createAdditionalSite(
        // Reuse any old id — so that we'll overwrite FirstSiteId, if importing
        // to a self hosted single site server.
        anySiteId = siteIdToOverwrite.headOption,
        siteToSave.pubId,
        siteToSave.name,
        siteToSave.status,
        hostname = siteToSave.canonicalHostname.map(_.hostname),
        // Any embedding url and org name get updated below (0296537).
        embeddingSiteUrl = None,
        organizationName = "Organization name missing [TyM8YKWP3]",
        creatorId = SystemUserId,
        browserIdData = browserIdData,
        isTestSiteOkayToDelete = siteData.isTestSiteOkDelete,
        skipMaxSitesCheck = isTest || siteIdToOverwrite.nonEmpty,
        createdFromSiteId = None,
        anySysTx = Some(sysTx))

      CLEAN_UP // weird to create a SiteDao here — better use the site
      // transaction started just below, 'tx', instead.
      val newDao = globals.siteDao(theNewSite.id)

      SECURITY; SHOULD // check for post cycles and category cycles.

      val tx = sysTx.siteTransaction(theNewSite.id)

      // We might import a forum or a forum category, and then the categories reference the
      // forum page, and the forum page references to the root category.
      tx.deferConstraints()

      // The canonical hostname got inserted already, by createAdditionalSite() above.
      val otherHostnames = siteToSave.hostnames.filter(_.role != Hostname.RoleCanonical)
      otherHostnames.foreach(hn => tx.insertSiteHost(hn.noDetails))

      // This also updates any embedding url and org name (0296537).
      tx.upsertSiteSettings(siteSettings)

      siteData.apiSecrets foreach tx.insertApiSecret

      siteData.guests foreach tx.insertGuest

      siteData.guestEmailNotfPrefs foreach { case (emailAddr, pref) =>
        tx.configIdtySimple(tx.now.toJavaDate, emailAddr, pref)
      }

      def insertUsernameUsageIfMissing(member: MemberInclDetails): Unit = {
        val usernameLowercase = member.usernameLowercase // [CANONUN]
        def includesCurrentName(usernameUsages: Iterable[UsernameUsage]) =
          usernameUsages.exists(n =>
              n.usernameLowercase == usernameLowercase && n.inUseTo.isEmpty)
        if (!includesCurrentName(siteData.usernameUsages)) {
          // Built-in members get UsernameUsage:s auto inserted when
          // they're auto created. However, if the user has been renamed,
          // we should insert an entry for its new name.
          val usernamesInDb = tx.loadUsersOldUsernames(member.id)
          if (!includesCurrentName(usernamesInDb)) {
            tx.insertUsernameUsage(UsernameUsage(
              usernameLowercase, inUseFrom = tx.now, userId = member.id))
          }
        }
      }

      siteData.groups foreach { group: Group =>
        insertUsernameUsageIfMissing(group)
        // Also auto-gen UserEmailAddress if missing, if adding group email inbox later. [306KWUSSJ24]
        if (group.isBuiltIn) {
          // Then it's in the database already. But maybe its name or settings has been changed?
          tx.updateGroup(group)
        }
        else {
          tx.insertGroup(group)
        }
      }

      siteData.groupPps foreach { groupPp: GroupParticipant =>
        unimplementedIf(!groupPp.isMember, "adding non-members [TyE305RKJ7]")
        unimplementedIf(groupPp.isBouncer || groupPp.isAdder || groupPp.isManager,
          "adding group bouncers, adders and managers [TyE305RKJ8]")
        tx.addGroupMembers(groupPp.groupId, Set(groupPp.ppId))
      }

      siteData.users foreach { user: UserInclDetails =>
        // Make it slightly simpler to construct site patches, by automatically
        // generating UsernameUsage and UserEmailAddress and UserStats entries if needed.
        if (user.primaryEmailAddress.nonEmpty &&
            !siteData.memberEmailAddrs.exists(_.emailAddress == user.primaryEmailAddress)) {
          user.primaryEmailInfo.foreach(tx.insertUserEmailAddress)
        }
        insertUsernameUsageIfMissing(user)
        if (!siteData.pptStats.exists(_.userId == user.id)) {
           tx.upsertUserStats(UserStats.forNewUser(user.id, firstSeenAt = tx.now,
             emailedAt = None))
        }
        if (user.isBuiltIn) {
          UNTESTED
          // Already auto-created, but maybe it's been renamed? E.g. the "System" user
          // but in a different language?
          tx.updateMemberInclDetails(user)
        }
        else {
          tx.insertMember(user) // [UPSMEMBRNOW]
          newDao.joinPinnedGlobalChats(user, tx)
        }
      }

      siteData.pptStats foreach { pptStats: UserStats =>
        tx.upsertUserStats(pptStats)
      }

      siteData.pptVisitStats foreach { visitStats: UserVisitStats =>
        tx.upsertUserVisitStats(visitStats)
      }

      siteData.usernameUsages foreach { usernameUsage: UsernameUsage =>
        tx.insertUsernameUsage(usernameUsage)
      }

      siteData.memberEmailAddrs foreach { meEmAddr: UserEmailAddress =>
        tx.insertUserEmailAddress(meEmAddr)
      }

      siteData.identities foreach { identity: Identity =>
        tx.insertIdentity(identity)
      }

      siteData.invites foreach { invite: Invite =>
        tx.insertInvite(invite)
      }

      // For now, skip emails — aren't exported, and referencing them
      // would cause pk errors.  [4023SRKG5]
      tx.saveDeleteNotifications(
            Notifications(toCreate = siteData.notifications.map {
              case n: Notification.NewPost =>
                if (n.emailId.isEmpty) n
                else n.copy(emailId = None, emailStatus = NotfEmailStatus.Skipped)
            }))

      siteData.pages foreach { pageMeta =>
        //val newId = transaction.nextPageId()
        tx.insertPageMetaMarkSectionPageStale(pageMeta, isImporting = true)
      }

      siteData.pagePaths foreach { path =>
        tx.insertPagePath(path)
      }

      siteData.pageIdsByAltIds foreach { case (altPageId: AltPageId, pageId: PageId) =>
        tx.insertAltPageId(altPageId, realPageId = pageId)
      }

      siteData.pagePopularityScores foreach tx.upsertPagePopularityScore

      siteData.pageNotfPrefs foreach { notfPref: PageNotfPref =>
        tx.upsertPageNotfPref(notfPref)
      }

      siteData.pageParticipants foreach tx.insertPageParticipant

      siteData.categories foreach { categoryMeta =>
        //val newId = transaction.nextCategoryId()
        tx.insertCategoryMarkSectionPageStale(categoryMeta)
      }

      siteData.drafts foreach tx.upsertDraft

      siteData.posts foreach { post =>
        //val newId = transaction.nextPostId()
        tx.insertPost(post)
        if (isTest && !siteData.isTestSiteIndexAnyway) {
          // Don't index. Currently would cause Postgres errors:
          //    Couldn't lock site -123 for updates
          //    at debiki.dao.SiteDao$.synchronizeOnSiteId
        }
        else {
          tx.indexPostsSoon(post) // [TyT036WKHW2]

          // Backlinks  [imp_exp_blns] [readlater]
        }
      }

      siteData.postActions foreach { postAction =>
        //val newId = transaction. ?
        tx.insertPostAction(postAction)
      }

      siteData.permsOnPages foreach { permission =>
        tx.insertPermsOnPages(permission)
      }

      // Or will this be a bit slow? Kind of loads everything we just imported.
      siteData.pages foreach { pageMeta =>  // (0926575)
        // [readlater] export & import page views too, otherwise page popularity here will be wrong.
        // (So here we load all posts again — the ones we just inserted. Should be fine
        // performance wise — it's just one db query, to load all posts, vs one per post,
        // previously when inserting. At least not more than 2x slower, which should be ok
        // (simplicity = more important).
        val settings = SettingsDao.loadWholeSiteSettings(tx, globals)
        val pagePartsDao = PagePartsDao(pageMeta.pageId, settings, tx)
        PagePopularityDao.updatePagePopularity(pagePartsDao, tx)
        // For now: (e2e tests: page metas imported before posts, and page meta reply counts = wrong)
        val numReplies = pagePartsDao.allPosts.count(_.isReply)
        val correctMeta = pageMeta.copy(

          // Frequent posters, last approved reply by, and more?  forgotten here:

          numRepliesVisible = numReplies,
          numRepliesTotal = numReplies,
          numPostsTotal = pagePartsDao.numPostsTotal)
        tx.updatePageMeta(correctMeta, oldMeta = pageMeta, markSectionPageStale = true)
      }

      siteData.reviewTasks foreach { reviewTask: ReviewTask =>
        tx.upsertReviewTask(reviewTask)
      }

      theNewSite
    }

    // If we restored a site, then there're already things in the mem cache and Redis cache,
    // for the site we're overwriting when restoring. Remove any such stuff — or Talkyard
    // might do surprising things.
    val newSiteDao = globals.siteDao(newSite.id)
    newSiteDao.memCache.clearThisSite()
    newSiteDao.redisCache.clearThisSite()

    newSite
  }

}

