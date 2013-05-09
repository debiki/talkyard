# Copyright (c) 2012 Kaj Magnus Lindberg. All rights reserved


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
