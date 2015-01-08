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

/// <reference path="../typedefs/angularjs/angular.d.ts" />

//------------------------------------------------------------------------------
   module debiki2.admin {
//------------------------------------------------------------------------------


/**
 * Is initialized in AdminApp-impl.ts, to avoid cyclic file references.
 * If Angular not loaded (it's only in use on the admin pages) then provide
 * a dummy implementation.
 */

export var adminApp: any = window['angular']
    ? angular.module('DebikiAdminApp', ['ui.router'])
    : {
      config: function() {},
      run: function() {},
      service: function() {},
      controller: function() {},
      directive: function() {},
    };

if (!window['angular']) {
  window['angular'] = {
    'module': function() {
      return {
        run: function() {}
      };
    }
  };
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
