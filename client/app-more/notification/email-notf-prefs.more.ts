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
   namespace debiki2.notification {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const DropdownModal = utils.DropdownModal;
const ExplainingListItem = util.ExplainingListItem;


interface EmailPrefDiagState {
  atRect: Rect;
  pat: PatVb;
  saveFn: (newPref: EmailNotfPrefs) => Vo ;
}


let dialogSetState: (_: EmailPrefDiagState) => void;

export function openEmailNotfPrefs(ps: EmailPrefDiagState) {
  if (!dialogSetState) {
    ReactDOM.render(EmailNotfPrefsDiag(), utils.makeMountNode());  // or [use_portal] ?
  }
  dialogSetState(ps);
}


/// Some dupl code? [6KUW24]  but this with React hooks.
///
const EmailNotfPrefsDiag = React.createFactory<{}>(function() {
  //displayName: 'EmailNotfPrefsDiag',

  // TESTS_MISSING  TyTE2E693RTMPG

  const [diagState, setDiagState] =
        React.useState<EmailPrefDiagState | Nl>(null);

  dialogSetState = setDiagState;

  const pat: PatVb | U = diagState && diagState.pat;
  const atRect: Rect = (diagState?.atRect || {}) as Rect;
  const isOpen = !!pat;

  function close() {
    setDiagState(null);
  }

  let alwaysItem: RElm | U;
  let unreadPostsItem: RElm | U;
  let directMessagesFromStaffItem: RElm | U;
  let noEmailsItem: RElm | U;

  if (isOpen) {
    const makeItem = (emailPref: EmailNotfPrefs, e2eClass: St): RElm =>
        ExplainingListItem({
            active: pat.emailNotfPrefs === emailPref,
            title: r.span({ className: e2eClass  }, emailPref_title(emailPref)),
            text: emailPref_descr(emailPref),
            onSelect: () => {
              diagState.saveFn(emailPref);
              close();
            } });

    alwaysItem = makeItem(EmailNotfPrefs.ReceiveAlways, '');
    unreadPostsItem = makeItem(EmailNotfPrefs.Receive, '');
    //directMessagesFromStaffItem;
    noEmailsItem = makeItem(EmailNotfPrefs.DontReceive, '');
  }

  return (
      DropdownModal({ show: isOpen, onHide: close, atX: atRect.left, atY: atRect.top,
          pullLeft: true, showCloseButton: true },
        r.div({ className: 's_ExplDrp_Ttl' }, "Get emailed" + ':'),  // I18N
        alwaysItem,
        unreadPostsItem,
        directMessagesFromStaffItem,
        noEmailsItem));
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
