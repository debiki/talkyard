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
/// <reference path="user-summary.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.todos {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;

// [dupl_comts_list_code]
const smallWindow = Math.min(window.outerWidth, window.outerHeight) < 500;
const windowWideEnoughForTabButtons = window.outerWidth > 1010;


interface ToDosProps {
  bookmarks: PostWithPageId[]
  bookmarkedPosts: PostWithPage[]
  drafts?: Draft[]  // later
  tasks?: Post[]    // assigned-to tasks, later
  curPostNr?: PostNr
  store: Store
  onPostClick: (post: Post) => V
  reorderThisBeforeThat: (draggingTodo: PostWithPageId, bm: PostWithPageId) => V
}


/// A todo item can be a bookmark or, later, a draft or task [bookmark_tasks]. 
/// Bookmarks often mean read-later or continue-reading-here — a kind of todo thing.
/// And drafts are todos (finish writing and post it).
///
/// (Some bookmarks are for referece only — that probably doesn't count as todos though.)
///
export const ToDos = React.createFactory<ToDosProps>(function(ps: ToDosProps) {
  // Dragging a todo will, later, change its order value — which will be the default
  // sort field. So, you can order & prioritize your todos / bookmarks.  [order_bokms]
  const [draggingTodo, setDraggingTodo] = React.useState<PostWithPageId | N>(null);

  const abbreviateHowMuch = smallWindow ? 'Much' : 'ABit';
  if (!ps.bookmarks.length)
    return r.p({}, "No bookmarks.");  // I18N

  // Temp store copy where we'll add pages with postsByNr, and insert
  // the bookmarked posts, and bookmarks so they'll be found when rendering
  // the bookmarked posts. [render_bookms]
  const pagesById: { [id: PageId]: Page } = {};

  // Add bookmarks & posts to `pagesById`.
  for (let post of [...ps.bookmarks, ...ps.bookmarkedPosts]) {
    let page: Page = pagesById[post.pageId];
    if (!page) {
      page = debiki2.makeAutoPage(post.pageId);
      pagesById[post.pageId] = page;
    }
    page.postsByNr[post.nr] = post;
  }

  const result: RElm[] = [];

  // [dupl_comts_list_code]
  for (let bm of ps.bookmarks) {
    const page: Page = pagesById[bm.pageId];

    // Safe: Not interpreting the source as html.
    const bmText = r.span({}, bm.unsafeSource);
    const bmElm = r.div({}, r.span({ className: 'dw-p-mark icon-bookmark' }), bmText);

    const anyPost: Post | U = page.postsByNr[bm.parentNr];
    const isOnCurrentPage = anyPost && anyPost.pageId === ps.store.currentPageId;

    let postElm: RElm;

    // The bookmarked post (parent post) might have been deleted, or moved to elsewhere
    // where we don't have access.  [private_orphans]
    if (!anyPost) {
      // 0Po = no (zero) post.
      postElm = r.div({ className: 'c_BmPo_0Po' },
          `${bm.parentNr === BodyNr ? "Post" : "comment"} gone`);  // I18N
    }
    else {
      const postProps: PostProps = {
        store: ps.store,
        post: anyPost,
        onClick: () => ps.onPostClick(anyPost),
        inTodoList: true, // so won't render bookmarks (we'll show bmElm instead)
        abbreviate: abbreviateHowMuch,
      };

      if (isOnCurrentPage && anyPost.nr === ps.curPostNr) {
        postProps.className = 'dw-current-post';
      }

      postElm = debiki2.page.Post(postProps);
    }

    const href: St | U = !anyPost ? undefined : linkToPost(anyPost as PostWithPageId);

    // c_BmPo = Bookmark (and) post (just below).
    const draggedClass = draggingTodo?.uniqueId === bm.uniqueId ? ' c_Dragging' : '';


    // Wrap the bookmark and bookmarked post in a <a href>, which when clicked SPA-navigates
    // to the bookmarked post. And you can right click to copy the link / open in new tab.
    //
    // Draging & reordering not yet finished.  [order_bokms]
    //
    const bmAndPostLink = LinkUnstyled({ key: bm.uniqueId, href,
            className: 'c_BmPo' + draggedClass,

            draggable: true,

            onDragStart: (event: DragEvent) => {
              // Without setData(), onDrop() is never called, at least not in my Chrome.
              // Maybe safer to not include the bookmark text in dataTransfer? People
              // might expect only the link to be included, and unexpectedly darg-dropping
              // some private note somewhere?
              // Skip?: event.dataTransfer.setData('text/plain',
              //          `Bookmark text: ${bm.unsafeSource}\nBookmark link: ${href}`);
              // But this makes sense:
              event.dataTransfer.setData('text/uri-list', href);
              // What Talkyard uses: (actually doesn't need — the `draggingTodo` state is enough)
              event.dataTransfer.setData('talkyard/nodeid', '' + bm.uniqueId);
              event.dataTransfer.dropEffect = 'move';
              console.debug(`onDragStart todo id ${bm.uniqueId}`);
              setDraggingTodo(bm);
            },

            onDragOver: (event: DragEvent) => {
              event.preventDefault();
              console.debug(`onDragOver bm ${bm.uniqueId}`);
            },

            onDrop: (event: DragEvent) => {
              // Default behavior is e.g. open-as-link on drop
              // (says https://www.w3schools.com/html/html5_draganddrop.asp).
              event.preventDefault();
              const todoIdStr: St = event.dataTransfer.getData('talkyard/nodeid');
              console.debug(`onDrop: todo id ${todoIdStr} on ${bm.uniqueId}`);
              ps.reorderThisBeforeThat(draggingTodo, bm);
            },

            onDragEnd: () => {
              setDraggingTodo(null);
            }},
        bmElm,
        postElm);

    result.push(bmAndPostLink);
  }

  return rFr({}, result);
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
