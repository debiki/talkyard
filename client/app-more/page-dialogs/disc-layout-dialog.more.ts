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


let dialogSetState: (_: DiscLayoutDiagState) => Vo;

export function openDiscLayoutDiag(ps: DiscLayoutDiagState) {
  if (!dialogSetState) {
    ReactDOM.render(DiscLayoutDiag(), utils.makeMountNode());  // or [use_portal] ?
  }
  dialogSetState(ps);
}


/// Some dupl code? [6KUW24]  but this with React hooks.
///
const DiscLayoutDiag = React.createFactory<{}>(function() {
  //displayName: 'DiscLayoutDiag',

  const [diagState, setDiagState] =
        React.useState<DiscLayoutDiagState | N>(null);

  dialogSetState = setDiagState;

  const layout: DiscPropsSource | U = diagState && diagState.layout;
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
      const isDefault = itemComtOrder === PostSortOrder.Default;
      if (!isDefault) {
        active = itemComtOrder === layout.comtOrder;
        title = widgets.comtOrder_title(itemComtOrder);
      }
      else {   // [def_disc_layout_title]
        active = !layout.comtOrder;    // no: layout.comtNestingFrom === diagState.default.comtNestingFrom;
        title = rFr({},
                  "Default: ",
                  r.span({ className: 'c_CmtOrdIt_InhDef_Val' },
                    widgets.comtOrder_title(diagState.default.comtOrder)));
      }
      return ExplainingListItem({
            active, //layout.comtOrder === comtOrder || !layout.comtOrder && isDefault,
  //!layout.comtOrder && isDefault,
            title: r.span({ className: e2eClass  }, title),
            text: comtOrder_descr(itemComtOrder, diagState.default.comtOrderFrom),
            onSelect: () => {
              diagState.onSelect({ ...layout, comtOrder: itemComtOrder });
              close();
            } });
    }

    defaultItem = makeItem(PostSortOrder.Default, 'e_DefOrd');
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
              ? // Should be obvious that this is for everyone, since everything else
                // in the category edit dialog affects everyone.
                `Comments sort order, in this category:` // 0I18N, is for staff
              : (
                // But when changing sort order, on a specific page, then,
                // one button is for everyone — the Change... page button.
                // And another is for oneself only. Therefore, good with
                // different dialog titles:
                forEveryone ? `Change comments sort order for everyone:`
                              : `Temporarily sort comments by:`)),
        defaultItem,
        bestFirstItem,
        oldestFirstItem,
        newestFirstItem,
        newestThenBestItem,
        newestThenOldestItem));
});


function comtOrder_descr(comtOrder: PostSortOrder, inheritedFrom: Ref): St | RElm | N {
  // 0I18N here; this is for staff.
  switch (comtOrder) {
    case PostSortOrder.Default:
      let fromWhere = '';
      if (inheritedFrom.startsWith('pageid:')) fromWhere = ", for this page";
      if (inheritedFrom.startsWith('catid:')) fromWhere = ", inherited from a category";
      if (inheritedFrom.startsWith('sstg:')) fromWhere = ", inherited from the site settings";
      if (inheritedFrom.startsWith('BuiltIn')) fromWhere = '';
      // UX COULD write "Category [Cat Name]" instead of just `cat:1234`.
      return rFr({},
              `The default${fromWhere}. `, r.small({}, `(${inheritedFrom})`));

    case PostSortOrder.BestFirst:
      return "Comments many have liked, in comparison to how many have read them, " +
            "are shown first.";

    case PostSortOrder.NewestFirst:
      return "The most recently posted comments are shown first.";

    case PostSortOrder.NewestThenBest:
      return "\"Lightweight blog\". Replies to the Original Post are sorted by " +
          "newest-first, and replies to the replies by popular-first. This can be nice " +
          "if you post status updates as comments — the most recent update, " +
          "appears at the top, with replies sorted popular-first.";

    case PostSortOrder.NewestThenOldest:
      return "\"Threaded chat.\" Replies to the Original Post are sorted by newest-first, " +
          "and replies to the replies by oldest-first. This can work like " +
          // ("Top-level" is ok terminology — e.g. Facebook writes in their docs that
          // "You can only reply to top-level comments".)
          "a threaded chat, just that the top-level 'chat' messages are " +
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
