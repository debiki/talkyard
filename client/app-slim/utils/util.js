/* Miscellaneous stuff. Why is there both debiki-utils.js and -utils-browser.js?
 * Copyright (C) 2010-2018 Kaj Magnus Lindberg
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

var d = { u: debiki.v0.util };


function trunc(number) {
  return number << 0;  // bitwise operations convert to integer
};


// ------- Time utils


// Returns e.g. "4 days ago" or "22 hours ago" or "3 years ago".
// `then' and `now' can be Date:s or milliseconds.
//
debiki.prettyDuration = function(then, now) {
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
  if (diff >= 40 * hour) return t.daysAgo(round(diff / day));
  if (diff >= 100 * minute) return t.hoursAgo(round(diff / hour));
  if (diff >= minute) return t.minutesAgo(trunc(diff / minute));
  return t.secondsAgo(trunc(diff / second));
};


debiki.currentYear = new Date().getUTCFullYear();

// prettyLetterDuration(then, now) = time from then up until now, e.g. Monday to Friday —> '5d'.
// prettyLetterDuration(duration) = duration millis converted to a pretty letter, e.g 3600*1000 = '1h'.
//
debiki.prettyLetterDuration = function(then, now) {
  var diff;
  var isTimeSpan = !!now;
  if (isTimeSpan) {
    var thenMillis = then.getTime ? then.getTime() : then;
    var nowMillis = now.getTime ? now.getTime() : now;
    diff = nowMillis - thenMillis;
  }
  else {
    // @ifdef DEBUG
    d.u.dieIf(!_.isNumber(then), 'TyE2BKAQP3');
    // @endif
    diff = then;
  }

  var second = 1000;
  var minute = second * 60;
  var hour = second * 3600;
  var day = hour * 24;
  var year = day * 365;
  var month = year / 12;
  // Don't use 'm' for months, because it's used for 'minutes' already. Also, dates and
  // years like "Jan 4, 2015" are more user friendly than 17m (months)?
  if (diff > month && isTimeSpan) {
    return monthDayYear(then);
  }
  if (diff >= 2 * month) return trunc(diff / month) + t.monthsLtr;
  // Skip "w" (weeks), it makes me confused.
  if (diff >= 2 * day) return trunc(diff / day) + t.daysLtr;
  // "90 minutes ago" is ok, but "105 minutes ago" — then "2 hours" sounds better I think.
  if (diff >= 100 * minute) return trunc(Math.max(2, diff / hour)) + t.hoursLtr;
  if (diff >= minute) return trunc(diff / minute) + t.minsLtr;
  return trunc(diff / second) + t.secsLtr;
};


function monthDayYear(when) {
  var date = _.isNumber(when) ? new Date(when) : when;
  return debiki2.prettyMonthDayYear(date, date.getFullYear() !== debiki.currentYear);
}

// ------- Bug functions


// CLEAN_UP SMALLER_BUNDLE  use the ones in  prelude.ts  instead


// Don't use. Use die2 instead. Could rewrite all calls to die() to use
// die2 instead, and then rename die2 to die and remove the original die().
d.u.die = function(message) {
  throw new Error(message);
};


d.u.die2 = function(errorCode, message) {
  var mess2 = message ? message +' ' : '';
  var err2 = errorCode ? ' '+ errorCode : '';
  throw new Error(mess2 + '['+ err2 +']');
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
