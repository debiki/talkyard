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


// Buttons that open lazy loaded dialogs.
//
//------------------------------------------------------------------------------
   namespace debiki2.widgets {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;



export function openAssignToDiag(post: Post, store: Store, onOk?: () => Vo) {
  const curPats = post.assigneeIds?.map(id => store.usersByIdBrief[id]);
  morebundle.openAddPeopleDialog({ curPats, onChanges: (res: PatsToAddRemove) => {
    Server.changeAssignees({ ...res, postId: post.uniqueId }, onOk);
  }})
}



export const DiscLayoutDropdownBtn = React.createFactory<DiscLayoutDropdownBtnProps>(
        function(props: DiscLayoutDropdownBtnProps) {

  const derived: NodePropsDerivedAndDefault = node_deriveLayout(props);

  // Bit dupl code. [node_props_btn]
  return (
      Button({ className: 'e_DscLayB', onClick: (event) => {
          const atRect = cloneEventTargetRect(event);
          morebundle.openDiscLayoutDiag({
              atRect,
              // This is what's being edited.
              layout: derived.layoutSource,
              // This is the defaults, e.g. parent category settings, will get used
              // if layoutSource settings cleared (gets set to Inherit).
              default: derived.parentsLayout,
              // These forSth just affect the dialog title.
              forCat: !!props.cat,
              forEveryone: props.forEveryone,
              onSelect: props.onSelect });
        }},
        comtOrder_title(derived.actualLayout.comtOrder),
            ' ', r.span({ className: 'caret' })));
});



export function comtOrder_title(comtOrder: PostSortOrder): St {
  switch (comtOrder) {
    // case PostSortOrder.Inherit:
    //  Not supposed to happen. Instead the DiscLayoutDiag constructs a list item
    //  for the admins. [def_disc_layout_title]
    //  Using `default:` case, below.
    case PostSortOrder.OldestFirst: return "Oldest first";  // I18N here and below
    case PostSortOrder.NewestFirst: return "Newest first";
    case PostSortOrder.BestFirst: return "Popular first";
    case PostSortOrder.NewestThenBest: return "Newest then Popular";
    case PostSortOrder.NewestThenOldest: return "Newest then Oldest";
    default:
      return `Bad: ${comtOrder} TyECMTORDR`;
  }
}



//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
