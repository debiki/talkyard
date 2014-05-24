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

/// <reference path="../../typedefs/angularjs/angular.d.ts" />
/// <reference path="../AdminApp.ts" />

//------------------------------------------------------------------------------
   module debiki2.admin.settings {
//------------------------------------------------------------------------------


interface SpecialContentScope extends RootScope {
  title: string;
  type: string;
  rootPageId: string;
  contentId: string;
  content: model.SpecialContent;
  valueChanged(): boolean;
  hasDefaultValue(): boolean;
  cancel(): void;
  setToDefault(): void;
  save(): void;
}


debiki2.admin.adminApp.directive('specialContent', () => {
  return {
    restrict: 'E',
    transclude: true,
    templateUrl: 'special-content/special-content.html',
    scope: {
      title: '@',
      type: '@',
      rootPageId: '@',
      contentId: '@'
    },
    controller: ['$scope', 'QueryService', function(
        $scope: SpecialContentScope, queryService: QueryService) {

      $scope.valueChanged = () => {
        return $scope.content.newText !== $scope.content.currentText;
      };

      $scope.hasDefaultValue = () => {
        return $scope.content.currentText == $scope.content.defaultText;
      };

      $scope.cancel = () => {
        $scope.content.newText = $scope.content.currentText;
      };

      $scope.setToDefault = () => {
        $scope.content.newText = $scope.content.defaultText;
      };

      $scope.save = () => {
        queryService.saveSpecialContent($scope.content).then(() => {
          $scope.content.currentText = $scope.content.newText;
        }).catch((reason) => {
          // COULD show error message somehow
          console.error('Error saving special content: ' + reason);
        });
      };

      if ($scope.rootPageId == null)
        $scope.rootPageId = '';

      queryService.loadSpecialContent($scope.rootPageId, $scope.contentId).then(
          (content: model.SpecialContent) => {
        $scope.content = content;
      });
    }],
  };
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
