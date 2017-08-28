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



// Depreacted, use dwPostId() instead.
$.fn.dwPostIdStr = function() {   // rename to dwPostNrStr   and try to remove
  var $post = this.is('.dw-t') ? this.children('.dw-p') : this;
  var idString = $post.attr('id');
  if (!idString) {
    return undefined;
  }
  // Drop initial "post-".
  return idString.substr(5, 999);
};


$.fn.dwPostId = function() {   // rename to dwPostNr   and try to remove
  return parseInt(this.dwPostIdStr());
};


})();

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
