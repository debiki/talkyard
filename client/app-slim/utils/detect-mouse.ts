/*
 * Copyright (c) 2015, 2020 Kaj Magnus Lindberg
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


// RENAME to detect-activity.ts ?

//------------------------------------------------------------------------------
   namespace debiki2.utils {
//------------------------------------------------------------------------------


// Last time the human did something.
//
export const getHumanLastActiveAtMs = (): number => humanLastActivityMs;

let humanLastActivityMs: number;


const pendingMouseCallbacks: (() => void)[] = [];

export let isMouseDetected: boolean = undefined;


/**
 * Works like so: If a mouse event happens before any touch event, we'll
 * assume that a mouse is present and in use. If a touch event happens first, then
 * even if a mouse is present (we don't know) apparently it's not in use.
 *
 * Adds a '.mouse' class to the <html> tag if mouse detected.
 *
 * (Some devices, e.g. my laptop, have both a touch screen and a mouse.)
 *
 * Not sure if this will work on all touch devices. Works on my Fair Phone Android
 * anyway.
 */
export function startDetectingMouse() {    // RENAME to startDetectingActivity()
  Bliss.once(document, {
    'touchstart touchend touchmove mousemove': function(event) {
      if (event.type === 'mousemove') {
        onFirstMouseMove();
      }
      else {
        onFirstTouch();
      }
    }
  });

  humanLastActivityMs = getNowMs();

  // Not needed — uninteresting *or* triggers some other event too?:
  //   submit change mouseenter resize dblclick.
  /*  for (let event of ['mousedown', 'mousemove', 'keypress', 'scroll',
      'touchmove ', 'touchstart']) {
    window.addEventListener(event,
  */
  Bliss.bind(window, {
    'mousedown mousemove keypress scroll touchmove touchstart': function() {
      humanLastActivityMs = getNowMs();
    }
  });
}


/**
 * The callback is called if a mouse is detected, otherwise never.
 */
export function onMouseDetected(callback: () => void) {
  if (isMouseDetected) {
    callback();
  }
  else {
    pendingMouseCallbacks.push(callback);
  }
}


function onFirstTouch() {
  logM('Touch screen in use, assuming no mouse.');
  isMouseDetected = false;
}


function onFirstMouseMove() {
  logM('Mouse detected. [TyMMOUSE]');
  isMouseDetected = true;
  document.documentElement.className += ' mouse';
  for (let i = 0; i < pendingMouseCallbacks.length; ++i) {
    pendingMouseCallbacks[i]();
  }
  pendingMouseCallbacks.length = 0; // clear array
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
