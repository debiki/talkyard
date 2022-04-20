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

/// <reference path="../more-bundle-not-yet-loaded.ts" />
// xx <reference path="../utils/react-utils.ts" />


// Buttons that open lazy loaded dialogs.
//
//------------------------------------------------------------------------------
   namespace debiki2.widgets {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;



export const DiscLayoutDropdownBtn = React.createFactory<DiscLayoutDropdownBtnProps>(
        function(props: DiscLayoutDropdownBtnProps) {

  let layoutSource;
  if (!props.page) {
    dieIf(!props.cat, 'TyE604MWJJ34');
    layoutSource = discProps_pluckFrom(props.cat);
  }
  else {
    layoutSource = discProps_pluckFrom(props.page);
    if (props.layoutFor === LayoutFor.PageWithTweaks && props.store.curPageTweaks) {
      const tempLayoutTweaks = discProps_pluckFrom(props.store.curPageTweaks);
      layoutSource = { ...layoutSource, ...tempLayoutTweaks };
    }
  }

  // If we're A) altering the page layout, e.g. the comments sort order,
  // but not saving server side, then,
  // layoutFor === PageWithTweaks, and the default layout would be the page *without*
  // tweaks, that is,  PageNoTweaks = PageWithTweaks + 1.
  // And if we're B) saving server side, then,
  // layoutFor === PageNoTweaks, and the defaults would be the category layout props
  // (if the page didn't have its own), that is,  LayoutFor.Ancestors = PageNoTweaks + 1.
  // So, the "parent" layout is +1:
  const layoutForParent = props.layoutFor + 1;

  /*
  const _thisLayoutProps = discProps_pluckFrom(props.page || props.cat);
  // Harmless UX BUG: page tweaks not included. Could merge from props.store.curPageTweaks,
  // but only if layoutFor === LayoutFor.PageWithTweaks, right. */

  const actualLayout: DiscPropsDerived = props.page
          ? page_deriveLayout(props.page, props.store, props.layoutFor)
          : cat_deriveLayout(props.cat, props.store, props.layoutFor);
  const parentsLayout: DiscPropsDerived = props.page
          ? page_deriveLayout(props.page, props.store, layoutForParent)
          : cat_deriveLayout(props.cat, props.store, layoutForParent);

  return (
      Button({ className: 'esTopicType_dropdown', onClick: (event) => {
          const atRect = cloneEventTargetRect(event);
          morebundle.openDiscLayoutDiag({
              atRect, layout: layoutSource,
              default: parentsLayout,
              forCat: props.forCat, forEveryone: props.forEveryone, onSelect: props.onSelect });
        }},
        comtOrder_title(actualLayout.comtOrder), ' ', r.span({ className: 'caret' })));
});



export function comtOrder_title(comtOrder: PostSortOrder): St {
  switch (comtOrder) {
    //case PostSortOrder.Default:
    //  Not supposed to happen. Instead the DiscLayoutDiag constructs a list item
    //  for the admins. [def_disc_layout_title]
    case PostSortOrder.OldestFirst: return "Oldest first";  // I18N here and below
    case PostSortOrder.NewestFirst: return "Newest first";
    case PostSortOrder.BestFirst: return "Popular first";
    case PostSortOrder.NewestThenBest: return "Newest then Popular";
    case PostSortOrder.NewestThenOldest: return "Newest then Oldest";
  }
  return `Bad: ${comtOrder} TyECMTORDR`;
}



//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
