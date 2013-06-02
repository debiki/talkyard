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

(function() {

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


// Outline new posts
/*
(function(){
  var myLastVersion = $.cookie('myLastPageVersion'); // cookie no longer exists
  if (!myLastVersion) return;
  var newPosts = posts.filter(function(index){   B UG?…
    //… relied on posts = $('.debiki .dw-p-bd') but use '*.dw-p' instead?
    return $(this).dwLastChange() > myLastVersion;
  })
  newPosts.closest('.dw-t').addClass('dw-m-t-new');
  // sometimes .dw-m-p-edited instead of -new
})()
*/


/**
 * Highlights and outlines $tag, for a little while. If there're opaque
 * elems inside, you can list them in the `opt_backgroundSelector`
 * and then background highlighting is placed on them instead of on $tag.
 */
function highlightBriefly($tag, opt_backgroundSelector) {
  var duration = 7500;
  var $background = opt_backgroundSelector ?
      $tag.find(opt_backgroundSelector) : $tag;
  $background.effect('highlight',
      { easing: 'easeInExpo', color: 'yellow' }, duration);
  $tag.css('outline', 'solid thick #f0a005');
  // Remove the outline somewhat quickly (during 600 ms). Otherwise it looks
  // jerky: removing 1px at a time, slowly, is very noticeable!
  setTimeout(function() {
    $tag.animate({ outlineWidth: '0px' }, 600);
  }, Math.max(duration - 1500, 0));
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
  this.dwScrollIntoView(options).queue(function(next) {
    highlightBriefly($tag);
    next();
  });
  return this;
};


/**
 * Scrolls to and highlights `this`.
 */
$.fn.dwScrollToHighlighted = function(options) {
  return this.dwScrollToThenHighlight(this);
};


d.i.showAndHighlightPost = function($post, options) {
  $post.dwScrollIntoView(options).queue(function(next) {
    highlightBriefly($post, '.dw-p-bd, .dw-p-hd');
    next();
  });
};


d.i.scrollToUrlAnchorPost = function() {
  var $anchorPost = $(location.hash).filter('.dw-p');
  if (!$anchorPost.length) return;
  d.i.showAndHighlightPost($anchorPost, { marginRight: 200, marginBottom: 300 });
  $anchorPost.parent().addClass('dw-m-t-new');  // outlines it
};


})();

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
