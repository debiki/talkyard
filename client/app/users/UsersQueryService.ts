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

/// <reference path="UsersModule.ts" />
/// <reference path="action-list/ActionListItem.ts" />
/// <reference path="user-info/UserInfo.ts" />

//------------------------------------------------------------------------------
   module debiki2.users {
//------------------------------------------------------------------------------



export class UsersQueryService {


  public static $inject = ['$http', '$q'];
  constructor(private $http: ng.IHttpService, private $q: ng.IQService) {
  }


  public loadUserInfo(userId: string): ng.IPromise<UserInfo> {
    var deferred = this.$q.defer<UserInfo>();
    this.$http.get('/-/load-user-info?userId=' + userId).success((response: any) => {
      var userInfo = UserInfo.fromJson(response.userInfo);
      deferred.resolve(userInfo);
    });
    return deferred.promise;
  }


  public loadActions(userId: string): ng.IPromise<ActionListItem[]> {
    var deferred = this.$q.defer<ActionListItem[]>();
    this.$http.get('/-/list-user-actions?userId=' + userId).success((response: any) => {
      var actionItems: ActionListItem[] = [];
      for (var i = 0; i < response.actions.length; ++i) {
        var json = response.actions[i];
        var c = ActionListItem.fromJson(json);
        actionItems.push(c);
      }
      deferred.resolve(actionItems);
    });
    return deferred.promise;
  }

}


usersModule.service('UsersQueryService', UsersQueryService);

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: et ts=2 sw=2 tw=0 fo=tcqwn list
