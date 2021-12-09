/*
 * Copyright (c) 2020 Kaj Magnus Lindberg
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

/// <reference path="../more-prelude.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.anon {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const DropdownModal = utils.DropdownModal;
const ExplainingListItem = util.ExplainingListItem;

interface AnonLevelState {
  atRect: Rect;
  open?: Bo;
  pat: PatVb;
  me: Me,
  curLevel?: AnonLevel;
  saveFn: (newPref: AnonLevel) => Vo ;
}


let setStateExtFn: (_: AnonLevelState) => Vo;

export function openAnonDropdown(ps: AnonLevelState) {
  if (!setStateExtFn) {
    ReactDOM.render(AnonLevelModal(), utils.makeMountNode());  // or [use_portal] ?
  }
  setStateExtFn(ps);
}


/// Some dupl code? [6KUW24]  but this with React hooks.
///
///  Or use instead:  client/app-more/page-dialogs/add-remove-people-dialogs.more.ts  ?
///  Or maybe have this dialog, use that dialog,
///       via a  As someone else ...   button — and then one could use one's pen name,
///       if any?
///
///
const AnonLevelModal = React.createFactory<{}>(function() {
  //displayName: 'EmailNotfPrefsDiag',

  // TESTS_MISSING

  const [state, setState] = React.useState<AnonLevelState | N>(null);

  setStateExtFn = setState;

  const atRect: Rect = (state?.atRect || {}) as Rect;
  const isOpen = state && state.open; //  !!pat;

  function close() {
    setState(null);
  }

  let asYourName: RElm | U;
  let anonymously: RElm | U;

  if (isOpen) {
    const makeItem = (anonLevel: AnonLevel, e2eClass: St): RElm => {
      const title = r.span({ className: e2eClass },
              anonLevel_title(anonLevel, state.pat, state.me));
      const text = anonLevel_descr(anonLevel, state.pat, state.me);
      return ExplainingListItem({
                title, text,
                active: anonLevel === state.curLevel,
                onSelect: () => {
                  state.saveFn(anonLevel);
                  close();
                },
              });
    }

    asYourName = makeItem(AnonLevel.NotAnon, '');
    anonymously = makeItem(AnonLevel.PerPage, '');

    // Pen name?:  openAddPeopleDialog(alreadyAddedIds, onDone)
  }

  return (
      DropdownModal({ show: isOpen, onHide: close, atX: atRect.left, atY: atRect.top,
          pullLeft: true, showCloseButton: true },
        r.div({ className: 's_ExplDrp_Ttl' }, "Post as ..."),  // I18N
        asYourName,
        anonymously));
});


export function anonLevel_titleShort(level: AnonLevel, pat: Pat, me: Me): St {
  switch (level) {
    case 10: return "as yourself";
    case 50: return "anonymously";
  }
}


export function anonLevel_title(level: AnonLevel, pat: Pat, me: Me): St {
  switch (level) {
    case 10: return "As you, " + pat.username;
    case 50: return "Post anonymously";
  }
}


export function anonLevel_descr(level: AnonLevel, pat: Pat, me: Me): St {
  switch (level) {
    case 10: return "Others can see who you are — they see your username and picture.";
    case 50: return "Your name and picture aren't shown. " +
              "Admins can still check who you are, though.";
  }
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
