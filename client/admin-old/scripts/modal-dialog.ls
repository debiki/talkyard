/* A modal dialog AngularJS directive, for error messages only, apparently.
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



/**
 * Shows a modal dialog, use like so:
 *  $scope.showModalDialog({ title, body })
 */
angular.module('AdminModule').directive 'dwModalDialog', ->

  restrict: 'A',

  template: '''
    <div ui-modal class="modal fade"
        id="errorMessageModal"
        ng-model="errorMessageModalShown">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h1>{{ errorMessageModalTitleText }}</h1>
          </div>
          <div class="modal-body"
              style="white-space: pre-wrap; font-family: monospace;"
            >{{ errorMessageModalBodyText }}
          </div>
          <div class="modal-footer">
            <a class="btn" ng-click="errorMessageModalShown=false">
              Okay
            </a>
          </div>
        </div>
      </div>
    </div>
    '''

  controller: ($scope) ->
    $scope.showModalDialog = !({ title, body, type }) ->
      $scope.errorMessageModalShown = true
      $scope.errorMessageModalTitleText = title
      $scope.errorMessageModalBodyText = body
      # switch type
      # | 'warning' => ...
      # | 'info' => ...
      # | 'error' => ...



# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
