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


// Tells if a user may do something, and why s/he may do that, or why not.
interface MayMayNot {
  value: boolean;
  do_: boolean;   // true = may do it, use like so: if (may.do_) ...
  not: boolean;   // true = may not, use like so:   if (may.not) ...
  yes: boolean;   // true = may do it  -- try to remove?
  no: boolean;    // true = may not    -- try to remove?
  reason?: string;
}

function mayMayNot(may: boolean, reason: string): MayMayNot {
  return { value: may, do_: may, not: !may, yes: may, no: !may, reason: reason };
}

function mayIndeed() {
  return mayMayNot(true, null);
}


function hasChatSection(pageRole: PageRole) {
  // On message pages, replies are flat already, so an additional flat section makes no sense.
  return pageRole !== PageRole.Message;
}

function canClose(pageRole: PageRole) {
  // Lock messages instead so no new replies can be added.
  return pageRole !== PageRole.Message;
}

function maySendInvites(user: User | CompleteUser): MayMayNot {
  // Currently only admins may send invites.
  if (!user.isAdmin) return mayMayNot(false, "is not admin");
  return mayIndeed();
}


function isGuest(user) {
  // (Should rename userId to id.)
  return user.id <= MaxGuestId ||  // if is a CompleteUser
      user.userId <= MaxGuestId; // in case it's a User or BriefUser
}

function isMember(user: User | CompleteUser): boolean {
  if (!user) return false;
  var id = user['id'] || user['userId'];
  var member = id >= MinMemberId;
  //dieIf(isGuest(user) && member, 'EsE7YKU2');
  return member;
}

function isStaff(user: User) {
  return user.isAdmin || user.isModerator;
}


function isTalkToMeNotification(notf: Notification): boolean {
  return notf.type === NotificationType.DirectReply ||
          notf.type === NotificationType.Mention ||
          notf.type === NotificationType.Message;
}

function isTalkToOthersNotification(notf: Notification): boolean {
  return notf.type === NotificationType.NewPost;
}


// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
