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

  // ----- Oooops! Dupl code. [derive_disc_props] -----------------

  // The dialog is either for a specific page, or a category (and all pages therein).
  dieIf(!!props.cat == !!props.page, 'TyE604MWJJ34');

  let layoutSource: DiscPropsSource;
  if (props.cat) {
    layoutSource = discProps_pluckFrom(props.cat);
  }
  else {
    layoutSource = discProps_pluckFrom(props.page);
    // Apply any current page temp layout tweaks (disappear on page reload).
    if (props.layoutFor === LayoutFor.PageWithTweaks && props.store.curPageTweaks) {
      const tempLayoutTweaks = discProps_pluckFrom(props.store.curPageTweaks);
      layoutSource = { ...layoutSource, ...tempLayoutTweaks };
    }
  }

  // If we're A) altering the page layout, e.g. the comments sort order,
  // but not saving server side, then:  layoutFor === PageWithTweaks,
  // and the default layout is the page *without* tweaks,
  // that is:  PageNoTweaks = PageWithTweaks + 1.
  //
  // And if we're B) saving server side, then:  layoutFor === PageNoTweaks,
  // and the defaults would be the parent category's layout props
  // that is,  LayoutFor.Ancestors = PageNoTweaks + 1.
  //
  // So, the "parent" layout is +1:
  //
  const layoutForParent = props.layoutFor + 1;

  const actualLayout: DiscPropsDerived = props.page
          ? page_deriveLayout(props.page, props.store, props.layoutFor)
          : cat_deriveLayout(props.cat, props.store, props.layoutFor);
  const parentsLayout: DiscPropsDerived = props.page
          ? page_deriveLayout(props.page, props.store, layoutForParent)
          : cat_deriveLayout(props.cat, props.store, layoutForParent);

  // ----- / End dupl code ----------------------------------------

  return (
      Button({ className: 'e_DscLayB', onClick: (event) => {
          const atRect = cloneEventTargetRect(event);
          openAnonsAllowedDiag({
              atRect,
              // This is what's being edited.
              layout: layoutSource,
              // This is the defaults, e.g. parent category settings, will get used
              // if layoutSource settings cleared (gets set to Inherit).
              default: parentsLayout,
              // These forSth just affect the dialog title.
              forCat: !!props.cat,
              forEveryone: props.forEveryone,
              onSelect: props.onSelect });
        }},
        neverAlways_title(actualLayout.comtsStartAnon), ' ', r.span({ className: 'caret' })));
            // +  Deanonymize after:
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
