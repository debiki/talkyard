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

//------------------------------------------------------------------------------
   module debiki2.users {
//------------------------------------------------------------------------------


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

  // This indicates what kind of actions this represents.
  anyReplyToPostId: number;
  anyLike: number;
  anyWrong: number;
  anyOffTopic: number;


  constructor() {
  }

  get postUrl(): string {
    return this.pageUrl + '#post-' + this.postId;
  }

  public static fromJson(json): ActionListItem {
    var a = new ActionListItem();
    a.pageUrl = json.pageUrl;
    a.pageTitle = json.pageTitle;
    a.postId = json.postId;
    a.actionId = json.actionId;
    a.actingUserId = json.actingUserId;
    a.actingUserDisplayName = json.actingUserDisplayName;
    a.targetUserId = json.targetUserId;
    a.targetUserDisplayName = json.targetUserDisplayName;
    a.createdAt = json.createdAt;
    a.excerpt = json.excerpt;
    a.anyReplyToPostId = json.anyReplyToPostId;
    a.anyLike = json.anyLike;
    a.anyWrong = json.anyWrong;
    a.anyOffTopic = json.anyOffTopic; 
    return a;
  }

}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: et ts=2 sw=2 tw=0 fo=tcqwn list
