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

//------------------------------------------------------------------------------
   module debiki2.admin.model {
//------------------------------------------------------------------------------


export class SettingsTarget {

  constructor(public type: string, public pageId: string) {
  }

  static forWholeSite(): SettingsTarget {
    return new SettingsTarget('WholeSite', null);
  }

  static forSection(pageId: string): SettingsTarget {
    return new SettingsTarget('PageTree', pageId);
  }

  static forPage(pageId: string): SettingsTarget {
    return new SettingsTarget('SinglePage', pageId);
  }

}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
