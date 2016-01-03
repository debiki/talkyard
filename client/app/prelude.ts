/*
 * Copyright (C) 2015 Kaj Magnus Lindberg
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

/// <reference path="plain-old-javascript.d.ts" />

/**
 * Basic stuff needed by essentially all modules / files.
 */
//------------------------------------------------------------------------------
   module debiki2 {
//------------------------------------------------------------------------------

export function die(errorMessage: string) {
  var dialogs: any = debiki2['pagedialogs'];
  setTimeout(() => {
    debiki2['Server'].logBrowserError(errorMessage);
  });
  if (dialogs && dialogs.showAndThrowClientSideError) {
    dialogs.showAndThrowClientSideError(errorMessage);
  }
  else {
    // Server side.
    throw new Error(errorMessage);
  }
}

export function dieIf(condition, errorMessage: string) {
  if (condition) {
    die(errorMessage);
  }
}


export function scrollToBottom(node) {
  dieIf(!node, 'DwE9FMW2');
  node.scrollTop = node.scrollHeight;
}


export var findDOMNode = window['React'].findDOMNode;
dieIf(!findDOMNode, 'EsE6UMGY2');


//------------------------------------------------------------------------------
}
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
