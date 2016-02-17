/*
 * Copyright (c) 2016 Kaj Magnus Lindberg
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
///c/// <reference path="../../typedefs/react/react.d.ts" />
/// <reference path="../plain-old-javascript.d.ts" />

//------------------------------------------------------------------------------
   module debiki2.utils {
//------------------------------------------------------------------------------


export function highlightActiveLinkInHeader() {
  var $activeLink = $();
  var longestMatch = 0;
  $('.esPageHeader a').each(function() {
    var $a = $(this);
    var href = $a.attr('href');
    var currentHref = href.indexOf('://') === -1
      ? location.pathname + location.search + location.hash
      : location.href.toString();
    var isActive = currentHref.indexOf(href) === 0;
    if (isActive && href.length >= longestMatch) {
      longestMatch = href.length;
      $activeLink = $a;
    }
  });
  $('.esActiveHeaderLink').removeClass('esActiveHeaderLink');
  $activeLink.addClass('esActiveHeaderLink');
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
