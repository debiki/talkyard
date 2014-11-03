/*
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

/// <reference path="ReactDispatcher.ts" />

//------------------------------------------------------------------------------
   module debiki2.ReactActions {
//------------------------------------------------------------------------------


export var actionTypes = {
  Login: 'Login',
  Logout: 'Logout',
  SetPageNotfLevel: 'SetPageNotfLevel'
}


export function login() {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.Login,
    user: {
      isAdmin: d.i.Me.isAdmin(),
      userId: d.i.Me.getUserId(),
      username: '???',
      fullName: d.i.Me.getName(),
      permsOnPage: d.i.Me.getPermsOnPage(),
      pageNotfLevel: 'Regular', // for now
      isEmailKnown: d.i.Me.isEmailKnown(),
      isAuthenticated: d.i.Me.isAuthenticated()
    }
  });
}


export function logout() {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.Logout
  });
}


export function setPageNoftLevel(newNotfLevel) {
  //Server.savePageNotfLevel(newNotfLevel);
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.SetPageNotfLevel,
    newLevel: newNotfLevel
  });
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
