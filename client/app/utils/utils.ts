/*
 * Copyright (c) 2015-2016 Kaj Magnus Lindberg
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

/// <reference path="../../typedefs/jquery/jquery.d.ts" />
/// <reference path="../plain-old-javascript.d.ts" />

//------------------------------------------------------------------------------
   module debiki2 {
//------------------------------------------------------------------------------

var d: any = { i: debiki.internal, u: debiki.v0.util };


export function putInLocalStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function putInSessionStorage(key, value) {
  sessionStorage.setItem(key, JSON.stringify(value));
}

export function getFromLocalStorage(key) {
  var value = localStorage.getItem(key);
  return value && JSON.parse(value);
}

export function getFromSessionStorage(key) {
  var value = sessionStorage.getItem(key);
  return value && JSON.parse(value);
}

// There's a server side version (in ../../server/) that throws a helpful error.
export function removeFromLocalStorage(key) {
  localStorage.removeItem(key);
}

// From here: http://stackoverflow.com/a/7616484/694469
// which copied it from this blog post:
//   http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
// Copyright? License? Seems the author didn't think about that, and want people to use it.
export function hashStringToNumber(string: string): number {  // [4KFBW2]
  var hash = 0, i, chr, len;
  if (string.length == 0) return hash;
  for (i = 0, len = string.length; i < len; i++) {
    chr   = string.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}


/**
 * Copyright (c) Sindre Sorhus
 * License: MIT
 * https://github.com/sindresorhus/pretty-bytes
 */
export function prettyBytes(num: number): string {
  var neg = num < 0;
  var units = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  if (neg) {
    num = -num;
  }
  if (num < 1) {
    return (neg ? '-' : '') + num + ' B';
  }
  var exponent: number = Math.min(Math.floor(Math.log(num) / Math.log(1000)), units.length - 1);

  // This results in """error TS2362: The left-hand side of an arithmetic operation must be
  // of type 'any', 'number' or an enum type."""
  //var rounded: number = (num / Math.pow(1000, exponent)).toFixed(2) * 1;
  // Instead:
  var tmp: any = (num / Math.pow(1000, exponent)).toFixed(2);
  var rounded = tmp * 1;

  var unit = units[exponent];
  return (neg ? '-' : '') + rounded + ' ' + unit;
}


export function getPageScrollableRect(): ClientRect {
  return document.getElementById('esPageScrollable').getBoundingClientRect();
}


export function getPageRect(): ClientRect {
  return document.getElementById('dwPosts').getBoundingClientRect();
}


export function reactGetRefRect(reactRef): Rect {
  return cloneRect(ReactDOM.findDOMNode(reactRef).getBoundingClientRect());
}


// A ClientRect is frozen, so need to clone it before modifying it.
//
export function cloneRect(rect: ClientRect | Rect): Rect {
  return {
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
  };
}


export function event_isCtrlEnter(event) {
  return event.ctrlKey && event_isEnter(event);
}

export function event_isShiftEnter(event) {
  return event.shiftKey && event_isEnter(event);
}

export function event_isEnter(event) {
  // In Chrome on Windows, Ctrl + Enter supposedly results in key code = Line Feed, not Enter.
  // Because Windows expect a line feed char apparently —
  // see: https://bugs.chromium.org/p/chromium/issues/detail?id=79407
  // Try all fields, hopefully will work for all browsers and for both onKeyPress and onKeyDown.
  var code = event.which || event.charCode || event.keyCode;
  return code === KeyCodeEnter || code === KeyCodeLineFeed;
}

var KeyCodeEnter = 13;
var KeyCodeLineFeed = 10;


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
