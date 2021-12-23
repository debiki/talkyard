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


let setStateExtFn: (_: ChooseAnonDiagParams) => Vo;

export function openAnonDropdown(ps: ChooseAnonDiagParams) {
  if (!setStateExtFn) {
    ReactDOM.render(ChooseAnonModal(), utils.makeMountNode());  // or [use_portal] ?
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
const ChooseAnonModal = React.createFactory<{}>(function() {
  //displayName: 'ChooseAnonModal',

  // TESTS_MISSING

  const [state, setState] = React.useState<ChooseAnonDiagParams | N>(null);

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
    const makeItem = (whichAnon: WhichAnon, e2eClass: St): RElm => {
      const title = r.span({ className: e2eClass }, whichAnon_title(whichAnon, { me, pat }));
      const text = whichAnon_descr(whichAnon, { me, pat });
      return (
          ExplainingListItem({
            title, text,
            active: whichAnon === state.curAnon?.newAnonStatus,
            onSelect: () => {
              state.saveFn(whichAnon);
              close();
            },
          }));
    }

    asYourName = makeItem({ newAnonStatus: AnonStatus.NotAnon }, '');
    anonymously = makeItem({ newAnonStatus: AnonStatus.PerPage }, '');

    // Pen name?:  openAddPeopleDialog(alreadyAddedIds, onDone)
  }

  return (
      DropdownModal({ show: isOpen, onHide: close, atX: atRect.left, atY: atRect.top,
          pullLeft: true, showCloseButton: true },
        r.div({ className: 's_ExplDrp_Ttl' }, "Post ..."),  // I18N
        asYourName,
        anonymously));
});


export function whichAnon_titleShort(doAsAnon: WhichAnon | U, ps: { me: Me, pat?: Pat }): St {
  switch (level) {
    case AnonStatus.PerPage:
      return "anonymously";
    case AnonStatus.NotAnon:
    default:
      return "as " + pat_name(ps.pat || ps.me);
  }
}


export function whichAnon_title(doAsAnon: WhichAnon | U, ps: { me: Me, pat?: Pat }): St {
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


export function whichAnon_descr(doAsAnon: WhichAnon | U, ps: { me: Me, pat?: Pat }): St {
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
