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
/// <reference path="../utils/utils.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.pagedialogs {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const DropdownModal = utils.DropdownModal;
const ExplainingListItem = util.ExplainingListItem;


let setDiagStateFromOutside: (_: DiscLayoutDiagState) => Vo;

export function openAnonsAllowedDiag(ps: DiscLayoutDiagState) {
  if (!setDiagStateFromOutside) {
    ReactDOM.render(AnonsAllowedDiag(), utils.makeMountNode());  // or [use_portal] ?
  }
  setDiagStateFromOutside(ps);
}


/// Some dupl code? [6KUW24]  but this with React hooks.
///
const AnonsAllowedDiag = React.createFactory<{}>(function() {
  //displayName: 'DiscLayoutDiag',

  // Dupl code [node_props_diag], similar to  ./disc-layout-dialog.more.ts .

  const [diagState, setDiagState] =
      React.useState<DiscLayoutDiagState | N>(null);

  setDiagStateFromOutside = setDiagState;

  const layout: DiscPropsSource | NU = diagState && diagState.layout;
  const atRect: Rect = (diagState?.atRect || {}) as Rect;
  const isOpen = !!layout;

  function close() {
    setDiagState(null);
  }

  let forCat: Bo | U;
  let inheritItem: RElm | U;
  let neverItem: RElm | U;
  let allowItem: RElm | U;
  let recommendItem: RElm | U;
  let alwaysItem: RElm | U;

  if (isOpen) {
    forCat = diagState.forCat;

    const makeItem = (comtsStartAnon: NeverAlways, e2eClass: St): RElm => {
      let active: Bo;
      let title: St | RElm;
      const isInherit = comtsStartAnon === NeverAlways.Inherit;
      if (!isInherit) {
        active = comtsStartAnon === layout.comtsStartAnon;
        title = neverAlways_title(comtsStartAnon);
      }
      else {   // [def_disc_layout_title]
        // Inheriting is the default, so unlss we've choosen sth else, this
        // item is the active one.
        active = !layout.comtsStartAnon;
        title = rFr({},
                  "Default: ",
                  r.span({ className: 'c_CmtOrdIt_InhDef_Val' },
                    neverAlways_title(diagState.default.comtsStartAnon)));
      }
      return ExplainingListItem({
            active,
            title: r.span({ className: e2eClass  }, title),
            text: anonNeverAlways_descr(comtsStartAnon, diagState.default.from.comtsStartAnon),
            onSelect: () => {
              if (active) {
                // Noop. Already using this setting.
              }
              else {
                diagState.onSelect({ ...layout, comtsStartAnon });
              }
              close();
            } });
    }

    inheritItem = makeItem(NeverAlways.Inherit, 'e_Inh');
    neverItem = makeItem(NeverAlways.NeverButCanContinue, 'e_Nevr');
    allowItem = makeItem(NeverAlways.Allowed, 'e_Alw');
    recommendItem = makeItem(NeverAlways.Recommended, 'e_Rec');
    alwaysItem = makeItem(NeverAlways.AlwaysButCanContinue, 'e_Alw');
  }

  return (
      DropdownModal({ show: isOpen, onHide: close, atX: atRect.left, atY: atRect.top,
            pullLeft: true, showCloseButton: true, dialogClassName2: 'e_AnonComtsD c_NevAlwD' },
        r.div({ className: 's_ExplDrp_Ttl' },
          forCat
              ? rFr({}, `Anonymous comments, in this category: `, // 0I18N, is for staff
                  r.small({ style: { marginLeft: '1ex' }},
                    `(and subcategories)`))
              : `Anonymous comments, on this page`),
        inheritItem,
        neverItem,
        allowItem,
        recommendItem,
        alwaysItem,
        ));
});


function anonNeverAlways_descr(nevAlw: NeverAlways, inheritedFrom: Ref | Cat): St | RElm | N {
  // 0I18N here; this is for staff.
  switch (nevAlw) {
    case NeverAlways.Inherit:
      return utils.showDefaultFrom(inheritedFrom);

    case NeverAlways.NeverButCanContinue:
      return "People cannot post anonymously here.";

    case NeverAlways.Allowed:
      return `If anyone wants, they can choose to be anonymous. By default, ` +
              `though, one's real account is used.`;

    case NeverAlways.Recommended:
      return `People are anonymous, by default. ` +
              `One can still chooose to use one's real account.`;

    case NeverAlways.AlwaysButCanContinue:
      return "Everyone is anonymous.";

    default:
      return null;
  }
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
