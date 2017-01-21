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

// Tells if a user may do something, and why s/he may do that, or why not.
interface MayMayNot {
  value: boolean;
  do_: boolean;   // true = may do it, use like so: if (may.do_) ...
  not: boolean;   // true = may not, use like so:   if (may.not) ...
  yes: boolean;   // true = may do it  -- try to remove?
  no: boolean;    // true = may not    -- try to remove?
  reason?: string;
}

export function mayMayNot(may: boolean, reason: string): MayMayNot {
  return { value: may, do_: may, not: !may, yes: may, no: !may, reason: reason };
}

export function mayIndeed() {
  return mayMayNot(true, null);
}


export function hasChatSection(pageRole: PageRole) {
  // On message pages, replies are flat already, so an additional flat section makes no sense.
  // Chat channels don't have any chat comments section (the whole page is nothing but chat msgs).
  return pageRole !== PageRole.FormalMessage && !page_isChatChannel(pageRole);
}


export function page_isChatChannel(pageRole: PageRole): boolean {
  return pageRole === PageRole.OpenChat || pageRole === PageRole.PrivateChat;
}

// Hmm now there's a Discussion topic type (= page role), then page_isDiscussion is an a
// bit confusing name?
export function page_isDiscussion(pageRole: PageRole): boolean {
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

export function isSection(pageRole: PageRole): boolean {
  return pageRole === PageRole.Forum || pageRole === PageRole.Blog;
}

export function isPageWithSidebar(pageRole: PageRole): boolean {
  return true; // hmm remove this fn then, now
}

export function pageRole_shallListInRecentTopics(pageRole: PageRole): boolean {
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


export function userGetWatchbarTopicIds(user: Myself): PageId[] {
  var watchbarTopics: WatchbarTopics = user.watchbarTopics;
  if (!watchbarTopics) return [];
  // For now: Concat with something so as to not return the original array.
  return watchbarTopics.recentTopics.map(t => t.pageId).concat([]);
}


export function maySendInvites(user: Myself | MemberInclDetails): MayMayNot {
  // Currently only admins may send invites.
  if (!user.isAdmin) return mayMayNot(false, "is not admin");
  return mayIndeed();
}


export function user_isMember(user: MemberInclDetails | BriefUser | Myself): boolean {
  return user.id > MaxGuestId;
}

export function isGuest(user) {  // try to remove
  return user_isGuest(user);
}

export function user_isGuest(user: MemberInclDetails | Myself | BriefUser) {
  return user.id <= MaxGuestId;
}

export function userId_isGuest(userId: UserId) {
  return userId <= MaxGuestId;
}

export function isMember(user: Myself | MemberInclDetails): boolean {
  if (!user) return false;
  var member = user.id >= MinMemberId;
  //dieIf(isGuest(user) && member, 'EsE7YKU2');
  return member;
}

export function isStaff(user: Myself | MemberInclDetails) {
  return user.isAdmin || user.isModerator;
}


export function isTalkToMeNotification(notf: Notification): boolean {
  return notf.type === NotificationType.DirectReply ||
          notf.type === NotificationType.Mention ||
          notf.type === NotificationType.Message;
}

export function isTalkToOthersNotification(notf: Notification): boolean {
  return notf.type === NotificationType.NewPost;
}



export function isCollapsed(post) {
  return post.isTreeCollapsed || post.isPostCollapsed;
}


export function isDeleted(post) {
  return !post || post.isTreeDeleted || post.isPostDeleted;
}


export function isWikiPost(postOrPostType: any) {
  var type;
  if (postOrPostType) {
    type = postOrPostType.postType || postOrPostType;
  }
  return type === PostType.StaffWiki || type === PostType.CommunityWiki;
}


export function trustLevel_toString(trustLevel: TrustLevel): string {
  switch (trustLevel) {
    case TrustLevel.New: return "New";
    case TrustLevel.Basic: return "Basic";
    case TrustLevel.Member: return "Regular";
    case TrustLevel.Regular: return "Long time";
    case TrustLevel.CoreMember: return "Core";
    default: debiki2.die('EsE5PYK25')
  }
}


export function threatLevel_toString(threatLevel: ThreatLevel): string {
  switch (threatLevel) {
    case ThreatLevel.HopefullySafe: return "Allow";
    case ThreatLevel.MildThreat: return "Review after";
    case ThreatLevel.ModerateThreat: return "Review before";
    case ThreatLevel.SevereThreat: return "Block completely";
    default: debiki2.die('EsE5PYK25')
  }
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
