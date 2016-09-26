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
/// <reference path="../typedefs/lodash/lodash.d.ts" />


/* This Flux store is perhaps a bit weird, not sure. I'll switch to Redux or
 * Flummox or Fluxxor or whatever later, and rewrite everything in a better way?
 * Also perhaps there should be more than one store, so events won't be broadcasted
 * to everyone all the time.
 */

//------------------------------------------------------------------------------
   module debiki2 {
//------------------------------------------------------------------------------

var r = React.DOM;


export function page_isGroupTalk(pageRole: PageRole): boolean {
  return page_isPersonalTalk(pageRole) || page_isChatChannel(pageRole);
}


function page_isPersonalTalk(pageRole: PageRole): boolean {
  return pageRole === PageRole.FormalMessage ||
      false; // later: === PageRole.PersonalChat (but not Open/PrivateChatChannel)
}


export function page_isPrivateGroup(pageRole: PageRole): boolean {
  return pageRole === PageRole.FormalMessage || pageRole === PageRole.PrivateChat;
}


export function page_isInfoPage(pageRole: PageRole): boolean {
  return pageRole === PageRole.CustomHtmlPage || pageRole === PageRole.WebPage;
}


export function page_mayChangeRole(pageRole: PageRole): boolean {
  // Sync with Scala [6KUW204]
  return !isSection(pageRole) && !page_isChatChannel(pageRole) && !page_isPrivateGroup(pageRole) &&
      pageRole !== PageRole.About &&
      pageRole !== PageRole.Code &&
      pageRole !== PageRole.SpecialContent;
}


export function page_canBeClosed(pageRole: PageRole) {
  // Lock private message pages instead so no new replies can be added.
  return !debiki2.page_isPrivateGroup(pageRole);
}



//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
