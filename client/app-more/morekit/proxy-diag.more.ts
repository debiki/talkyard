/*
 * Copyright (c) 2023 Kaj Magnus Lindberg
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
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/// <reference path="../more-prelude.more.ts" />


//------------------------------------------------------------------------------
   namespace debiki2.morekit {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;


interface ProxyDiagState {
  params: ProxyDiagParams,
  windowWidth: Nr;
  children: RElm;
}


let setDropdownStateFromOutside: U | ((_: ProxyDiagState | N) => V);


export function openProxyDiag(params: ProxyDiagParams, childrenFn: (close: () => V) => RElm) {
  if (!setDropdownStateFromOutside) {
    ReactDOM.render(ProxyDiag(), utils.makeMountNode());
  }
  const closeDropdonFn = () => setDropdownStateFromOutside(null);
  setDropdownStateFromOutside({
        params,
        windowWidth: window.innerWidth, // what about emb comts, narrower than window?
        children: childrenFn(closeDropdonFn) });
}


const ProxyDiag = React.createFactory<{}>(function() {

  // Dupl code [node_props_diag], similar to  ../page-dialogs/anons-allowed-diag.more.ts .

  const [diagState, setDiagState] =
      React.useState<ProxyDiagState | N>(null);

  setDropdownStateFromOutside = setDiagState;

  if (!diagState)
    return null;

  const state: ProxyDiagState = diagState;
  const ps: ProxyDiagParams = state.params;
  const close = () => setDiagState(null);
  const flavorClass = ps.flavor === DiagFlavor.Dropdown ? 'c_PrxyD-Drpd ' : '';

  return utils.DropdownModal({
        show: true,
        onHide: close,
        atRect: ps.atRect,
        windowWidth: state.windowWidth,
        pullLeft: ps.pullLeft,
        dialogClassName2: 'c_PrxyD ' + flavorClass + (ps.dialogClassName || ''),
        className: ps.contentClassName,
        allowFullWidth: ps.allowFullWidth,
        showCloseButton: ps.showCloseButton !== false,
        // bottomCloseButton: not yet impl
        onContentClick: !ps.closeOnButtonClick ? null : (event: MouseEvent) => {
          // Don't close if e.g. clicking a <p>, maybe to select text — only if
          // clicking a button.
          if (!elm_isBtn(event.target)) return;
          if (ps.stayOpenOnCmdShiftClick && event_isCmdShiftClick(event)) return;
          close();
        },
      } as DropdownProps,
      state.children);
});



//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
