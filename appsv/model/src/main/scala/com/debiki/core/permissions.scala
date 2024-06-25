/**
 * Copyright (C) 2017 Kaj Magnus Lindberg
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

package com.debiki.core

import com.debiki.core.Prelude._



case class EffPatPerms(
  maxUploadSizeBytes: i32,
  allowedUploadExtensions: Set[St],
  canSeeOthersEmailAdrs: Bo)



/** Permissions across the whole site granted to a group.
  *
  * Can move more perms to here  [more_pat_perms].
  */
case class PatPerms (
  maxUploadBytes: Opt[i32],
  allowedUplExts: Opt[St],
  canSeeOthersEmailAdrs: Opt[Bo],
)(mab: MessAborter) {

  // Maybe cache?
  def allowedUplExtensionsAsSet: Set[St] =
    allowedUplExts.map(_.split(" ").flatMap(_.trimNoneIfEmpty).toSet[St])
          .getOrElse(Set.empty)

  // [may_not_perms]
  mab.abortIf(canSeeOthersEmailAdrs is false, o"""Negative permissions not implemented,
        canSeeOthersEmailAdrs = Some(false) not yet supported [TyENEGPERMS052]""")
}


object PatPerms {  REFACTOR // add MessAborter  to "all" case classes  instead? [mess_aborter]
  def empty: PatPerms = create(mab = IfBadDie)

  def create(mab: MessAborter,
        maxUploadBytes: Opt[i32] = None,
        allowedUplExts: Opt[St] = None,
        canSeeOthersEmailAdrs: Opt[Bo] = None): PatPerms = {

    allowedUplExts foreach { exts =>
      val max = 1500
      mab.abortIf(exts.length > max, "TyE3056RMD27", s"Too long extensions list, ${
            exts.length} chars, max: $max")
      Validation.ifBadFileExtCommaList(exts, NoSiteId, _ => mab.abort(
            "TyE306MS4A", s"Bad file exts list: $exts"))
    }

    maxUploadBytes foreach { maxBytes =>   // [server_limits]
      mab.abortIf(maxBytes < 0, "TyE3056RMD24", s"Max bytes negative: $maxBytes")
    }

    PatPerms(maxUploadBytes = maxUploadBytes,
          allowedUplExts = allowedUplExts.noneIfBlank,
          canSeeOthersEmailAdrs = canSeeOthersEmailAdrs,
          )(mab)
  }
}


case class PatsDirectPerms(
  permsOnSite: collection.immutable.Seq[PermsOnSite],
  permsOnPages: collection.immutable.Seq[PermsOnPages])


case class PermsOnSite(
  forPeopleId: UserId,
  maxUploadSizeBytes: i32)


object PermsOnPages {

  /** If any permission says No, then, no, not allowed. Otherwise, if any
    * permission says Yes, then, yes, allowed.
    */
  def merge(a: Opt[Bo], b: Opt[Bo]): Opt[Bo] = {
    // This:
    if (b.is(false)) b
    else a orElse b
    // ... is the same as:
    // if (a.is(false) || b.is(false)) Some(false)
    // else if (a.is(true) || b.is(true)) Some(true)
    // else None
  }
}


/** If maySeeOwn is true, then one may see one's own stuff, even if maySee is false.
  */
case class PermsOnPages(  // [exp] ok use. Missing, fine: may_see_private_flagged
  id: PermissionId,
  forPeopleId: PatId,
  onWholeSite: Opt[Bo] = None,
  onCategoryId: Opt[CatId] = None,
  onPageId: Opt[PageId] = None,
  onPostId: Opt[PostId] = None,
  onTagId: Opt[TagLabelId] = None,
  mayEditPage: Opt[Bo] = None,
  mayEditComment: Opt[Bo] = None,
  mayEditWiki: Opt[Bo] = None,
  mayEditOwn: Opt[Bo] = None,
  mayDeletePage: Opt[Bo] = None,
  mayDeleteComment: Opt[Bo] = None,
  mayCreatePage: Opt[Bo] = None,
  mayPostComment: Opt[Bo] = None,
  maySee: Opt[Bo] = None,
  // Wants index: pages_i_authorid_catid_createdat_pageid
  maySeeOwn: Opt[Bo] = None) {

  // maySeeIfEmbeddedAlthoughLoginRequired  [emb_login_req]
  //  — for embedded comments categories, when site Login Required to Read enabled.

  // Can be nice for staff — and which other people? — to see unlisted categories
  // and topics:
  // maySeeUnlistedTopics  ?   [maySeeUnlisted]

  // Later, perhaps:
  // pin/unpin
  // close and/or archive
  // unlist topic
  // recategorize and rename topics
  // split and merge topics
  // nofollow removed
  // upload images / other attachments

  require(forPeopleId >= LowestTalkToMemberId, "EdE8G4HU2W")
  require(!onCategoryId.contains(NoCategoryId), "EdE8UGF0W2")
  require(!onPageId.exists(_.isEmpty), "EdE8UGF0W3")
  require(!onPostId.contains(NoPostId), "EdE8UGF0W4")
  require(!onTagId.contains(NoTagId), "EdE8UGF0W5")
  require(!(maySee.is(true) && maySeeOwn.is(false)), "EdE6LKWU02")
  require(!((mayEditComment.is(true) || mayEditPage.is(true) || mayEditWiki.is(true)) &&
    mayEditOwn.is(false)), "EdE2WJB0Y4")

  CLEAN_UP // change to a Bool not Opt[Bool]? then this requirement can be removed.
  require(onWholeSite isNot false, "EdE5GVR0Y1")

  // This permission grants rights on exactly one thing.
  require(1 == onWholeSite.oneIfDefined + onCategoryId.oneIfDefined + onPageId.oneIfDefined +
    onPostId.oneIfDefined + onTagId.oneIfDefined, "EdE7LFK2R5")

  /** Tells if this permission neither grants nor revokes any rights — if it doesn't, it might
    * as well be deleted.
    */
  def hasNoEffect: Bo =
    mayEditPage.isEmpty && mayEditComment.isEmpty && mayEditWiki.isEmpty && mayEditOwn.isEmpty &&
    mayDeletePage.isEmpty && mayDeleteComment.isEmpty && mayCreatePage.isEmpty &&
    mayPostComment.isEmpty && maySee.isEmpty && maySeeOwn.isEmpty

  def hasSomeEffect: Bo = !hasNoEffect
}


// Later:

// case class PermsOnPeople(...) or PermsOnGroups(...)
// e.g. permissions to:
// - suspend someone (site wide perm, not per group),
// - @mention a group, e.g. let only trust-level >= Basic mention a group.
//     + mention owners only?  @group_name.owners or owners@group_name ? = may add/remove members
// - how many people to notify when group mentioned. If there's a support group with 100 people,
//     perhaps just notify 5 random people? or round-robin
// - or configure sub-mention groups, e.g. owners@group_name —> @amanda @bert @cicero
//       or  1st_line@support  or 2nd_line@support or 3rd_line@support
// - see that the group exists (e.g. perhaps only admins should see a @@penetration_testers group?)
// - configure group settings:
//   - edit full-name (but perhaps not the group's username)
//   - edit about-group
//   - edit group avatar
//   - add/remove group members (one needn't be a group member in order to manage it),
//   - allow/disable self-join and self-exit
//   - allow/disable apply-for-membership button  and approve/deny such request
//   - configure group-is-visible-to all users: y/n
// (inspired by https://meta.discourse.org/t/improving-the-groups-page-for-1-7/53347 )

// case class PermsOnTags(...)
// — could let only a certain group of people use some tags

// Probably never:
// case class PermsOnCategories(...)  // edit category description? rename slug?
// — they can just send a message to an admin and ask hen to do it instead.
