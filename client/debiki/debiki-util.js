/* Copyright (c) 2010 - 2012 Kaj Magnus Lindberg. All rights reserved. */

// COULD move to namespace debiki.v0.util? (not `window.*`!)
// (I just broke out this file, that's why I haven't fixed that yet.)

(function() {

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


function trunc(number) {
  return number << 0;  // bitwise operations convert to integer
};


// ------- Time utils


// Converts an ISO 8601 date string to a milliseconds date since 1970,
// and handles MSIE 7 and 8 issues (they don't understand ISO strings).
d.u.isoDateToMillis = function(dateStr) {
  if (!dateStr) return NaN;
  // For IE 7 and 8, change from e.g. '2011-12-15T11:34:56Z' to
  // '2011/12/15 11:34:56Z'.
  if ($.browser.msie && $.browser.version < '9') {
    dateStr = dateStr.replace('-', '/').replace('T', ' ');
  }
  return Date.parse(dateStr);
};


// `then' and `now' can be Date:s or milliseconds.
// Consider using: https://github.com/rmm5t/jquery-timeago.git, supports i18n.
d.u.prettyTimeBetween = function(then, now) {  // i18n
  var thenMillis = then.getTime ? then.getTime() : then;
  var nowMillis = now.getTime ? now.getTime() : now;
  var diff = nowMillis - thenMillis;
  var second = 1000;
  var minute = second * 60;
  var hour = second * 3600;
  var day = hour * 24;
  var week = day * 7;
  var month = day * 31 * 30 / 2;  // integer
  var year = day * 365;
  // I prefer `30 hours ago' to `1 day ago', but `2 days ago' to `50 hours ago'.
  if (diff > 2 * year) return trunc(diff / year) +" years ago";
  if (diff > 2 * month) return trunc(diff / month) +" months ago";
  if (diff > 2 * week) return trunc(diff / week) +" weeks ago";
  if (diff > 2 * day) return trunc(diff / day) +" days ago";
  if (diff > 2 * hour) return trunc(diff / hour) +" hours ago";
  if (diff > 2 * minute) return trunc(diff / minute) +" minutes ago";
  if (diff > 1 * minute) return "1 minute ago";
  if (diff > 2 * second) return trunc(diff / second) +" seconds ago";
  if (diff > 1 * second) return "1 second ago";
  return "0 seconds ago";
};



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
