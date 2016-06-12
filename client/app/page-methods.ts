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


export function page_isInfoPage(pageRole: PageRole): boolean {
  return pageRole === PageRole.CustomHtmlPage || pageRole === PageRole.WebPage;
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
    case PageRole.MindMap: return "Mind map";
    case PageRole.Discussion: return PageRole_Discussion_IconString;
    case PageRole.OpenChat: return PageRole_Chat_IconString;
    case PageRole.PrivateChat: return "Private chat";
    case PageRole.Message: return "Message";
    case PageRole.Critique: return "Critique";  // [plugin]
    default: die('EsE4GUK75Z');
  }
}

export var PageRole_Discussion_IconString =
  r.span({ className: 'icon-comment-empty' }, "Discussion");
export var PageRole_Question_IconString = r.span({ className: 'icon-help-circled' }, "Question");
export var PageRole_Problem_IconString = r.span({ className: 'icon-attention-circled' }, "Problem");
export var PageRole_Idea_IconString = r.span({ className: 'icon-idea' }, "Idea");

export var PageRole_Todo_IconString = r.span({ className: 'icon-check-empty' }, "Todo");
export var PageRole_Chat_IconString = r.span({ className: 'icon-chat' }, "Chat");


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
