/* Miscellaneous stuff. Why is there both debiki-utils.js and -utils-browser.js?
 * Copyright (C) 2010-2012 Kaj Magnus Lindberg (born 1979)
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

// COULD move to namespace debiki.v0.util? (not `window.*`!)
// (I just broke out this file, that's why I haven't fixed that yet.)

(function() {

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


function trunc(number) {
  return number << 0;  // bitwise operations convert to integer
};


// ------- Time utils


// Returns e.g. "4 days ago" or "22 hours ago" or "3 years ago".
// `then' and `now' can be Date:s or milliseconds.
//
debiki.prettyDuration = function(then, now) {  // i18n
  var thenMillis = then.getTime ? then.getTime() : then;
  var nowMillis = now.getTime ? now.getTime() : now;
  var diff = nowMillis - thenMillis;
  var second = 1000;
  var minute = second * 60;
  var hour = second * 3600;
  var day = hour * 24;
  var round = Math.round;
  if (diff >= 30 * day) return monthDayYear(then);
  // I prefer `30 hours ago' to `1 day ago', but `2 days ago' to `50 hours ago'.
  // Skip weeks, because prettyLetterDuration() skips weeks.
  // if (diff > 2 * week) return trunc(diff / week) +" weeks ago";
  if (diff >= 40 * hour) return round(diff / day) +" days ago";
  if (diff >= 100 * minute) return round(diff / hour) +" hours ago";
  if (diff > 2 * minute) return trunc(diff / minute) +" minutes ago";
  if (diff > 1 * minute) return "1 minute ago";
  if (diff > 2 * second) return trunc(diff / second) +" seconds ago";
  if (diff > 1 * second) return "1 second ago";
  return "0 seconds ago";
};


debiki.currentYear = new Date().getUTCFullYear();

debiki.prettyLetterDuration = function(then, now) {  // i18n
  var thenMillis = then.getTime ? then.getTime() : then;
  var nowMillis = now.getTime ? now.getTime() : now;
  var diff = nowMillis - thenMillis;
  var second = 1000;
  var minute = second * 60;
  var hour = second * 3600;
  var day = hour * 24;
  var year = day * 365;
  var month = year / 12;
  // Don't use 'm' for months, because it's used for 'minutes' already. Also, dates and
  // years like "Jan 4, 2015" are more user friendly than 17m (months)?
  if (diff > month) {
    return monthDayYear(then);
  }
  // Skip "w" (weeks), it makes me confused.
  if (diff >= 2 * day) return trunc(diff / day) + "d";
  // "90 minutes ago" is ok, but "105 minutes ago" — then "2 hours" sounds better I think.
  if (diff >= 100 * minute) return trunc(Math.max(2, diff / hour)) + "h";
  if (diff >= minute) return trunc(diff / minute) + "m";
  return trunc(diff / second) + "s";
};


function monthDayYear(when) {
  var date = _.isNumber(when) ? new Date(when) : when;
  return debiki2.prettyMonthDayYear(date, date.getFullYear() !== debiki.currentYear);
}

// ------- Bug functions


// Don't use. Use die2 instead. Could rewrite all calls to die() to use
// die2 instead, and then rename die2 to die and remove the original die().
d.u.die = function(message) {
  throw new Error(message);
};


d.u.die2 = function(errorCode, message) {
  var mess2 = message ? message +' ' : '';
  var err2 = errorCode ? ' '+ errorCode : '';
  throw new Error(mess2 + '[error'+ err2 +']');
};


d.u.dieIf = function(test, message) {
  if (test) throw new Error(message);
};


d.u.die2If = function(test, errorCode, message) {
  if (test) d.u.die2(errorCode, message);
};


d.u.bugIf = function(test, errorGuid) {
  if (test) throw new Error('Internal error ['+ errorGuid +']');
};


})();


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
