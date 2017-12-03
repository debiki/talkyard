/*
 * Copyright (c) 2017 Kaj Magnus Lindberg
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

//------------------------------------------------------------------------------
   namespace debiki2.util {
//------------------------------------------------------------------------------


export function makeResizableUp(elem, handle, onResize) {
  handle.addEventListener('mousedown', startDrag);

  let startY = 0;
  let startHeight = 0;

  function startDrag(event) {
    startY = event.clientY;
    startHeight = elem.clientHeight;
    document.documentElement.addEventListener('mousemove', doDrag, false);
    document.documentElement.addEventListener('mouseup', stopDrag, false);
    $h.addClasses(document.body, 's_Resizing');
  }

  function doDrag(event) {
    const newHeight = startHeight - event.clientY + startY;
    elem.style.height = newHeight + 'px';
    if (onResize) onResize(newHeight);
  }

  function stopDrag(event) {
    document.documentElement.removeEventListener('mousemove', doDrag, false);
    document.documentElement.removeEventListener('mouseup', stopDrag, false);
    $h.removeClasses(document.body, 's_Resizing');
  }
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
