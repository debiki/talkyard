/*
 * Copyright (c) 2022 Kaj Magnus Lindberg
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
   namespace debiki2 {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const DropdownModal = utils.DropdownModal;
const ExplainingListItem = util.ExplainingListItem;


export interface TrustLevelBtnProps {
  diagTitle: St,
  className?: St,
  minLevel?: TrustLevelOrStaff,
  maxLevel?: TrustLevelOrStaff,
  ownLevel: TrustLevelOrStaff | U;
  defLevel: TrustLevelOrStaff
  saveFn: (newLevel: TrustLevelOrStaff | N) => V;
}


// Bit dupl code? [open_diag_btn]
export function TrustLevelBtn(props: TrustLevelBtnProps) {
  const level = firstValOf(props.ownLevel, props.defLevel);
  const isDef = !isVal(props.ownLevel) && isVal(props.defLevel);
  const isDefClass = isDef ? ' e_TrLv-Def' : '';
  const isDefTxt = isDef ? " (default)" : '';
  const className = `e_TrLv-${level}${isDefClass} ${props.className || ''}`;
  return (
      Button({ className, onClick: event => {
          const atRect = cloneEventTargetRect(event);
          openTrustLevelDiag({ ...props, atRect });
        }},
        trustLevel_toString(level as any) + isDefTxt, ' ', r.span({ className: 'caret' })
      ));
}


interface TrustLevelDiagState {
  diagTitle: St,
  atRect: Rect;
  minLevel?: TrustLevelOrStaff,
  maxLevel?: TrustLevelOrStaff,
  ownLevel: TrustLevelOrStaff | U;
  defLevel: TrustLevelOrStaff
  saveFn: (newLevel: TrustLevelOrStaff | N) => V;
}


let setDiagState: (_: TrustLevelDiagState) => Vo;

function openTrustLevelDiag(ps: TrustLevelDiagState) {
  if (!setDiagState) {
    ReactDOM.render(TrustLevelDiag(), utils.makeMountNode());  // or [use_portal] ?
  }
  setDiagState(ps);
}


/// Some dupl code? [6KUW24]  but this with React hooks.
///
const TrustLevelDiag = React.createFactory<{}>(function() {
  //displayName: 'TrustLevelDiag',

  const [diagState, setDiagState2] =
        React.useState<TrustLevelDiagState | N>(null);

  setDiagState = setDiagState2;

  const isOpen = !!diagState;
  const atRect: Rect = (isOpen ? diagState.atRect : {}) as Rect;

  function close() {
    setDiagState(null);
  }

  let title: St | U;
  let defaultItem: RElm | U;
  let strangersItem: RElm | U;
  let allMembersItem: RElm | U;
  let basicMembersItem: RElm | U;
  let fullMembersItem: RElm | U;
  let trustedMembersItem: RElm | U;
  let coreMembersItem: RElm | U;
  let staffItem: RElm | U;
  let adminsItem: RElm | U;

  if (isOpen) {
    const min = diagState.minLevel || TrustLevelOrStaff.Min;
    const max = diagState.maxLevel || TrustLevelOrStaff.Max;
    const makeItem = (level: TrustLevelOrStaff): RElm => {
      return level < min || max < level ? null : (
            ExplainingListItem({
                active: diagState.ownLevel === level,
                title: r.span({ className: 'e_TrLv-' + level  },
                          trustLevel_toString(level as any)),
                // text: trustLevel_descr(level),  — later?
                onSelect: () => {
                  diagState.saveFn(level);
                  close();
                }}));
    }

    title = diagState.diagTitle;
    defaultItem = ExplainingListItem({
                active: !isVal(diagState.ownLevel),
                title: r.span({ className: 'e_TrLv-Def'  },
                          "Default: " + trustLevel_toString(diagState.defLevel)),
                onSelect: () => {
                  diagState.saveFn(null);
                  close();
                }});

    strangersItem = makeItem(TrustLevelOrStaff.Stranger);
    allMembersItem = makeItem(TrustLevelOrStaff.New);
    basicMembersItem = makeItem(TrustLevelOrStaff.Basic);
    fullMembersItem = makeItem(TrustLevelOrStaff.FullMember);
    trustedMembersItem = makeItem(TrustLevelOrStaff.Trusted);
    // Skip:  makeItem(TrustLevelOrStaff.Regular, ...);
    coreMembersItem = makeItem(TrustLevelOrStaff.CoreMember);
    staffItem = makeItem(TrustLevelOrStaff.Staff);
    adminsItem = makeItem(TrustLevelOrStaff.Admin);
  }

  return (
      DropdownModal({ show: isOpen, onHide: close, atX: atRect.left, atY: atRect.top,
            pullLeft: true, showCloseButton: true, className: 'e_TruLvD' },
        r.div({ className: 's_ExplDrp_Ttl' }, title),
        defaultItem,
        strangersItem,
        allMembersItem,
        basicMembersItem,
        fullMembersItem,
        trustedMembersItem,
        coreMembersItem,
        staffItem,
        adminsItem,
        ));
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
