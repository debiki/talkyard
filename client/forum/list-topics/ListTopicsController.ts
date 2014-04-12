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

/// <reference path="../typedefs/angularjs/angular.d.ts" />
/// <reference path="../ForumApp.ts" />

//------------------------------------------------------------------------------
   module forum {
//------------------------------------------------------------------------------


class Topic {
  id: string;
  title: string;
  url: string;
  categoryId: string;
  subCategoryId: string;
  numPosts: number;
  numLikes: number;
  numWrongs: number;
  firstPostAt: Date;
  lastPostAt: Date;
}


interface ListTopicsScope extends ng.IScope {
  mv: ListTopicsController;
  $state: any;
  topics: Topic[];
}


class ListTopicsController {

  constructor(private $scope: ListTopicsScope, $stateParams) {
    $scope.mv = this;

    var categories = $stateParams.categoryPath ? $stateParams.categoryPath.split('/') : [];
    console.log('ListTopicsController, categories: ' + categories);

    // ... load topics ... .done(function() {
    $scope.topics = [
      (() => {
        var t = new Topic();
        t.id = '123abc';
        t.title = 'Topic Title';
        t.url = '/nowhere';
        t.categoryId = '123abcCategoryId';
        t.subCategoryId = '123abcSubCategoryId';
        t.numPosts = 10;
        t.numLikes = 3;
        t.numWrongs = 1;
        t.firstPostAt = new Date(2014, 4, 3);
        t.lastPostAt = new Date(2014, 4, 7);
        return t;
      })()];
  }

}


forum.forumApp.controller('ListTopicsController', ['$scope', '$stateParams', ListTopicsController]);


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
