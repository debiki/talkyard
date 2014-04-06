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

//------------------------------------------------------------------------------
  module forum {
//------------------------------------------------------------------------------


var forumApp = angular.module('ForumApp', ['ui.router', 'DebikiPageModule']);

forumApp.config(['$stateProvider', '$urlRouterProvider', configForumApp]);
forumApp.run(['$rootScope', '$state', '$stateParams', runForumApp]);


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
      url: '/latest/*path',
      template: 'latest template',
      controller: function($stateParams) {
        var categories = $stateParams.path ? $stateParams.path.split('/') : [];
        console.log('latest controller, categories: ' + categories);
      }
    })
    .state('top', {
      url: '/top/*path',
      template: 'top template',
      controller: function($stateParams) {
        var categories = $stateParams.path ? $stateParams.path.split('/') : [];
        console.log('top controller, categories: ' + categories);
      }
    })
    .state('categories', {
      url: '/categories',
      template: 'categories template',
      controller: function($stateParams) {
        console.log('categories controller');
      }
    })
};


/**
 * Adds UI-Router's $state and $stateParams to the root scope, so they're
 * accessible from everywhere.
 */
function runForumApp($rootScope, $state, $stateParams) {
  $rootScope.$state = $state;
  $rootScope.$stateParams = $stateParams;
};


//------------------------------------------------------------------------------
  }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
