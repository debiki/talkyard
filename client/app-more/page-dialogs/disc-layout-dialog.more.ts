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
   namespace debiki2.pagedialogs {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const DropdownModal = utils.DropdownModal;
const ExplainingListItem = util.ExplainingListItem;


let setDiagStateFromOutside: (_: DiscLayoutDiagState) => Vo;

export function openDiscLayoutDiag(ps: DiscLayoutDiagState) {
  if (!setDiagStateFromOutside) {
    ReactDOM.render(DiscLayoutDiag(), utils.makeMountNode());  // or [use_portal] ?
  }
  setDiagStateFromOutside(ps);
}


/// Some dupl code? [6KUW24]  but this with React hooks.
///
const DiscLayoutDiag = React.createFactory<{}>(function() {
  //displayName: 'DiscLayoutDiag',

  // Dupl code [node_props_diag], similar to  ./anons-allowed-diag.more.ts .

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
  let forEveryone: Bo | U;
  let defaultItem: RElm | U;
  let bestFirstItem: RElm | U;
  let oldestFirstItem: RElm | U;
  let newestFirstItem: RElm | U;
  let newestThenBestItem: RElm | U;
  let newestThenOldestItem: RElm | U;

  if (isOpen) {
    forCat = diagState.forCat;
    forEveryone = diagState.forEveryone;

    const makeItem = (itemComtOrder: PostSortOrder, e2eClass: St): RElm => {
      let active: Bo;
      let title: St | RElm;
      const isInherit = itemComtOrder === PostSortOrder.Inherit;
      if (!isInherit) {
        active = itemComtOrder === layout.comtOrder;
        title = widgets.comtOrder_title(itemComtOrder);
      }
      else {   // [def_disc_layout_title]
        // Inheriting is the default, so unlss we've choosen sth else, this
        // item is the active one.
        active = !layout.comtOrder;
        title = rFr({},
                  "Default: ",
                  r.span({ className: 'c_CmtOrdIt_InhDef_Val' },
                    widgets.comtOrder_title(diagState.default.comtOrder)));
      }
      return ExplainingListItem({
            active,
            title: r.span({ className: e2eClass  }, title),
            text: comtOrder_descr(itemComtOrder, diagState.default.from.comtOrder),
            onSelect: () => {
              if (active) {
                // Noop. Already using this comment sort order.
              }
              else {
                diagState.onSelect({ ...layout, comtOrder: itemComtOrder });
              }
              close();
            } });
    }

    defaultItem = makeItem(PostSortOrder.Inherit, 'e_DefOrd');
    bestFirstItem = makeItem(PostSortOrder.BestFirst, 'e_Best1st');
    oldestFirstItem = makeItem(PostSortOrder.OldestFirst, 'e_Old1st');
    newestFirstItem = makeItem(PostSortOrder.NewestFirst, 'e_New1st');
    newestThenBestItem = makeItem(PostSortOrder.NewestThenBest, 'e_NewThenBest1st');
    newestThenOldestItem = makeItem(PostSortOrder.NewestThenOldest, 'e_NewThenOld1st');
  }

  return (
      DropdownModal({ show: isOpen, onHide: close, atX: atRect.left, atY: atRect.top,
            pullLeft: true, showCloseButton: true, dialogClassName2: 'e_CmtOrdD' },
        r.div({ className: 's_ExplDrp_Ttl' },
          forCat
              ? // Need not mention that this is for everyone — everything in
                // the category edit dialog affects everyone.
                rFr({}, `Comments sort order, in this category: `, // 0I18N, is for staff
                  r.small({ style: { marginLeft: '1ex' }},
                    `(and subcategories)`))
              : (
                // But when changing sort order, on a specific page, then,
                // one button is for everyone — the [Change...] page button.
                // And another is for oneself only — the metabar button. Therefore,
                // good with different dialog titles:
                forEveryone ? `Change comments sort order for everyone:`
                              : `Temporarily sort comments by:`)),
        defaultItem,
        bestFirstItem,
        oldestFirstItem,
        newestFirstItem,
        newestThenBestItem,
        newestThenOldestItem));
});


function comtOrder_descr(comtOrder: PostSortOrder, inheritedFrom: Ref | Cat): St | RElm | N {
  // 0I18N here; this is for staff.
  switch (comtOrder) {
    case PostSortOrder.Inherit:
      return utils.showDefaultFrom(inheritedFrom);

    case PostSortOrder.BestFirst:
      return "Comments many have liked, in comparison to how many have read them, " +
            "are shown first.";

    case PostSortOrder.NewestFirst:
      return "The most recently posted comments are shown first.";

    case PostSortOrder.NewestThenBest:
      return "\"Lightweight blog\". Replies to the Original Post are sorted by " +
          "newest-first, and replies to the replies by popular-first. This can be nice " +
          "if you post status updates as comments — the most recent update, " +
          "appears at the top, with replies sorted popular-first, directly below.";

    case PostSortOrder.NewestThenOldest:
      return "\"Threaded chat.\" Replies to the Original Post are sorted by newest-first, " +
          "and replies to the replies by oldest-first. This can work like " +
          // ("Top-level" is ok terminology — e.g. Facebook writes in their docs that
          // "You can only reply to top-level comments".)
          "a threaded chat, just that the top-level \"chat\" messages are " +
          "sorted most-recent-first, so you scroll down to see older " +
          "top-level chat messages.";

    default:
      return null;
  }
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
