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
/// //eference path="../more-bundle-already-loaded.d.ts" />
/// <reference path="./anons-allowed-diag.more.ts" />


// Buttons that open lazy loaded dialogs.
//
//------------------------------------------------------------------------------
   namespace debiki2.pagedialogs {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;



export const AnonsAllowedDropdownBtn = React.createFactory<DiscLayoutDropdownBtnProps>(
        function(props: DiscLayoutDropdownBtnProps) {

  const derived: NodePropsDerivedAndDefault = node_deriveLayout(props);

  // Bit dupl code. [node_props_btn]
  return (
      Button({ className: 'e_ComtAnoB', onClick: (event) => {
          const atRect = cloneEventTargetRect(event);
          openAnonsAllowedDiag({
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
        neverAlways_title(derived.actualLayout.comtsStartAnon),
            ' ', r.span({ className: 'caret' })));
        // + Deanonymize after:
            //    N mins / N hours / N days / N weeks /
            //       first NNN-day N weeks later /
            //       first NNN-day N months later / Never
});



// Move to where?
export function neverAlways_title(neverAlways: NeverAlways): St {
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



//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
