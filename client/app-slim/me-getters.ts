/*
 * Copyright (c) 2016 Kaj Magnus Lindberg
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

/// <reference path="prelude.ts" />
/// <reference path="utils/utils.ts" />


/* This Flux store is perhaps a bit weird, not sure. I'll switch to Redux or
 * Flummox or Fluxxor or whatever later, and rewrite everything in a better way?
 * Also perhaps there should be more than one store, so events won't be broadcasted
 * to everyone all the time.
 */

//------------------------------------------------------------------------------
   module debiki2 {
//------------------------------------------------------------------------------


/// I can haz session id?
///
export function me_hasSid(): Bo {
  return !!(
        getSetCookie('dwCoSid') ||        // old
        getSetCookie('TyCoSid123') ||     // new, better  [btr_sid]
        getMainWin().typs.weakSessionId); // if cookies don't work
}


export function me_isAuthenticated(me: Myself): boolean {
  return me.id && me.id >= MinMemberId;
}


export function me_toBriefUser(me: Myself): BriefUser {
  return {
    id: me.id,
    fullName: me.fullName,
    username: me.username,
    isAdmin: me.isAdmin,
    isModerator: me.isModerator,
    isGuest: me.id && me.id <= MaxGuestId,
    isEmailUnknown: undefined, // ?
    avatarSmallHashPath: me.avatarSmallHashPath,
    pubTags: me.pubTags,
  }
}

export function me_hasVoted(me: Myself, postId: PostId, what: string): boolean {
  const votes = me.myCurrentPageData.votes[postId] || [];
  return votes.indexOf(what) !== -1;
}


export function store_maySendDirectMessageTo(store: Store, user: UserInclDetails): boolean {
  const settings: SettingsVisibleClientSide = store.settings;
  const me: Myself = store.me;

  if (settings.enableDirectMessages === false)
    return false;

  if (user_isGone(user))   // compilation error?
    return false;

  if (!user_isMember(me) || !user_isMember(user))
    return false;

  if (me.id === SystemUserId || user.id === SystemUserId)
    return false;

  if (me.id === user.id)
    return false;

  if (user.isGroup) // group messages not yet impl
    return false;

  if (isStaff(me) || isStaff(user))
    return true;

  return me.trustLevel >= TrustLevel.Basic && me.threatLevel <= ThreatLevel.HopefullySafe;
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
