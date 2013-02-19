# Copyright (c) 2012 Kaj Magnus Lindberg. All rights reserved

import prelude
d = i: debiki.internal, u: debiki.v0.util
bug = d.u.die2



class User

  (userData) ~>
    @ <<< userData



@UserListCtrl = ['$scope', 'AdminService', !($scope, adminService) ->

  d.i.mixinInfoListCommon $scope, 'userList'

  $scope.userList = []

  adminService.listUsers null, callbacks
    where callbacks =
      onSuccess: !(json) ->
        $scope.userList =
          for userData in json.users
            User(userData)
      onError: !->
        alert 'DwE3BKI02' # should come up with something better...

  ]


# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
