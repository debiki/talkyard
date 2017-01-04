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



d.i.findPost$ = function(postNr) {
  return $('#post-'+ postNr);
}


// Depreacted, use dwPostId() instead.
$.fn.dwPostIdStr = function() {   // rename to dwPostNrStr   and try to remove
  var $post = this.is('.dw-t') ? this.children('.dw-p') : this;
  // Drop initial "post-".
  return $post.dwCheckIs('.dw-p').attr('id').substr(5, 999);
};


$.fn.dwPostId = function() {   // rename to dwPostNr   and try to remove
  return parseInt(this.dwPostIdStr());
};


$.fn.dwIsArticlePost = function() {
  return this.dwCheckIs('.dw-p').is('.dw-ar-p');
};


})();

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
