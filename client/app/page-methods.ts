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


export function pageRole_toIconString(pageRole: PageRole) {
  switch (pageRole) {
    case PageRole.CustomHtmlPage: return "Custom HTML page";
    case PageRole.WebPage: return "Info page";
    case PageRole.Code: return "Code";
    case PageRole.SpecialContent: return "Special content";
    case PageRole.EmbeddedComments: return "Embedded comments";
    case PageRole.Blog: return "Blog";
    case PageRole.Forum: return "Forum";
    case PageRole.About: return "About";
    case PageRole.Question: return PageRole_Question_IconString;
    case PageRole.Problem: return PageRole_Problem_IconString;
    case PageRole.Idea: return PageRole_Idea_IconString;
    case PageRole.ToDo: return PageRole_Todo_IconString;
    case PageRole.MindMap: return PageRole_MindMap_IconString;
    case PageRole.Discussion: return PageRole_Discussion_IconString;
    case PageRole.OpenChat: return PageRole_OpenChat_IconString;
    case PageRole.PrivateChat: return PageRole_PrivateChat_IconString;
    case PageRole.FormalMessage: return "Message";
    case PageRole.Form: return PageRole_Form_IconString;
    case PageRole.Critique: return "Critique";  // [plugin]
    default: die('EsE4GUK75Z');
  }
}

export var PageRole_Discussion_IconString =
  r.span({ className: 'icon-comment-empty' }, "Discussion");
export var PageRole_Question_IconString = r.span({ className: 'icon-help-circled' }, "Question");
export var PageRole_Problem_IconString = r.span({ className: 'icon-attention-circled' }, "Problem");
export var PageRole_Idea_IconString = r.span({ className: 'icon-idea' }, "Idea");
export var PageRole_MindMap_IconString = r.span({ className: 'icon-sitemap' }, "Mind Map");

export var PageRole_Todo_IconString = r.span({ className: 'icon-check-empty' }, "Todo");
export var PageRole_OpenChat_IconString = r.span({ className: 'icon-chat' }, "Chat");
export var PageRole_PrivateChat_IconString = r.span({ className: 'icon-lock' }, "Private Chat");

export var PageRole_Form_IconString = r.span({ className: 'icon-th-list' }, "Form");


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
