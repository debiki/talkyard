# Copyright (c) 2012 Kaj Magnus Lindberg. All rights reserved


NewPageChooseOwnerModule = angular.module('NewPageChooseOwner', [])


@ChooseOwnerCtrl = ['$scope', ($scope) ->

  $scope.isOpenIdFormVisible = false

  $scope.showOpenIdForm = ->
    $scope.isOpenIdFormVisible = true

  ]


# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
