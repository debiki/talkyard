/* Scrolls into view and highlights comments.
 * Copyright (C) 2010-2012, 2017 Kaj Magnus Lindberg
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

/// <reference path="scroll-into-view.ts" />

//------------------------------------------------------------------------------
   namespace debiki2 {
//------------------------------------------------------------------------------

// CLEAN_UP merge-rename with scroll-into-view.ts to scroll-and-show.ts?

/**
 * There might be a position: fixed sidebar to the right. This hacky
 * function ensures the sidebar won't hide the elem we scroll to,
 * by adding some options.marginRight.
 * Find the sidebar in client/app/sidebar/sidebar.ts.
 */
function addAnySidebarWidth(options: ShowPostOpts) {
  options = options || {};
  var sidebar = debiki2.$byId('dw-sidebar');
  if (!sidebar || !sidebar.querySelector('.dw-comments')) {
    // Sidebar is closed.
    return options;
  }
  var marginRight = options.marginRight || 15;
  marginRight += sidebar.offsetWidth;
  options.marginRight = marginRight;
  return options;
}



// Scrolls posts[0], and lots of space below, into view,
// and flashes all posts and successors.
// Nice, if lazy-loading more posts, on a large page.
//
export function scrollAndFlashPosts(page: Page, posts: Post[]) {
  if (!posts.length)
    return;

  // Flash posts[0] and the 9 posts just below — that should be enough,
  // for highlighting all posts visible on the screen.
  // (COULD look at their bounding boxes, and pick all on screen, + 1 or 2 more.)
  const nrsToFlash = [];
  page_depthFirstWalk(page, posts, 10, (p: Post) => nrsToFlash.push(p.nr));

  const postElem = $byId('post-' + posts[0].nr);
  if (!postElem) {
    // It's gone? A race? Not so interesting.
    return;
  }

  // If the user did a "big change" so that now we're scroll-flashing many posts,
  // then, can be not-so-easy for hen to see what's happening.
  // So, if many posts, do things slower. However, being slow, when we're
  // flashing just one post, is boring.
  const duration = nrsToFlash.length <= 1
      ? undefined // use the default, which is okay fast
      : (nrsToFlash.length <= 3 ? 900 : 1100);

  utils.scrollIntoView(postElem, {
    duration,
    marginTop: 200,
    marginBottom: nrsToFlash.length <= 1
        ? 200   // no more posts below to show-and-flash
        : 1200, // more posts below, who knows how much space they take
    onDone: function() {
      _.each(nrsToFlash, flashPostNrIfThere);
    },
  });
}


export function scrollAndFlashPostNr(postNr: PostNr, options: ShowPostOpts) {
  const postElem = $byId('post-' + postNr);
  if (!postElem) {
    // Opened new page, Reactjs component unmounted, post elem gone?
    return;
  }
  options = addAnySidebarWidth(options);
  // Add space for position-fixed stuff at the top: Forw/Back btns and open-sidebar btn.
  options.marginTop = options.marginTop || 60;
  options.marginBottom = options.marginBottom || 300;
  utils.scrollIntoView(postElem, options, function() {
    flashPostElem(postElem);
  });
};


export function flashPostNrIfThere(nr: PostNr) {
  const elem = $byId('post-' + nr);
  if (!elem)
    return;
  if ($h.hasClass(elem, 's_P-Prvw-NotEd')) {
    // It's a draft preview, not a real post. Also find and highlight the draft
    // header, e.g. "Preview, your edits:".
    const draftHeader = $first('.s_T_YourPrvw', elem.parentElement);
    flashPostImpl(draftHeader, elem);
  }
  else {
    // It's a real post.
    flashPostElem(elem);
  }
}


export function flashPostElem(postElem: Element) {
  const head = postElem.querySelector('.dw-p-hd');
  const body = postElem.querySelector('.dw-p-bd');
  flashPostImpl(head, body);
}


const highlightOffHandles = new Map();

function flashPostImpl(head: Element | undefined, body: Element) {
  if (!head && !body) {
    // Opened new page, Reactjs component unmounted, post elem gone?
    // @ifdef DEBUG
    die('TyE306WKUDR2');
    // @endif
    return;
  }
  else if (!head) {
    // Fyi: This happens when 1) flashing an in-page edits preview of an
    // Orig Post — then, the post header is instead just below the page title,
    // see CSS class 'dw-ar-p-hd'.
    // And 2) happens on mind map pages — then, there're no post headers (except
    // for the orig post).  But mind maps [2D_LAYOUT] currently disabled (2020-08).
  }
  else if (!body) {
    // Fyi: If post deleted, there's no body — only a post header that
    // says sth like "Post deleted".
  }

  const highlightOnClass = 's_Fx-Flash';
  const highlightOffClass = 's_Fx-Flash-End';
  const allClasses = highlightOnClass + ' ' + highlightOffClass;
  const $h = debiki2.$h;

  const durationSeconds = 4; // dupl constant, also in css [2DKQ7AM]
                             // doesn't work: parseFloat(head.style.transitionDuration);  (it's "")

  // Remove the fade-out class, otherwise cannot highlight again until the
  // flade-out animation has ended.
  if (head) {
    $h.removeClasses(head, allClasses);
    $h.addClasses(head, highlightOnClass);
  }
  if (body) {
    $h.removeClasses(body, allClasses);
    $h.addClasses(body, highlightOnClass);
  }

  // Simplified flash, if no body.
  if (!body) {
    setTimeout(function() {
      $h.removeClasses(head, allClasses);
    }, durationSeconds * 1000);
    return;
  }

  const oldHighlOffHandle = highlightOffHandles.get(body);
  if (oldHighlOffHandle) {
    clearTimeout(oldHighlOffHandle);
    highlightOffHandles.delete(body);
  }

  setTimeout(function() {
    if (head) $h.addClasses(head, highlightOffClass);
    $h.addClasses(body, highlightOffClass);
    // At least Chrome returns 'Xs', e.g. '1.5s', regardles of the units in the CSS file.
    const highlOffHandle = setTimeout(function() {
      highlightOffHandles.delete(body);
      if (head) $h.removeClasses(head, allClasses);
      $h.removeClasses(body, allClasses);
    }, durationSeconds * 1000);

    highlightOffHandles.set(body, highlOffHandle);
  }, 700);
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list
