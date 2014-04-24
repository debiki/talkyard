/* AngularJS controller for the admin dashboard Users tab.
 * Copyright (C) 2012 Kaj Magnus Lindberg (born 1979)
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


import prelude
d = i: debiki.internal, u: debiki.v0.util
bug = d.u.die2



class User

  (userData) ~>
    @ <<< userData



@UserListCtrl = ['$scope', 'AdminService', !($scope, adminService) ->

  d.i.mixinInfoListCommon $scope, 'userList'

  $scope.userList = []

  callbacks =
      onSuccess: !(json) ->
        $scope.userList =
          for userData in json.users
            User(userData)
      onError: !->
        console.log('Error listing users [DwE3BKI02]')

  adminService.listUsers null, callbacks

  ]


# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
