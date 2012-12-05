# Copyright (c) 2012 Kaj Magnus Lindberg. All rights reserved

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
    <div ui-modal class="fade"
        id="errorMessageModal"
        ng-model="errorMessageModalShown">
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
