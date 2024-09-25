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
  const newAnonStatus = derived.actualLayout.newAnonStatus;

  // Is the currently choosen option _enabled? (Might not be, if `settings.enableAnonSens`
  // gets disabled, when there are *already* anon cats. [_active_and_disabled])
  const btnEnabled: Bo =
          // For anonymous sensitive discussions. Needs to be enabled explicitly,
          // since disables the presence feature. [anon_sens_0_presence]
          newAnonStatus === AnonStatus.IsAnonOnlySelfCanDeanon &&
              props.store.settings.enableAnonSens ||
          // For ideation. Always enabled.
          newAnonStatus === AnonStatus.IsAnonCanAutoDeanon;
          // Sth else? Will be disabled — then, should notice it needs to be added here.

  const titleDescr = anonPurpose_title(newAnonStatus, btnEnabled);
  const howEnable: St | RElm | NU = titleDescr[1];
  const disabledClass = btnEnabled ? '' : ' n_Dis';
  const crossClass = btnEnabled ? '' : 'c_Cross';
  const btnTitle = r.span({ className: crossClass },
          titleDescr[0], ' ', r.span({ className: 'caret' }));

  // Bit dupl code. [node_props_btn]
  return rFr({},
      Button({ className: 'c_AnonPurpB' + disabledClass, onClick: (event: MouseEvent) => {
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
              // Should the anon sensitive discussions option be _enabled in the dropdown?
              enableAnonSens: props.store.settings.enableAnonSens,
              onSelect: props.onSelect });
        }},
        btnTitle),
      howEnable && r.div({ className: 'c_AnonPurpB_HowEna' }, howEnable));
});



// Returns  [title, howEnable]  where howEnable explains how to enable this option,
// if it's not currently enabled.
//
function anonPurpose_title(neverAlways: AnonStatus, enabled: Bo): [St, St | RElm | NU] {
  let title: St | U;
  let howEnable: St | RElm | NU;
  switch (neverAlways) {
    case AnonStatus.IsAnonOnlySelfCanDeanon:
      title = "Sensitive discussions";
      howEnable = rFr({},
          "You need to enable the Anonymous Sensitive Discussions site feature, ",
          r.a({ href: linkToAdminPageFeatures(), target: 'blank' }, "here."));
      break;
    case AnonStatus.IsAnonCanAutoDeanon:
      title = "Better ideas & decisions";
      // howEnable — always enabled, if anon comments possible.
      break;
    default:
      return [`Bad: ${neverAlways} TyEANONPURP`, null];
  }
  return [title, enabled ? null : howEnable];
}


// Can rewrite the neverAlways diag to use proxy diag too,  [anon_purpose_proxy_diag]
// like below.
//
function openAnonPurposeDiag(ps: DiscLayoutDiagState & { enableAnonSens?: Bo }) {
  morekit.openProxyDiag({ atRect: ps.atRect, flavor: DiagFlavor.Dropdown,
              dialogClassName: 'e_AnonPurpD' },
      (closeDiag) => {

    const layout: DiscPropsSource = ps.layout;

    let diagTitle: St | RElm | U;
    let sensitiveItem: RElm | U;
    let betterIdeasItem: RElm | U;

    diagTitle = r.div({ className: 's_ExplDrp_Ttl' }, "Purpose");

    sensitiveItem = makeItem(AnonStatus.IsAnonOnlySelfCanDeanon, 'e_OnlSelf', ps.enableAnonSens);
    betterIdeasItem = makeItem(AnonStatus.IsAnonCanAutoDeanon, 'e_AutoDean', true);

    function makeItem(itemValue: AnonStatus, e2eClass: St, enabled: Bo): RElm {
      const [title, anyExpl] = anonPurpose_title(itemValue, enabled);
      const active = itemValue === layout.newAnonStatus;
      const crossClass = enabled ? '' : 'c_Cross ';

      return ExplainingListItem({
            // Can be both _active_and_disabled — if was IsAnonOnlySelfCanDeanon, but
            // then an admin disabled the enableAnonSens feature. Then, the server
            // should [reject_anon_sensitive_posts].
            active,
            title: r.span({ className: crossClass + e2eClass }, title),
            text: anyExpl,
            disabled: !enabled,
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
