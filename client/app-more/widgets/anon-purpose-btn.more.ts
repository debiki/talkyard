/*
 * Copyright (c) 2024 Kaj Magnus Lindberg
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
   namespace debiki2.widgets {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const ExplainingListItem = util.ExplainingListItem;



export const AnonPurposeBtn = React.createFactory<DiscLayoutDropdownBtnProps>(
        function(props: DiscLayoutDropdownBtnProps) {

  const derived: NodePropsDerivedAndDefault = node_deriveLayout(props);

  // Bit dupl code. [node_props_btn]
  return (
      Button({ className: 'e_AnonPurpB', onClick: (event: MouseEvent) => {
          const atRect = cloneEventTargetRect(event);
          openAnonPurposeDiag({
              atRect,
              // This is what's being edited.
              layout: derived.layoutSource,
              // This is the defaults, e.g. parent category settings, will get used
              // if layoutSource settings cleared (gets set to Inherit).
              default: derived.parentsLayout,
              // These forSth just affect the dialog title.
              forCat: !!props.cat,
              forEveryone: props.forEveryone, // not needed actually
              onSelect: props.onSelect });
        }},
        anonPurpose_title(derived.actualLayout.newAnonStatus),
            ' ', r.span({ className: 'caret' })));
});



function anonPurpose_title(neverAlways: AnonStatus): St {
  switch (neverAlways) {
    case AnonStatus.IsAnonOnlySelfCanDeanon: return "Sensitive discussions";
    case AnonStatus.IsAnonCanAutoDeanon: return "Better ideas & decisions";
    default:
      return `Bad: ${neverAlways} TyEANONPURP`;
  }
}


// Can rewrite the neverAlways diag to use proxy diag too,  [anon_purpose_proxy_diag]
// like below.
//
function openAnonPurposeDiag(ps: DiscLayoutDiagState) {
  morekit.openProxyDiag({ atRect: ps.atRect, flavor: DiagFlavor.Dropdown,
              dialogClassName: 'e_AnonPurpD' },
      (closeDiag) => {

    const layout: DiscPropsSource = ps.layout;

    let diagTitle: St | RElm | U;
    let sensitiveItem: RElm | U;
    let betterIdeasItem: RElm | U;

    diagTitle = r.div({ className: 's_ExplDrp_Ttl' }, "Purpose");

    sensitiveItem = makeItem(AnonStatus.IsAnonOnlySelfCanDeanon, 'e_OnlSelf');
    betterIdeasItem = makeItem(AnonStatus.IsAnonCanAutoDeanon, 'e_AutoDean');

    function makeItem(itemValue: AnonStatus, e2eClass: St): RElm {
      let active: Bo;
      let title: St | RElm;
      active = itemValue === layout.newAnonStatus;
      title = anonPurpose_title(itemValue);

      return ExplainingListItem({
            active,
            title: r.span({ className: e2eClass  }, title),
            // text: diagState.mkDescr(itemValue, diagState.default.from),
            onSelect: () => {
              if (active) {
                // Noop. Already using this setting.
              }
              else {
                ps.onSelect({ ...layout, newAnonStatus: itemValue });
              }
              closeDiag();
            } });
    }

    return rFr({},
          diagTitle,
          sensitiveItem,
          betterIdeasItem,
          );
  });
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
