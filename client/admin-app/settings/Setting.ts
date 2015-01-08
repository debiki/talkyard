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

interface SettingScope extends RootScope {
  title: string;
  pageId: string;
  setting: model.Setting<any>;
  /** If a text setting should use a multiline editor, i.e. a <textarea> not an <input>. */
  multiline: boolean;
  settingIdAttr(): string;
  isBoolSetting(): boolean;
  isTextSetting(): boolean;
  valueChanged(): boolean;
  hasDefaultValue(): boolean;
  cancel(): void;
  setToDefault(): void;
  save(): void;
}


debiki2.admin.adminApp.directive('setting', () => {
  return {
    restrict: 'E',
    transclude: true,
    templateUrl: 'settings/setting.html',
    scope: {
      title: '@',
      pageId: '@',
      setting: '=',
      multiline: '='
    },
    controller: ['$scope', 'QueryService', function(
        $scope: SettingScope, queryService: QueryService) {

      $scope.settingIdAttr = () => {
        return 'setting-' + $scope.setting.name;
      };

      $scope.isBoolSetting = () => {
        return (typeof $scope.setting.newValue) === 'boolean';
      };

      $scope.isTextSetting = () => {
        return (typeof $scope.setting.newValue) === 'string';
      };

      $scope.valueChanged = () => {
        return $scope.setting.newValue !== $scope.setting.currentValue;
      };

      $scope.hasDefaultValue = () => {
        return $scope.setting.currentValue === $scope.setting.defaultValue;
      };

      $scope.cancel = () => {
        $scope.setting.newValue = $scope.setting.currentValue;
      };

      $scope.setToDefault = () => {
        $scope.setting.newValue = $scope.setting.defaultValue;
      };

      $scope.save = () => {
        queryService.saveSetting($scope.setting).then(() => {
          $scope.setting.currentValue = $scope.setting.newValue;
        }).catch((reason) => {
          // COULD show error message somehow
          console.error('Error saving setting: ' + reason);
        });
      };
    }],
  };
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
