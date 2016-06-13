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
/// <reference path="../utils/react-utils.ts" />

//------------------------------------------------------------------------------
   module debiki2.page.Hacks {
//------------------------------------------------------------------------------


export function processPosts() {
   processTimeAgo();
   hideShowCollapseButtons();

}


// Finds all tall posts and unhides their collapse button, which by default
// is hidden by CSS. [4KY0S2]
//
function hideShowCollapseButtons() {
   $('.dw-a-clps:not(.esP_Z-Show)').each(function() {
      var $this = $(this);
      var $thread = $this.closest('.dw-t');
      if (!$thread.length)
         return;

      var threadElem = $thread[0];
      var rect = threadElem.getBoundingClientRect();
      if (rect.height > 110) {
         $this.addClass('esP_Z-Show');
      }
      else {
         $this.removeClass('esP_Z-Show');
      }
   });
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
