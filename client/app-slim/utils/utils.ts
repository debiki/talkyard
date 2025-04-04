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


//------------------------------------------------------------------------------
   namespace debiki2 {
//------------------------------------------------------------------------------

const stupidLocalStorage = {};
const stupidSessionStorage = {};


/**
 * JSON.stringify saves keys in the order they were added, which tends to be rather
 * random, breaking lookup when getting something from session or local storage
 * (if the key is a stringified object).
 */
export function stableStringify(obj: any): string {
  return stableStringifySkipNulls(obj, false);
}


export function stableStringifySkipNulls(obj: any, skipNulls: boolean): string {
  // @ifdef DEBUG
  dieIf(!obj, "TyE7AKBR02")
  // @endif
  if (!_.isObject(obj)) return obj;
  const keys = Object.keys(obj);
  let okayKeys;
  if (skipNulls) {
    okayKeys = [];
    for (let i = 0; i < keys.length; ++i) {
      const key = keys[i];
      const value = obj[key];
      if (value === undefined || value === null)
        continue;
      okayKeys.push(key);
    }
  }
  else {
    okayKeys = keys;
  }
  const keysSorted = okayKeys.sort();
  return JSON.stringify(obj, keysSorted);
}


export function putInLocalStorage(key: St, value) {   // CLEAN_UP REMOVE Use BrowserStorage instead
  key = stableStringifySkipNulls(key, true);
  // In Safari, private browsing mode, there's no local storage, so setItem() throws an error.
  try {
    localStorage.setItem(key, JSON.stringify(value));
  }
  catch (exception) {
    // This'll be lost on page reload, that'll have to do.
    stupidLocalStorage[key] = value;
  }
}


export function putInSessionStorage(key: St, value) {
  key = stableStringifySkipNulls(key, true);
  // In Safari, private browsing mode, there's no session storage, so setItem() throws an error.
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  }
  catch (exception) {
    // Lost on page reload, fine.
    stupidSessionStorage[key] = value;
  }
}


export function getFromLocalStorage(key: St): any | null {
  key = stableStringifySkipNulls(key, true);
  return getFromStorage(true, stupidLocalStorage, key);
}


export function getFromSessionStorage(key: St): any | null {
  key = stableStringifySkipNulls(key, true);
  return getFromStorage(false, stupidSessionStorage, key);
}


export function canUseLocalStorage(): boolean {
  try {  // [7IWD20ZQ1]
    return !!localStorage;
  }
  catch (ignored) {
  }
  // Then return undefined, meaning false.
}


function getFromStorage(useLocal: boolean, stupidStorage, key): any | null {
  // In FF, if third party cookies have been disabled, localStorage.getItem throws a security
  // error, if this code runs in an iframe. More details: [7IWD20ZQ1]
  // In iOS and Chrome, this error is thrown:
  //   "Failed to read the 'localStorage' property from 'Window': Access is denied for this document"
  // if cookie access is disabled (seems to be by default on iOS).
  // In Chrome, to make that error happen, go to:  chrome://settings/content/cookies and disable
  // "Allow sites to save and read cookie data", and then access localStorage/ (outside a try {}).
  let value: any | null = null;
  try {
    const realStorage = useLocal ? localStorage : sessionStorage;
    const strOrNull = realStorage.getItem(key);
    value = strOrNull && JSON.parse(strOrNull);
  }
  catch (ignored) {
  }
  // It's null if missing (not undefined), at least in Chrome.
  if (value === null) {
    value = stupidStorage[key];
    if (_.isUndefined(value))
      return null;
  }
  return value;
}


// There's a server side version (in ../../server/) that throws a helpful error.
export function removeFromLocalStorage(key) {
  removeFromStorage(key, true);
}

export function removeFromSessionStorage(key) {
  removeFromStorage(key, false);
}

function removeFromStorage(key, useLocal: boolean) {
  key = stableStringifySkipNulls(key, true);
  try { (useLocal ? localStorage : sessionStorage).removeItem(key); }
  catch (ignored) {}
  delete ( useLocal ? stupidLocalStorage : stupidSessionStorage)[key];
}

// From here: http://stackoverflow.com/a/7616484/694469
// which copied it from this blog post:
//   http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
// License: MIT apparently, see COPYING.txt.
export function hashStringToNumber(string: string): number {  // [4KFBW2]
  let hash = 0, i, chr, len;
  if (string.length == 0) return hash;
  for (i = 0, len = string.length; i < len; i++) {
    chr   = string.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}


/// Encodes a search query for placing in a URL query param value.
///
export function urlEncodeSearchQuery(query: St): St {
  if (!query) return '';
  // encodeURIComponent encodes a query string param and escapes "everything", but we
  // don't need to do that. Instead, use encodeURI, and then manually escape a few
  // more chars. This is the difference between encodeURIComponent and encodeURI:
  // for (var i = 0; i < 256; i++) {
  //   var char = String.fromCharCode(i);
  //   if (encodeURI(char) !== encodeURIComponent(char)) {
  //     console.log(char + ': ' + encodeURI(char) + ' —> ' + encodeURIComponent(char));
  //   }
  // }
  // (see http://stackoverflow.com/a/23842171/694469)
  // ==>
  // #: # —> %23
  // $: $ —> %24
  // &: & —> %26
  // +: + —> %2B
  // ,: , —> %2C
  // /: / —> %2F
  // :: : —> %3A
  // ;: ; —> %3B
  // =: = —> %3D
  // ?: ? —> %3F
  // @: @ —> %40

  // Also, from https://stackoverflow.com/a/10890520:
  // encodeURIComponent won't encode:  ~!*()'
  //          encodeURI won't encode:  ~!@#$&*()=:/,;?+'

  var encoded = encodeURI(query);
  encoded = encoded.replace('#', '%23');
  encoded = encoded.replace('$', '%24');
  encoded = encoded.replace('&', '%26');
  // '+' means space in a query param and is easier to read. First encode all "real" '+' to %2B,
  // then decode spaces to '+':
  encoded = encoded.replace('+', '%2B');
  encoded = encoded.replace('%20', '+');
  // leave , / :  — they're reserved for us to use as delimiters or whatever.
  encoded = encoded.replace(';', '%3B');
  encoded = encoded.replace('=', '%3D');
  encoded = encoded.replace('?', '%3F');
  // leave @  — it's reserved for us.
  return encoded;
}


/**
 * Copyright (c) Sindre Sorhus
 * License: MIT
 * https://github.com/sindresorhus/pretty-bytes
 *
 * [ty] Changed to units of 1024 = kibi, and KiB, MiB etc,  not kilo = 1000. /Magnus
 *
 * Tests: e2e: upload-images-and-files  TyT50E6KTDU7
 */
export function prettyBytes(num: number): string {
  let neg = num < 0;
  const kibi = 1024;  // kibi means 2^10

  // Decimal, with kilo = 1000:
  // var units = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  // File sizes and memory size is typically specified in kibi = 1024 bytes,
  // not kilo = 1000 bytes. Eg. MS Win and Linux.  [kibi_fs_ram]  [ty]
  // Basically zero percent people knows how MiB (mebibyte) is different
  // from MB (megabyte)? But use MiB anyway, so the Ty developers won't
  // get confused by file sizes in e2e tests. People who don't know about kibi
  // will probably just assume that MiB = MB, which is fine, that's how
  // MS Win & Linux(?) display file sizes anyway.
  //
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];

  if (neg) {
    num = -num;
  }
  if (num < 1) {
    return (neg ? '-' : '') + num + ' B';
  }

  // However, use log(1000) here, not log(1024). Then,    [ty] [pretty_mebibytes]
  // for example 0.99 MiB = 1037312 bytes = 1.03 MB (megabytes) becomes
  // exponent = 2, and below,   1037312 / pow(1024, 2) == 0.99
  // — so we get back 0.99 MiB, which looks nice?
  // If instead using log(1024) here, then, exponent becomes 1,
  // and 1037312 / pow(1024, 1) == 1013, so a 0.99 MiB file appears
  // as 1013 KiB, which can be confusing:  as if 0.99 MiB grew to 1.013.
  // But if you stop and think:  1013 KiB < 1 MiB (1024 KiB == 1 MiB).
  //
  // Tested here: TyTE2EKILOKIBI
  //
  const exponent: number = Math.min(
          Math.floor(Math.log(num) / Math.log(1000)),  // not 1024, see above
          units.length - 1);

  // This results in """error TS2362: The left-hand side of an arithmetic operation must be
  // of type 'any', 'number' or an enum type."""
  //var rounded: number = (num / Math.pow(1024, exponent)).toFixed(2) * 1;
  // Instead:  (and note: kibi, not kilo)  [ty]
  const tmp: any = (num / Math.pow(kibi, exponent)).toFixed(2);
  const rounded = tmp * 1;

  const unit = units[exponent];
  return (neg ? '-' : '') + rounded + ' ' + unit;
}


var shortMonthNames = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Returns e.g. "Jan 25, 2015"  I18N
// Better than moment.js, whose .min.js.gz is 20kb (too large for the slim-bundle.js).
export function prettyMonthDayYear(when: number, includeCurrentYear): string {
  var date = new Date(when);
  var day = date.getDate();
  var month = shortMonthNames[date.getMonth()];
  var commaYear = includeCurrentYear ? ', ' + date.getFullYear() : '';
  return month + '\xa0' + day + commaYear;  // xa0 is the no-break space
}

export function isoDateStringToMillis(dateString: string) {
  // 1) Split "2015-12-30 23:59:59" to year, month etc numbers, and split on 'TZ' too,
  // in case ISO 8601 'T' not ' ' separates the date from the timestamp, and if the
  // UTC timezone ('Z') is specified.
  // Split on '.' too because millis might be separated from seconds, by '.'.
  // 2) Use +x to convert to int — but don't use parseInt(num, radix) because it'll get
  // the date fragment index as arg 2 == the radix == invalid.
  var parts: number[] = dateString.split(/[-TZ\. :]/).map((x) => +x);
  // Date.UTC(..) returns milliseconds since 1970, and assumes the input is in UTC.
  // It wants months starting on index 0 not 1, so subtract 1.
  return Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]);
}

export function getPageScrollableRect(): ClientRect {
  return document.getElementById('esPageScrollable').getBoundingClientRect();
}


export function getPageRect(): ClientRect {
  return document.getElementById('dwPosts').getBoundingClientRect();
}


export function reactGetRefRect(reactRef): Rect {
  return cloneRect((<HTMLElement> ReactDOM.findDOMNode(reactRef)).getBoundingClientRect());
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


// export function event_canBeKeyTarget(event): Bo ?


// React reuses the same event object instance, for many different events, so need
// to clone the event target bounding rectangle, if need to use it a bit later,
// e.g. after the more-bundle.js has been loaded.
//
// RENAME to  event_cloneTargetRect
export function cloneEventTargetRect(event): Rect {
  return cloneRect(event.target.getBoundingClientRect());
}

export function event_isEscape(event): boolean {
  var code = event.which || event.charCode || event.keyCode;
  return code === KeyCodeEscape;
}

export function event_isCtrlEnter(event): boolean {
  return event.ctrlKey && event_isEnter(event);
}

export function event_isShiftEnter(event): boolean {
  return event.shiftKey && event_isEnter(event);
}

export function event_isEnter(event): boolean {
  // In Chrome on Windows, Ctrl + Enter supposedly results in key code = Line Feed, not Enter.
  // Because Windows expect a line feed char apparently —
  // see: https://bugs.chromium.org/p/chromium/issues/detail?id=79407
  // Try all fields, hopefully will work for all browsers and for both onKeyPress and onKeyDown.
  var code = event.which || event.charCode || event.keyCode;
  return code === KeyCodeEnter || code === KeyCodeLineFeed;
}

export function event_isSpace(event): Bo {
  const code = event.which || event.charCode || event.keyCode;
  return code === KeyCodeSpace;
}

const KeyCodeEnter = 13;
const KeyCodeLineFeed = 10;
const KeyCodeEscape = 27;
const KeyCodeSpace = 32;


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
