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


export function pageRole_toString(pageRole: PageRole): string {
  switch (pageRole) {
    case PageRole.CustomHtmlPage: return "Custom html page";
    case PageRole.WebPage: return "Web page";
    case PageRole.Code: return "Code";
    case PageRole.SpecialContent: return "Special content";
    case PageRole.EmbeddedComments: return "Embedded comments";
    case PageRole.Blog: return "Blog";
    case PageRole.Forum: return "Forum";
    case PageRole.About: return "About";
    case PageRole.Question: return "Question";
    case PageRole.Problem: return "Problem";
    case PageRole.Idea: return "Idea";
    case PageRole.ToDo: return "To Do";
    case PageRole.MindMap: return "Mind map";
    case PageRole.Discussion: return "Discussion";
    case PageRole.OpenChat: return "Chat channel";
    case PageRole.PrivateChat: return "Private chat";
    case PageRole.Message: return "Message";
    case PageRole.Critique: return "Critique";
    default: die('EsE4GUK75Z');
  }
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
