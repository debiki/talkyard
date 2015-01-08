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


export class UserInfo {

  id: string;
  displayName: string;
  username: string;
  numPages: number;
  numPosts: number;
  numReplies: number;
  numLikesGiven: number;
  numLikesReceived: number;
  numWrongsGiven: number;
  numWrongsReceived: number;
  numOffTopicsGiven: number;
  numOffTopicsReceived: number;

  constructor() {
  }


  public static fromJson(json): UserInfo {
    var i = new UserInfo();
    i.id = json.userId;
    i.displayName = json.displayName;
    i.username = json.username;
    i.numPages = json.numPages;
    i.numPosts = json.numPosts;
    i.numReplies = json.numReplies;
    i.numLikesGiven = json.numLikesGiven;
    i.numLikesReceived = json.numLikesReceived;
    i.numWrongsGiven = json.numWrongsGiven;
    i.numWrongsReceived = json.numWrongsReceived;
    i.numOffTopicsGiven = json.numOffTopicsGiven;
    i.numOffTopicsReceived = json.numOffTopicsReceived;
    return i;
  }

}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: et ts=2 sw=2 tw=0 fo=tcqwn list
