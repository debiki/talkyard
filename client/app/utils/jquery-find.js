/* jQuery utilities related to finding stuff, e.g. the current comment id.
 * Copyright (C) 2010 - 2013 Kaj Magnus Lindberg (born 1979)
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



d.i.findPost$ = function(postId) {
  return $('#post-'+ postId);
}


// Depreacted, use dwPostId() instead.
$.fn.dwPostIdStr = function() {
  var $post = this.is('.dw-t') ? this.children('.dw-p') : this;
  // Drop initial "post-".
  return $post.dwCheckIs('.dw-p').attr('id').substr(5, 999);
};


$.fn.dwPostId = function() {
  return parseInt(this.dwPostIdStr());
};


$.fn.dwAuthorId = function() {
  return this.find('.dw-p-by').data('dw-u-id');
};


/**
 * Returns info on the page in which $(whatever) is located.
 * (There might be more than one Debiki page included on a single browser page.)
 */
$.fn.dwPageMeta = function() {
  var $page = this.closest('.dw-page[id^=page]');

  // If this is e.g. the search results page, then there's no page meta,
  // so leave all fields undefined.
  if (!$page.length)
    return {};

  return {
    pageId: $page.attr('id').substr(5, 999), // drops initial "page-"
    pagePath: $page.data('page_path'),
    pageRole: $page.data('page_role'),
    pageStatus: $page.data('page_status'),
    // Re `attr(..)`: this ensures the id is not parsed as a number (in case there
    // happens to be no chars in the id) because if it is, then there'll
    // be lots of trouble in the future, for example, the id might be posted as a
    // JSON integer back to the server, which would complain.
    // This doesn't work: '' + $page.data(..) — it would drop any leading '0'.
    parentPageId: $page.attr('data-parent_page_id'),
    pageExists: $page.data('page_exists')
  };
};


$.fn.dwLastChange = function() {
  var maxDate = '0';
  this.dwCheckIs('.dw-p')
      .children('.dw-p-hd').find('.dw-date').each(function(){
    var date = $(this).attr('title'); // creation or last modification date
    if (date > maxDate)
      maxDate = date;
  });
  return maxDate;
};


/**
 * The user id of the author of a post, or '' if the post is a dummy post,
 * wich has no author.
 */
$.fn.dwAuthorId = function() {
  var uid = this.dwCheckIs('.dw-p')
      .find('> .dw-p-hd > .dw-p-by').attr('data-dw-u-id');
  // Sometimes there is no author. Then return ''.
  // (The server creates e.g. a dummy title "Unnamed page (click to edit)"
  // if the page has no title. But there's no author of that text.)
  uid = uid || '';
  return uid;
};


$.fn.dwIsArticlePost = function() {
  return this.dwCheckIs('.dw-p').is('.dw-ar-p');
};


})();

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
