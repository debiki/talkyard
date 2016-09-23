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

/// <reference path="../../typedefs/jquery/jquery.d.ts" />
/// <reference path="../plain-old-javascript.d.ts" />


//------------------------------------------------------------------------------
   module debiki2.users {
//------------------------------------------------------------------------------

var $: JQueryStatic = debiki.internal.$;



export class UserPreferences {

  fullName: string;
  username: string;
  emailAddress: string;
  emailForEveryNewPost: boolean;
  url: string;


  constructor() {
  }


  public static fromJson(json): UserPreferences {
    var prefs = new UserPreferences();
    $.extend(prefs, json);
    return prefs;
  }

}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: et ts=2 sw=2 tw=0 fo=tcqwn list
