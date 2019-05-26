/*
 * Copyright (c) 2018 Kaj Magnus Lindberg
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

/// <reference path="../widgets.ts" />
/// <reference path="../oop-methods.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.notfs {
//------------------------------------------------------------------------------


export function PageNotfPrefButton(props: {
      target: PageNotfPrefTarget, store: Store,
      ownPrefs: OwnPageNotfPrefs,  // RENAME to membersPrefs
      ppsById?: PpsById,
      saveFn?: (notfLevel: PageNotfLevel) => void }) {
  const effPref = pageNotfPrefTarget_findEffPref(props.target, props.store, props.ownPrefs);
  return (
      Button({ className: 'dw-notf-level', onClick: event => {
        const rect = cloneEventTargetRect(event);
        Server.loadMoreScriptsBundle(() => {
          notfs['openNotfPrefDropdown'](rect, props);
        });
      }},
      notfPref_title(effPref), ' ', r.span({ className: 'caret' })));
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
