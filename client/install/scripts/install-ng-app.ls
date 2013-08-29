/* AngularJS application for the /-/install/ page.
 * Copyright (C) 2013 Kaj Magnus Lindberg (born 1979)
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


InstallationModule = angular.module('InstallationModule', [])


@InstallationCtrl = ['$scope', '$http', !($scope, $http) ->

  $scope.badPassword = false
  $scope.firstSitePassword = ''

  $scope.tryCreateFirstSite = !->
    $http.post(
        '/-/install/create-first-site',
        'password': $scope.firstSitePassword)
      .success !->
        # Fine, reload page to view next step. (These things cannot
        # be undone, so there's no point in using another URL.)
        location.reload()  # oops, side effect in controller, well okay
      .error !->
        $scope.badPassword = true

  ]


# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
