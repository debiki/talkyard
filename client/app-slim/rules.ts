/*
 * Copyright (c) 2015 Kaj Magnus Lindberg
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

// In this file: Small functions that says something about a model class instance.
// Would have been member functions, had it been possible to amend the React
// state tree with functions.

/// <reference path="prelude.ts" />

//------------------------------------------------------------------------------
   namespace debiki2 {
//------------------------------------------------------------------------------

export function mayMayNot(may: boolean, reason: string): MayMayNot {
  return { value: may, do_: may, not: !may, yes: may, no: !may, reason: reason };
}

export function mayIndeed() {
  return mayMayNot(true, null);
}


export function page_isOpenChat(pageRole: PageType): Bo {
  return pageRole === PageRole.JoinlessChat ||
          pageRole === PageRole.OpenChat;
}


export function page_isChat(pageRole: PageType): Bo {
  return page_isOpenChat(pageRole) || pageRole === PageRole.PrivateChat;
}

// Hmm now there's a Discussion topic type (= page role), then page_isDiscussion is an a
// bit confusing name?
export function page_isDiscussion(pageRole: PageRole | Z): BoZ {
  return pageRole && !isSection(pageRole) &&
      pageRole !== PageRole.Form &&
      pageRole !== PageRole.SpecialContent &&
      pageRole !== PageRole.CustomHtmlPage &&
      pageRole !== PageRole.WebPage;
      // pageRole !== PageRole.WikiMainPage;
}

// [refactor] Move to page-methods.ts and rename to page_hmmHmmWhat? + isSection too, below.
export function isPageWithComments(pageRole: PageRole): boolean {
  return page_isDiscussion(pageRole) && pageRole !== PageRole.FormalMessage;
}

export function isSection(page: Page | PageRole): Bo { // RENAME to page_isSection
  const pageRole = _.isObject(page) ? page.pageRole : page;
  return pageRole === PageRole.Forum || pageRole === PageRole.Blog;
}

export function isPageWithSidebar(pageRole: PageRole): boolean {
  return true; // hmm remove this fn then, now
}

export function pageRole_shallInclInWatchbar(pageRole: PageRole): boolean {
  switch (pageRole) {
    case PageRole.EmbeddedComments:
    case PageRole.CustomHtmlPage:
    case PageRole.WebPage:
    case PageRole.Code:
    case PageRole.SpecialContent:
      return false;
    default:
      return !!pageRole;
  }
}


export function me_isStranger(me: Myself): boolean {
  return !me.id;
}


// RENAME to pat_maySendInvites(pat, store: StoreView_Settings): MayMayNot
export function store_maySendInvites(store: Store, user: Myself | UserInclDetails): MayMayNot {
  if (store.settings.ssoUrl) {
    return mayMayNot(false, "SSO enabled");
  }
  // Currently only staff and core members may send invites. [who_may_invite]
  if (!user_isStaffOrCoreMember(user) || user.isGroup) {
    return mayMayNot(false, "is not staff or core member");
  }
  return mayIndeed();
}

export function pat_isMe(pat: UserInclDetails | Me | Pat | PatId): pat is Me {
  // Let's test for any property that would never be set for a user other than
  // `theStore.me` — and would always be set for `theStore.me`.
  return !!(pat as Me).watchbar;
}

export function pat_isMember(pat: UserInclDetails | Me | Pat | PatId): Bo {
  if (!pat) return false;
  const patId: PatId = _.isObject(pat) ? (pat as Pat).id : pat
  return patId >= Pats.MinMemberId; // but sometimes  MinAuthnMemberId  is better, hmm
}
export const user_isMember = pat_isMember;  // CLEAN_UP REMOVE QUICK SMALLER_BUNDLE

export function isGuest(user) {  // try to remove
  return user_isGuest(user);
}

export function pat_isGuest(user: UserInclDetails | Myself | BriefUser) {
  return user.id <= MaxGuestId;
}
export const user_isGuest = pat_isGuest;  // CLEAN_UP REMOVE QUICK SMALLER_BUNDLE  remove isGuest() and isMember() too

export function userId_isGuest(userId: UserId) {
  return userId <= MaxGuestId;
}

// Old name  CLEAN_UP REMOVE
export const isMember = pat_isMember;


export function pat_isStaff(user: Me | Pat): Bo {
  return user.isAdmin || user.isModerator;
}

// Old name  CLEAN_UP REMOVE
export const isStaff: (user: Me | Pat) => Bo = pat_isStaff;

// RENAME to pat_isStaffOrCore
export function user_isStaffOrCoreMember(user: Myself | UserInclDetails): boolean {
  return isStaff(user) || user_trustLevel(user) >= TrustLevel.CoreMember;
}


export function pat_isSys(pat: Pat): Bo {
  // BUGs elsewhere:  look for SysbotUserId too not just SystemUserId.  NEXT QUICK
  return pat.id === SystemUserId || pat.id === SysbotUserId;
}


export function isTalkToMeNotification(notf: Notification): Bo {
  return notf.type === NotificationType.DirectReply ||
          notf.type === NotificationType.Mention ||
          notf.type === NotificationType.Message ||
          notf.type === NotificationType.Assigned ||
          notf.type === NotificationType.Unassigned ||
            // But not: NotificationType.AssigneesChanged — that's about others.
          notf.type === NotificationType.OneLikeVote;  // for now  [like_notf_ico]
}

export function isTalkToOthersNotification(notf: Notification): Bo {
  return notf.type === NotificationType.NewPost ||
          notf.type === NotificationType.IndirectReply ||
          notf.type === NotificationType.AssigneesChanged;
}




export function isDeleted(post) {   // dupl code [2PKQSB5]
  return !post || post.isTreeDeleted || post.isPostDeleted;
}


export function isWikiPost(postOrPostType: any) {
  var type;
  if (postOrPostType) {
    type = postOrPostType.postType || postOrPostType;
  }
  return type === PostType.StaffWiki || type === PostType.CommunityWiki;
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
