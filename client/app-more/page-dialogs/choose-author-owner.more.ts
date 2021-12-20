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

interface AnonStatusState {
  atRect: Rect;
  open?: Bo;
  pat?: Pat;
  me: Me,
  curStatus?: AnonStatus;
  saveFn: (newPref: AnonStatus) => Vo ;
}


let setStateExtFn: (_: AnonStatusState) => Vo;

export function openAnonDropdown(ps: AnonStatusState) {
  if (!setStateExtFn) {
    ReactDOM.render(AnonStatusModal(), utils.makeMountNode());  // or [use_portal] ?
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
const AnonStatusModal = React.createFactory<{}>(function() {
  //displayName: 'AnonStatusModal',

  // TESTS_MISSING

  const [state, setState] = React.useState<AnonStatusState | N>(null);

  setStateExtFn = setState;

  const atRect: Rect = (state?.atRect || {}) as Rect;
  const isOpen = state && state.open;

  function close() {
    setState(null);
  }

  let asYourName: RElm | U;
  let anonymously: RElm | U;

  if (isOpen) {
    const me: Me = state.me;
    const pat: Pat | U = state.pat;
    const makeItem = (anonStatus: AnonStatus, e2eClass: St): RElm => {
      const title = r.span({ className: e2eClass }, anonStatus_title(anonStatus, { me, pat }));
      const text = anonStatus_descr(anonStatus, { me, pat });
      return (
          ExplainingListItem({
            title, text,
            active: anonStatus === state.curStatus,
            onSelect: () => {
              state.saveFn(anonStatus);
              close();
            },
          }));
    }

    asYourName = makeItem(AnonStatus.NotAnon, '');
    anonymously = makeItem(AnonStatus.PerPage, '');

    // Pen name?:  openAddPeopleDialog(alreadyAddedIds, onDone)
  }

  return (
      DropdownModal({ show: isOpen, onHide: close, atX: atRect.left, atY: atRect.top,
          pullLeft: true, showCloseButton: true },
        r.div({ className: 's_ExplDrp_Ttl' }, "Post ..."),  // I18N
        asYourName,
        anonymously));
});


export function anonStatus_titleShort(level: AnonStatus, ps: { me: Me, pat?: Pat }): St {
  switch (level) {
    case AnonStatus.PerPage:
      return "anonymously";
    case AnonStatus.NotAnon:
    default:
      return "as " + pat_name(ps.pat || ps.me);
  }
}


export function anonStatus_title(level: AnonStatus, ps: { me: Me, pat?: Pat }): St {
  switch (level) {
    case AnonStatus.PerPage:
      return "Anonymously";
    case AnonStatus.NotAnon:
    default:
      const pat = ps.pat;
      return pat ? "As " + pat_name(pat)
                  : "As you, " + pat_name(ps.me);
  }
}


export function anonStatus_descr(level: AnonStatus, ps: { me: Me, pat?: Pat }): St {
  switch (level) {
    case AnonStatus.PerPage:
      return "Your name and picture won't be shown. " +
              "Admins can still check who you are, though.";
    case AnonStatus.NotAnon:
    default:
      return "Others can see who you are — they'll see your username and picture.";
  }
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
