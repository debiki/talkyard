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
/// <reference path="../morekit/proxy-diag.more.ts" />


//------------------------------------------------------------------------------
   namespace debiki2.tags {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const ModalHeader = rb.ModalHeader;
const ModalTitle = rb.ModalTitle;
const ModalBody = rb.ModalBody;
const ModalFooter = rb.ModalFooter;


interface BookmarkDiag {
  me: Me,
  post: Post
  bookmarks?: Post[]
  page: Page,
}


export function openBookmarkDropdown(atRect: Rect, ps: BookmarkDiag) {
  morekit.openProxyDiag({ atRect, flavor: DiagFlavor.Dropdown, dialogClassName: 'c_BokmDrpdD' },
      closeDiag => BookmOrTaskDiag({ ...ps, closeDiag }));
}



interface Props extends BookmarkDiag {
  closeDiag: () => V
}


const BookmOrTaskDiag = React.createFactory<Props>(function(ps: Props) {  // I18N bookmark dlg
  // Currently, can be only one not-deleted bookmark per post and person, this unique db ix:
  // posts_u_patid_pageid_parentnr_if_bookmark_0deld. 
  const anyCurBookm: Post | U = ps.bookmarks?.[0];

  // We use the source text, no CommonMark —> html formatting. [dont_format_bookmarks]
  const anyCurDescr: St | U = anyCurBookm?.unsafeSource;

  const [descr, setDescr] = React.useState<St>(anyCurDescr || page_unsafeTitle(ps.page) || '');

  // Maybe later: [bookmark_tasks]
  //const [isTask, setIsTask] = React.useState<Bo>(false);

  function saveBookmark() {
    // Create or update a bookmark. [save_edit_bookmark]
    if (!anyCurBookm) {
      // RENAME to createPost instead? Not a reply.
      ReactActions.saveReply(ps.page.pageId, [ps.post.nr], descr, PostType.Bookmark,
              undefined /*draftToDelete*/, undefined /*doAsAnon*/, () => {
        ps.closeDiag();
      });
    }
    else {
      Server.saveEdits(ps.page.pageId, anyCurBookm.nr, descr,
              undefined /*deleteDraftNr*/, false /*doAsAnon*/, () => {
        // The post gets updated in the store by saveEdits().
        ps.closeDiag();
      });
    }
  }

  function deleteBookmark() {
    ReactActions.deletePost(anyCurBookm.nr, false /* repliesToo */, false /*doAsAnon*/, () => {
      ps.closeDiag();
    });
  }

  return rFr({},
      ModalHeader({}, ModalTitle({}, anyCurBookm ? "Edit bookmark" : "Add bookmark")),
      ModalBody({},
        Input({ type: 'textarea', label: "Notes:", className: 'e_BkmDsc', value: descr,
            onChange: (event) => setDescr(event.target.value) })
        ),

      ModalFooter({},
        descr === anyCurDescr ? null :
        PrimaryButton({ onClick: saveBookmark, }, t.Save),

        !anyCurBookm ? null :  // Maybe a [red_delete_btn]?
        Button({ onClick: deleteBookmark, className: 'btn-delete icon-trash' }, t.Delete),

        Button({ onClick: ps.closeDiag }, t.Cancel),
        ));
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------

