/*
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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

/// <reference path="../../typedefs/react/react.d.ts" />
/// <reference path="../../typedefs/lodash/lodash.d.ts" />
/// <reference path="../../shared/plain-old-javascript.d.ts" />

//------------------------------------------------------------------------------
   module debiki2.sidebar.SidebarResizer {
//------------------------------------------------------------------------------


export function start() {
  window.addEventListener('scroll', updateSidebarSizeAndPosition, false);
  debiki.v0.util.zoomListeners.push(updateSidebarSizeAndPosition);
}


function updateSidebarSizeAndPosition() {
  return;

  // later:

  var sidebar = $('#dw-sidebar');
  var commentSectionOffset = $('.dw-cmts-tlbr + .dw-single-and-multireplies').offset();
  var commentSectionTop = commentSectionOffset.top;
  var winScrollTop = $(window).scrollTop();

  if (commentSectionTop <= winScrollTop) {
    sidebar.addClass('dw-sidebar-fixed');
  }
  else {
    sidebar.css('top', commentSectionOffset.top);
  }
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
