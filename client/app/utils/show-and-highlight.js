/* Scrolls into view and highlights comments.
 * Copyright (C) 2010-2012 Kaj Magnus Lindberg (born 1979)
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

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


/**
 * There might be a position: fixed sidebar to the right. This hacky
 * function ensures the sidebar won't hide the elem we scroll to,
 * by adding some options.marginRight.
 * Find the sidebar in client/app/sidebar/sidebar.ts.
 */
function addAnySidebarWidth(options) {
  var sidebar = $('#dw-sidebar');
  if (!sidebar.find('.dw-comments').length) {
    // Sidebar is closed.
    return options || {};
  }

  options = options || {};
  var marginRight = options.marginRight || 15;
  marginRight += sidebar.outerWidth(true);
  options.marginRight = marginRight;
  return options;
}


debiki.internal.showAndHighlightPost = function(postElem, options) {
  var $post = $(postElem);
  options = addAnySidebarWidth(options);
  // Add space for position-fixed stuff at the top: Forw/Back btns and open-sidebar btn.
  options.marginTop = options.marginTop || 60;
  options.marginBottom = options.marginBottom || 300;
  d.i.scrollIntoView(postElem, options, function() {
    highlightPostBriefly($post);
  });
};


function highlightPostBriefly($post) {
  var $headBody = $post.children('.dw-p-hd, .dw-p-bd');
  $headBody.addClass('dw-highlight-on');
  setTimeout(function() {
    $headBody.addClass('dw-highlight-off');
    // At least Chrome returns 'Xs', e.g. '1.5s', regardles of the units in the CSS file.
    var durationSeconds = parseFloat($headBody.css('transition-duration'));
    setTimeout(function() {
      $headBody.removeClass('dw-highlight-on dw-highlight-off');
    }, durationSeconds * 1000);
  }, 500);
}


// When hovering a in-reply-to ("rr" = reply receiver) or solved-by link, outline
// the linked post. Use a dedicated CSS class so we won't accidentally remove
// any outline added because of other reasons, when removing this outline.
$(document).on('mouseenter mouseleave', '.dw-rr, .dw-solved-by', function(event) {
  var referencedPost = getLinkedPost(this);
  if (event.type === 'mouseenter') {
    debiki2.$h.addClasses(referencedPost, 'dw-highlighted-multireply-hover');
  }
  else {
    debiki2.$h.removeClasses(referencedPost, 'dw-highlighted-multireply-hover');
  }
});


function getLinkedPost(elem) {
  var multireplyPostLink = elem.getAttribute('href');
  return debiki2.$first(multireplyPostLink);
}


// Highlight an arrow on hover, if the parent post is not visible, because then
// clicking the arrow scrolls the parent into view. (Otherwise don't highlight
// though, because that'd be annoying.)
$(document).on('mouseenter mouseleave', '.dw-arw-vt-handle', function(event) {
  var allArrowHandles = $(this).closest('.dw-res').find('> .dw-t > .dw-arw-vt-handle');
  var parentPost = $(this).closest('.dw-res').closest('.dw-t').children('.dw-p');
  if (event.type === 'mouseenter' || event.type === 'mouseover') {
    if (!d.i.elemIsVisible(parentPost[0])) {
      allArrowHandles.addClass('dw-highlight');
      allArrowHandles.css('cursor', 'pointer');
    }
    else {
      allArrowHandles.css('cursor', 'default');
    }
  }
  else {
    allArrowHandles.removeClass('dw-highlight');
  }
});


// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list
