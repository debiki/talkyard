/*
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

/// <reference path="users/user-info/UserInfo.ts" />
/// <reference path="../typedefs/jquery/jquery.d.ts" />

//------------------------------------------------------------------------------
   module debiki2.Server {
//------------------------------------------------------------------------------

var d: any = { i: debiki.internal, u: debiki.v0.util };
var $: JQueryStatic = d.i.$;


export function savePageNoftLevel(newNotfLevel) {
  d.u.postJson({
    url: '/-/save-page-notf-level',
    data: {
      pageId: d.i.pageId,
      pageNotfLevel: newNotfLevel
    }
  });
}


export function loadUserInfo(userId, callback: (info: debiki2.users.UserInfo) => void) {
  $.get('/-/load-user-info?userId=' + userId)
    .done((response: any) => {
      var userInfo = debiki2.users.UserInfo.fromJson(response.userInfo);
      callback(userInfo);
    })
    .fail((x, y, z) => {
      console.error('Error loading user info: ' + JSON.stringify([x, y, z]));
      callback(null);
    });
}


export function loadUserActions(userId,
      callback: (actions: debiki2.users.ActionListItem[]) => void) {
  $.get('/-/list-user-actions?userId=' + userId)
    .done((response: any) => {
      var actionItems: debiki2.users.ActionListItem[] = [];
      for (var i = 0; i < response.actions.length; ++i) {
        var json = response.actions[i];
        var c = debiki2.users.ActionListItem.fromJson(json);
        actionItems.push(c);
      }
      callback(actionItems);
    })
    .fail((x, y, z) => {
      console.error('Error loading user actions: ' + JSON.stringify([x, y, z]));
      callback(null);
    });
}


export function loadUserPreferences(userId,
      callback: (info: debiki2.users.UserPreferences) => void) {
  $.get('/-/load-user-preferences?userId=' + userId)
    .done((response: any) => {
      var userPrefs = debiki2.users.UserPreferences.fromJson(response.userPreferences);
      callback(userPrefs);
    })
    .fail((x, y, z) => {
      console.error('Error loading user preferences: ' + JSON.stringify([x, y, z]));
      callback(null);
    });
}


export function saveUserPreferences(prefs, doneCallback: () => void) {
  d.u.postJson({
    url: '/-/save-user-preferences',
    data: prefs,
    success: doneCallback
  });
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
