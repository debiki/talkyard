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

/// <reference path="../../../typedefs/lodash/lodash.d.ts" />
/// <reference path="../../../typedefs/angularjs/angular.d.ts" />
/// <reference path="../UsersModule.ts" />
/// <reference path="../UsersQueryService.ts" />

//------------------------------------------------------------------------------
   module debiki2.users {
//------------------------------------------------------------------------------


interface ActionListScope extends UsersScope {
  actionListItems: ActionListItem[];
}


class ActionListController {


  public static $inject = ['$scope', 'UsersQueryService'];
  constructor(private $scope: ActionListScope, private queryService: UsersQueryService) {
    console.log('New ListTopicsController.');
    $scope.mv = this;
    $scope.actionListItems = [];
    this.loadMoreActions();
  }


  private loadMoreActions() {
    this.queryService.loadActions(this.$scope.$stateParams.userId).then(
        (newActions: ActionListItem[]) => {
      // TODO Don't add the same actions many times.
      for (var i = 0; i < newActions.length; ++i) {
        var newAction = newActions[i];
        this.$scope.actionListItems.push(newAction);
      }
    });
  }

}


usersModule.controller('ActionListController', ActionListController);

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
