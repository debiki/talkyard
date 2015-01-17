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

/// <reference path="Setting.ts" />
/// <reference path="SettingsTarget.ts" />

//------------------------------------------------------------------------------
   module debiki2.admin.model {
//------------------------------------------------------------------------------


export class Settings {

  constructor(
      public target: SettingsTarget,
      public companyFullName: Setting<string>,
      public companyShortName: Setting<string>,
      public companyDomain: Setting<string>,
      public title: Setting<string>,
      public description: Setting<string>, 
      public headerHtml: Setting<string>,
      public footerHtml: Setting<string>,
      public logoUrlOrHtml: Setting<string>,
      public headStylesHtml: Setting<string>,
      public headScriptsHtml: Setting<string>,
      public endOfBodyHtml: Setting<string>,
      public horizontalComments: Setting<boolean>,
      public googleUniversalAnalyticsTrackingId: Setting<string>) {
  }

  static fromJsonMap(target: SettingsTarget, json) {
    return new Settings(
        target,
        this.makeSetting<string>(target, 'companyFullName', json),
        this.makeSetting<string>(target, 'companyShortName', json),
        this.makeSetting<string>(target, 'companyDomain', json),
        this.makeSetting<string>(target, 'title', json),
        this.makeSetting<string>(target, 'description', json),
        this.makeSetting<string>(target, 'headerHtml', json),
        this.makeSetting<string>(target, 'footerHtml', json),
        this.makeSetting<string>(target, 'logoUrlOrHtml', json),
        this.makeSetting<string>(target, 'headStylesHtml', json),
        this.makeSetting<string>(target, 'headScriptsHtml', json),
        this.makeSetting<string>(target, 'endOfBodyHtml', json),
        this.makeSetting<boolean>(target, 'horizontalComments', json),
        this.makeSetting<string>(target, 'googleUniversalAnalyticsTrackingId', json));
  }

  private static makeSetting<T>(target: SettingsTarget, name: string, valueMap): Setting<T> {
    // ? SHOULD change from currentValue to anyAssignedValue which might be null.
    var jsonSetting = valueMap[name];
    //errorIf(jsonSetting == null, "No such setting: `$name' [DwEKf980]");
    return new Setting<T>(
        target,
        name,
        jsonSetting['defaultValue'],
        jsonSetting['anyAssignedValue']);
  }

}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
