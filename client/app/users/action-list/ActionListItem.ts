/**
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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

/// <reference path="../../../typedefs/jquery/jquery.d.ts" />
/// <reference path="../../plain-old-javascript.d.ts" />


//------------------------------------------------------------------------------
   module debiki2.users {
//------------------------------------------------------------------------------

var $: JQueryStatic = debiki.internal.$;


/**
 * Represents something the `actingUserId` did to the `targetUserId`, for example
 * liked his/her comment or replied to it.
 */
export class ActionListItem {

  pageUrl: string;
  pageTitle: string;
  postId: number;
  actionId: number;

  actingUserId: string;
  actingUserDisplayName: string;

  targetUserId: string;
  targetUserDisplayName: string;

  createdAt: Date;
  excerpt: string;

  // This indicates what kind of action this represents.
  repliedToPostId: number;
  editedPostId: number;
  approved: boolean;
  deleted: boolean;
  pinned: boolean;
  collapsed: boolean;
  closed: boolean;
  votedLike: number;
  votedWrong: number;
  votedOffTopic: number;


  constructor() {
  }

  get postUrl(): string {
    return this.pageUrl + '#post-' + this.postId;
  }

  public static fromJson(json): ActionListItem {
    var a = new ActionListItem();
    $.extend(a, json);
    a.createdAt = new Date(json.createdAtEpoch);
    return a;
  }

}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: et ts=2 sw=2 tw=0 fo=tcqwn list
