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
/// <reference path="AdminApp.ts" />

//------------------------------------------------------------------------------
   module debiki2.admin {
//------------------------------------------------------------------------------

/**
 * Sets up routing using ui-router.
 */
adminApp.config(['$stateProvider', '$urlRouterProvider',
    function($stateProvider, $urlRouterProvider) {

  $urlRouterProvider.otherwise('/');

  $stateProvider
    .state('dashboard', {
      url: '/',
      templateUrl: 'dashboard/dashboard-view.html',
      controller: 'DashboardController',
    })
    .state('settings', {
      url: '/settings',
      templateUrl: 'settings/settings-view.html',
      controller: 'SettingsController'
    })
    .state('specialContents', {
      url: '/special-contents',
      templateUrl: 'special-content/special-content-view.html',
      controller: 'SpecialContentController'
    /*})
    .state('latest', {
      url: '/latest/*categoryPath',
      templateUrl: 'forum/list-topics/list-topics.html',
      controller: 'ListTopicsController',
      onEnter: ['$stateParams', 'CategoryService',
          function($stateParams, categoryService: CategoryService) {
        categoryService.updateCurrentCategories($stateParams);
      }]
    })
    .state('top', {
      url: '/top/*categoryPath',
      templateUrl: 'forum/list-topics/list-topics.html',
      controller: 'ListTopicsController',
      onEnter: ['$stateParams', 'CategoryService',
          function($stateParams, categoryService: CategoryService) {
        categoryService.updateCurrentCategories($stateParams);
      }]
    })
    .state('categories', {
      url: '/categories',
      templateUrl: 'forum/list-categories/list-categories.html',
      controller: 'ListCategoriesController',
      onEnter: ['CategoryService', function(categoryService: CategoryService) {
        categoryService.clearCurrentCategories();
      }] */
    });
}]);


/**
 * Adds UI-Router's $state and $stateParams to the root scope, so they're
 * accessible from everywhere.
 */
adminApp.run(['$rootScope', '$state', '$stateParams',
    function($rootScope, $state, $stateParams) {
  $rootScope.$state = $state;
  $rootScope.$stateParams = $stateParams;
}]);


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
