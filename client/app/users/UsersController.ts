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
/// <reference path="../typedefs/angularjs/angular.d.ts" />
/// <reference path="../typedefs/lodash/lodash.d.ts" />

//------------------------------------------------------------------------------
   module debiki2.users {
//------------------------------------------------------------------------------


class UsersController {

  public static $inject = ['$scope', 'UsersQueryService'];
  constructor(private $scope: UsersScope, private queryService: UsersQueryService) {
    $scope.mv = this;

    queryService.loadUserInfo($scope.$stateParams.userId).then((userInfo: UserInfo) => {
      this.$scope.userInfo = userInfo;
    });
  }

}


usersModule.controller("UsersController", UsersController);

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
