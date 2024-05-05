/*
 * Copyright (c) 2023, 2024 Kaj Magnus Lindberg
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


export interface NeverAlwaysProps {
  getVal: (_: DiscPropsSource) => NeverAlways,
  setVal: (_: DiscPropsSource, val: NeverAlways) => DiscPropsSource
  mkDiagTitle: TitleFn
  mkItemDescr: DescrFn
  e2eClass: St
}

type GetValFn = (p: DiscPropsSource) => NeverAlways;
type SetValFn = (p: DiscPropsSource, val: NeverAlways) => DiscPropsSource;
type TitleFn = (forCat: Bo | U) => St | RElm;
type DescrFn = (nevAlw: NeverAlways, defaultFrom: DiscPropsComesFrom) => St | RElm | N;



export const NeverAlwaysBtn = React.createFactory<DiscLayoutDropdownBtnProps & NeverAlwaysProps>(
        function(props: DiscLayoutDropdownBtnProps & NeverAlwaysProps) {

  const derived: NodePropsDerivedAndDefault = node_deriveLayout(props);

  // Bit dupl code. [node_props_btn]
  return (
      Button({ className: 'e_ComtAnoB', onClick: (event) => {
          const atRect = cloneEventTargetRect(event);
          openNeverAlwaysDiag({
              atRect,
              // This is what's being edited.
              layout: derived.layoutSource,
              // This is the defaults, e.g. parent category settings, will get used
              // if layoutSource settings cleared (gets set to Inherit).
              default: derived.parentsLayout,
              // These forSth just affect the dialog title.
              forCat: !!props.cat,
              forEveryone: props.forEveryone, // not needed actually
              onSelect: props.onSelect },

              props.getVal,
              props.setVal,
              props.mkDiagTitle,
              props.mkItemDescr,
              props.e2eClass);
        }},
        neverAlways_title(props.getVal(derived.actualLayout)),
            ' ', r.span({ className: 'caret' })));
});


function neverAlways_title(neverAlways: NeverAlways): St {
  switch (neverAlways) {
    // case PostSortOrder.Inherit:
    //  Not supposed to happen. Instead the DiscLayoutDiag constructs a list item
    //  for the admins. [def_disc_layout_title]
    //  Using `default:` case, below.
    case NeverAlways.NeverButCanContinue: return "Never";  // I18N here and below
    case NeverAlways.Allowed: return "Allowed";
    case NeverAlways.Recommended: return "Recommended";
    case NeverAlways.AlwaysButCanContinue: return "Always";
    default:
      return `Bad: ${neverAlways} TyENEVRALW`;
  }
}


interface State extends DiscLayoutDiagState {
  getVal: GetValFn
  setVal: SetValFn
  mkTitle: TitleFn
  mkDescr: DescrFn
  e2eClass: St
}

let setDiagStateFromOutside: (_: State) => V;


function openNeverAlwaysDiag(ps: DiscLayoutDiagState,
          getVal: GetValFn, setVal: SetValFn,
          mkTitle: TitleFn, mkDescr: DescrFn, e2eClass: St) {
  if (!setDiagStateFromOutside) {
    ReactDOM.render(NeverAlwaysDiag(), utils.makeMountNode());  // or [use_portal] ?
  }
  setDiagStateFromOutside({ ...ps, getVal, setVal, mkTitle, mkDescr, e2eClass });
}


/// Some dupl code? [6KUW24]  but this with React hooks.
/// Use ProxyDiag instead?  See [anon_purpose_proxy_diag].
///
const NeverAlwaysDiag = React.createFactory<{}>(function() {
  //displayName: 'NeverAlwaysDiag',

  // Dupl code [node_props_diag], similar to  ./disc-layout-dialog.more.ts
  // and  ../morekit/proxy-diag.more.ts .

  const [diagState, setDiagState] = React.useState<State | N>(null);

  setDiagStateFromOutside = setDiagState;

  const layout: DiscPropsSource | NU = diagState && diagState.layout;
  const atRect: Rect = (diagState?.atRect || {}) as Rect;
  const isOpen = !!layout;

  function close() {
    setDiagState(null);
  }

  let diagTitle: St | RElm | U;
  let inheritItem: RElm | U;
  let neverItem: RElm | U;
  let allowItem: RElm | U;
  let recommendItem: RElm | U;
  let alwaysItem: RElm | U;

  if (isOpen) {
    diagTitle = r.div({ className: 's_ExplDrp_Ttl' }, diagState?.mkTitle(diagState.forCat));

    const makeItem = (itemValue: NeverAlways, e2eClass: St): RElm => {
      let active: Bo;
      let title: St | RElm;
      const isInherit = itemValue === NeverAlways.Inherit;
      if (!isInherit) {
        active = itemValue === diagState.getVal(layout);
        title = neverAlways_title(itemValue);
      }
      else {   // [def_disc_layout_title]
        // Inheriting is the default, so unlss we've choosen sth else, this
        // item is the active one.
        active = !diagState.getVal(layout);
        title = rFr({},
                  "Default: ",
                  r.span({ className: 'c_CmtOrdIt_InhDef_Val' },
                    neverAlways_title(diagState.getVal(diagState.default))));
      }
      return ExplainingListItem({
            active,
            title: r.span({ className: e2eClass  }, title),
            text: diagState.mkDescr(itemValue, diagState.default.from),
            onSelect: () => {
              if (active) {
                // Noop. Already using this setting.
              }
              else {
                diagState.onSelect(diagState.setVal(layout, itemValue));
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
            pullLeft: true, showCloseButton: true,
            dialogClassName2: 'c_NevAlwD ' + (diagState ? diagState.e2eClass : '') },
        diagTitle,
        inheritItem,
        neverItem,
        allowItem,
        recommendItem,
        alwaysItem,
        ));
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
