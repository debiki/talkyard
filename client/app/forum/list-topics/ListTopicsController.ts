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

/// <reference path="../../typedefs/lodash/lodash.d.ts" />
/// <reference path="../../typedefs/angularjs/angular.d.ts" />
/// <reference path="../ForumModule.ts" />
/// <reference path="../model/Topic.ts" />
/// <reference path="../QueryService.ts" />
/// <reference path="../categories/CategoryScope.ts" />

//------------------------------------------------------------------------------
   module debiki2.forum {
//------------------------------------------------------------------------------


interface ListTopicsScope extends CategoryScope {
  topics: Topic[];
  showLoadMoreButton: boolean;
}


class ListTopicsController {

  /** Keep in sync with app/controllers/ForumController.NumTopicsToList. */
  static NumNewTopicsPerRequest = 40;

  public static $inject = ['$scope', 'QueryService'];
  constructor(private $scope: ListTopicsScope, private queryService: QueryService) {
    console.log('New ListTopicsController.');
    $scope.mv = this;
    $scope.topics = [];
    $scope.showLoadMoreButton = true;
    this.loadMoreTopics();
  }


  loadMoreTopics() {
    var categoryId = undefined;
    var anyCategory: Category = _.last(this.$scope.selectedCategories);
    if (anyCategory) {
      categoryId = anyCategory.pageId;
    }

    var orderOffset: OrderOffset;
    var anyLastTopic: Topic = _.last(this.$scope.topics);
    var anyEpoch = anyLastTopic ? anyLastTopic.lastPostEpoch : null;
    var anyNum = null;

    if (this.$scope.$state.is('index') || this.$scope.$state.is('latest')) {
      orderOffset = new OrderOffsets.ByBumpTime(anyEpoch);;
    }
    else if (this.$scope.$state.is('top')) {
      if (anyLastTopic) {
        anyNum = anyLastTopic.numLikes;
      }
      orderOffset = new OrderOffsets.ByLikesAndBumpTime(anyNum, anyEpoch);
    }
    else {
      console.error('Bad state [DwE83RE20]');
      return;
    }

    this.queryService.loadTopics(categoryId, orderOffset).then((newTopics: Topic[]) => {
      // `newTopics` includes at least the last topic in `$scope.topics`; don't add it again.
      for (var i = 0; i < newTopics.length; ++i) {
        var newTopic = newTopics[i];
        var oldTopic = _.find(this.$scope.topics, (t: Topic) => {
          return t.id === newTopic.id;
        });
        if (!oldTopic) {
          this.$scope.topics.push(newTopic);
        }
      }
      this.$scope.showLoadMoreButton =
          newTopics.length == ListTopicsController.NumNewTopicsPerRequest;
    });
  }

}


forum.forumModule.controller('ListTopicsController', ListTopicsController);

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
