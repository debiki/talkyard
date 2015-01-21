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


var anyCurrentlyHighlighted = null;
var anyCurrentlyHighlightedTimeout = null;
//var anyCurrentlyHighlightedBackground = null;

/**
 * Highlights and outlines $tag, for a little while. If there're opaque
 * elems inside, you can list them in the `opt_backgroundSelector`
 * and then background highlighting is placed on them instead of on $tag.
 */
function highlightBriefly($tag, opt_backgroundSelector) {
  // Stop any old animation, doesn't look well with many highlightings.
  if (anyCurrentlyHighlighted) {
    anyCurrentlyHighlighted.css('outline', '');
    anyCurrentlyHighlighted.stop(true, true);
    anyCurrentlyHighlighted = null;
  }
  /*
  if (anyCurrentlyHighlightedBackground) {
    anyCurrentlyHighlightedBackground.stop(true, true);
    anyCurrentlyHighlightedBackground = null;
  } */
  if (anyCurrentlyHighlightedTimeout) {
    clearTimeout(anyCurrentlyHighlightedTimeout);
    anyCurrentlyHighlightedTimeout = null;
  }

  var duration = 2147483647; // 7500;  -- highlight forever instead
  /*
  var $background = opt_backgroundSelector ?
      $tag.find(opt_backgroundSelector) : $tag;
  $background.effect('highlight',
      { easing: 'easeInExpo', color: 'yellow' }, duration);
  anyCurrentlyHighlightedBackground = $background;
      */

  $tag.css('outline', 'hsl(211, 100%, 77%) solid 7px'); // duplicated style [FK209EIZ]
  anyCurrentlyHighlighted = $tag;
  // Remove the outline somewhat quickly (during 600 ms). Otherwise it looks
  // jerky: removing 1px at a time, slowly, is very noticeable!
  anyCurrentlyHighlightedTimeout = setTimeout(function() {
    $tag.animate({ outlineWidth: '0px' }, 600);
  }, Math.max(duration, 0));

  /// This won't work, jQuery plugin doesn't support rgba animation:
  //$post.animate(
  //    { outlineColor: 'rgba(255, 0, 0, .5)' }, duration, 'easeInExpo');
  /// There's a rgba color support plugin though:
  /// http://pioupioum.fr/sandbox/jquery-color/
};


/**
 * Scrolls to `this`, then highlights `$tag`.
 */
$.fn.dwScrollToThenHighlight = function($tag, options) {
  options = addAnySidebarWidth(options);
  this.dwScrollIntoView(options).queue(function(next) {
    highlightBriefly($tag);
    next();
  });
  return this;
};


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


/**
 * Scrolls to and highlights `this`.
 */
$.fn.dwScrollToHighlighted = function(options) {
  return this.dwScrollToThenHighlight(this);
};


d.i.showAndHighlightPost = function($post, options) {
  options = addAnySidebarWidth(options);
  // Add space for position-fixed stuff at the top: Forw/Back btns and open-sidebar btn.
  options.marginTop = options.marginTop || 60;
  $post.dwScrollIntoView(options).queue(function(next) {
    highlightBriefly($post, '.dw-p-bd, .dw-p-hd');
    next();
  });
};


d.i.ensureAnyAnchorPostLoaded = function(callback) {
  var anchorPostId = anyAnchorPostId();
  if (!anchorPostId)
    return;
  var $post = d.i.findPost$(anchorPostId);
  if (!$post.length) {
    d.i.loadAndInsertThreadAndTree(anchorPostId, callback);
  }
  else {
    callback();
  }
}


d.i.scrollToUrlAnchorPost = function() {
  var anchorPostId = anyAnchorPostId();
  if (!anchorPostId)
    return;
  var $anchorPost = $('#post-' + anchorPostId).filter('.dw-p');
  if (!$anchorPost.length) return;
  d.i.showAndHighlightPost($anchorPost, { marginRight: 200, marginBottom: 300 });
  $anchorPost.parent().addClass('dw-m-t-new');  // outlines it
};


function anyAnchorPostId() {
  // AngularJS (I think it is) somehow inserts a '/' at the start of the hash. I'd
  // guess it's Angular's router that messes with the hash. I don't want the '/' but
  // don't know how to get rid of it, so simply ignore it.
  var hashIsPostId = /#post-\d+/.test(location.hash);
  var hashIsSlashPostId = /#\/post-\d+/.test(location.hash);
  if (hashIsPostId) return location.hash.substr(6, 999)
  if (hashIsSlashPostId) return location.hash.substr(7, 999)
  return undefined;
}


// When hovering a in-reply-to link, outline the post that was replied to.
// Use a dedicated CSS class so we won't accidentally remove any outline added
// because of other reasons, when removing this outline.
$(document).on('hover', '.dw-rr', function(event) {  // dw-rr = reply receiver
  var referencedPost = getPostMultirepliedTo(this);
  if (event.type === 'mouseenter') {
    referencedPost.addClass('dw-highlighted-multireply-hover');
  }
  else {
    referencedPost.removeClass('dw-highlighted-multireply-hover');
  }
});


// When clicking a in-reply-to link, scroll the post that was replied to into view.
$(document).on('click', '.dw-rr', function(event) {  // dw-rr = reply receiver
  var referencedPost = getPostMultirepliedTo(this);
  d.i.showAndHighlightPost(referencedPost);
  var currentPostId = $(this).closest('.dw-t').dwPostId();
  var nextPostId = referencedPost.dwPostId();
  debiki2.postnavigation.addVisitedPosts(currentPostId, nextPostId);
  return false; // prevent browser's default action (jump-place post in upper left corner)
});


function getPostMultirepliedTo(elem) {
  var multireplyPostLink = $(elem).attr('href');
  return $(multireplyPostLink);
}


$(document).on('hover', '.dw-arw-vt-handle', function(event) {
  var allArrowHandles = $(this).closest('.dw-res').find('> .dw-t > .dw-arw-vt-handle');
  var parentPost = $(this).closest('.dw-res').closest('.dw-t').children('.dw-p');
  if (event.type === 'mouseenter' || event.type === 'mouseover') {
    if (!d.i.elemIsVisible(parentPost)) {
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


var arrowHandleMousedownCoords = null;

$(document).on('mousedown', '.dw-arw-vt-handle', function(event) {
  arrowHandleMousedownCoords = {
    clientX: event.clientX,
    clientY: event.clientY
  };
});

// Scroll to parent post when clicking arrow.
$(document).on('click', '.dw-arw-vt-handle', function(event) {
  if (arrowHandleMousedownCoords) {
    var dragDistanceX = event.clientX - arrowHandleMousedownCoords.clientX;
    var dragDistanceY = event.clientY - arrowHandleMousedownCoords.clientY;
    var dragDistance2 = dragDistanceX * dragDistanceX + dragDistanceY * dragDistanceY;
    if (dragDistance2 > 15) {
      // This is click-and-drag, probably Utterscrolling, not a pure click.
      return;
    }
  }
  var parentPost = $(this).closest('.dw-t').parent().closest('.dw-t').children('.dw-p');
  var parentPostId = parentPost.dwPostId();
  if (!d.i.elemIsVisible(parentPost)) {
    debiki2.postnavigation.addVisitedPositionAndPost(parentPostId);
    d.i.showAndHighlightPost(parentPost);
  }
});


// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list
