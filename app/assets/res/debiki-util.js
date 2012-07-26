/* Copyright (c) 2010 - 2012 Kaj Magnus Lindberg. All rights reserved. */

// TODO move to namespace debiki.v0.util?
// (I just broke out this file, that's why I haven't fixed that yet.)


var KEYCODE_ENTER = 13;
var KEYCODE_ESC = 27;
var VIEWPORT_MIN_WIDTH = 320; // okay with Modern Android and iPhone mobiles


function trunc(number) {
  return number << 0;  // bitwise operations convert to integer
}


function isBlank(str) {
  return !str || !/\S/.test(str);
  // (!/\S/ is supposedly much faster than /^\s*$/,
  // see http://zipalong.com/blog/?p=287)
}


// Converts an ISO 8601 date string to a milliseconds date since 1970,
// and handles MSIE 7 and 8 issues (they don't understand ISO strings).
function isoDateToMillis(dateStr) {
  if (!dateStr) return NaN;
  // For IE 7 and 8, change from e.g. '2011-12-15T11:34:56Z' to
  // '2011/12/15 11:34:56Z'.
  if (jQuery.browser.msie && jQuery.browser.version < '9') {
    dateStr = dateStr.replace('-', '/').replace('T', ' ');
  }
  return Date.parse(dateStr);
}


// ------- Dummy log functions

/**
 * Creates dummy console.log etcetera functions, if console.log doesn't
 * exist. Otherwise scripts break in IE (IE9 at least), where there is
 * no console.log unless the dev tools window has been opened (click F12).
 * Some scripts (e.g. jQuery UI) actually make calls to console.log
 * in release builds, so I cannot simply remove all calls to console.log.
 */
if (typeof console === 'undefined' || !console.log) {
  window.console = {
    debug: function() {},
    trace: function() {},
    log: function() {},
    info: function() {},
    warn: function() {},
    error: function() {}
  };
}


// ------- Zoom event

var zoomListeners = [];
var zoomListenerHandle_dbg;

(function(){
  // Poll the pixel width of the window; invoke zoom listeners
  // if the width has been changed.
  var lastWidth = 0;
  function pollZoomFireEvent() {
    var i;
    var widthNow = jQuery(window).width();
    if (lastWidth === widthNow) return;
    lastWidth = widthNow;
    // Length changed, user must have zoomed, invoke listeners.
    for (i = zoomListeners.length - 1; i >= 0; --i) {
      zoomListeners[i]();
    }
  }
  zoomListenerHandle_dbg = setInterval(pollZoomFireEvent, 100);
}());


// ------- Bug functions

// Don't use. Use die2 instead. Could rewrite all calls to die() to use
// die2 instead, and then rename die2 to die and remove the original die().
function die(message) {
  throw new Error(message);
}


function die2(errorCode, message) {
  var mess2 = message ? message +' ' : '';
  var err2 = errorCode ? ' '+ errorCode : '';
  throw new Error(mess2 + '[error'+ err2 +']');
}


function dieIf(test, message) {
  if (test) throw new Error(message);
}


function die2If(test, errorCode, message) {
  if (test) die2(errorCode, message);
}


function bugIf(test, errorGuid) {
  if (test) throw new Error('Internal error ['+ errorGuid +']');
}


jQuery.fn.dwCheckIs = function(selector, errorCode) {
  var $ok = this.filter(selector);
  die2If(this.length !== $ok.length, errorCode || 'DwE093k2', $ok.length +
      ' of '+ this.length +' elems is: '+ selector);
  return this;
};


jQuery.fn.dwBugIfEmpty = function(errorGuid) {
  bugIf(!this.length, errorGuid);
  return this;
};


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
