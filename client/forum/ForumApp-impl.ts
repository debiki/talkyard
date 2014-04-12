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

/// <reference path="typedefs/angularjs/angular.d.ts" />
/// <reference path="ForumApp.ts" />
/// <reference path="list-topics/ListTopicsController.ts" />
/// <reference path="list-categories/ListCategoriesController.ts" />

//------------------------------------------------------------------------------
   module forum {
//------------------------------------------------------------------------------


forum.forumApp.config(['$stateProvider', '$urlRouterProvider', configForumApp]);
forum.forumApp.run(['$rootScope', '$state', '$stateParams', runForumApp]);


function configForumApp($stateProvider, $urlRouterProvider) {
  $urlRouterProvider.otherwise('/');

  $stateProvider
    .state('index', {
      url: '/',
      template: 'index template',
      controller: function() {
        console.log('index controller');
      }
    })
    .state('latest', {
      url: '/latest/*categoryPath',
      templateUrl: 'list-topics/list-topics.html',
      controller: 'ListTopicsController',
      onEnter: updateCurrentCategories
    })
    .state('top', {
      url: '/top/*categoryPath',
      templateUrl: 'list-topics/list-topics.html',
      controller: 'ListTopicsController',
      onEnter: updateCurrentCategories
    })
    .state('categories', {
      url: '/categories',
      templateUrl: 'list-categories/list-categories.html',
      controller: 'ListCategoriesController'
    })
};


/**
 * Adds UI-Router's $state and $stateParams to the root scope, so they're
 * accessible from everywhere.
 */
function runForumApp($rootScope, $state, $stateParams) {
  $rootScope.$state = $state;
  $rootScope.$stateParams = $stateParams;
  setupCategories($rootScope);
};


/**
 * The server includes info on any blog or forum categories so we won't need
 * to ask for that separately. This function parses that data and adds the
 * category data to the $rootScope.
 */
function setupCategories($rootScope) {
  var pageDataText = $('#dw-page-data').text() || '{}'
  var pageDataJson = JSON.parse(pageDataText)
  $rootScope.categories = pageDataJson.categories || []
}


/**
 * Updates $rootScope.currentMainCategory and $rootScope.currentSubCategory given
 * the categories listed in the URL.
 */
var updateCurrentCategories = ['$rootScope', '$stateParams', function($rootScope, $stateParams) {
  var categoryPath = parseCategoryPath($stateParams.categoryPath);
  console.log('$stateParams: ' + $stateParams);
  console.log('$stateParams.categoryPath: ' + $stateParams.categoryPath);
  console.log('cat path: ' + categoryPath);

  $rootScope.currentMainCategory = null;
  $rootScope.currentSubCategory = null;
  if (categoryPath.length == 0)
    return;

  var categories = $rootScope.categories;
  for (var i = 0; i < categories.length; ++i) {
    var category = categories[i];
    if (category.slug === categoryPath[0]) {
      $rootScope.currentMainCategory = category;
      break;
    }
  }

  // In the future: if $categoryPath.length > 1, then update $rootScope.currentSubCategory.
}];


function parseCategoryPath(categoryPath: string): string[] {
  var path = categoryPath;
  if (!path || path.length == 0)
    return [];

  var paths = path.split('/');
  return paths;
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
