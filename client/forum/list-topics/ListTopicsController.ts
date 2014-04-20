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

/// <reference path="../typedefs/lodash/lodash.d.ts" />
/// <reference path="../typedefs/angularjs/angular.d.ts" />
/// <reference path="../ForumApp.ts" />
/// <reference path="../model/Topic.ts" />
/// <reference path="../QueryService.ts" />
/// <reference path="../categories/CategoryScope.ts" />

//------------------------------------------------------------------------------
   module forum {
//------------------------------------------------------------------------------


interface ListTopicsScope extends CategoryScope {
  topics: Topic[];
}


class ListTopicsController {

  public static $inject = ['$scope', 'QueryService'];
  constructor(private $scope: ListTopicsScope, private queryService: QueryService) {
    console.log('New ListTopicsController.');
    $scope.mv = this;
    this.loadTopics();
  }


  private loadTopics() {
    var categoryId = undefined;
    var anyCategory: Category = _.last(this.$scope.selectedCategories);
    if (anyCategory) {
      categoryId = anyCategory.pageId;
    }

    var sortOrder = TopicSortOrder.ByBumpTime;
    if (this.$scope.$state.is('top')) {
      sortOrder = TopicSortOrder.ByNumLikes;
    }

    this.queryService.loadTopics(categoryId, sortOrder).then((topics: Topic[]) => {
      this.$scope.topics = topics;
    });
  }
}


forum.forumApp.controller('ListTopicsController', ListTopicsController);

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
