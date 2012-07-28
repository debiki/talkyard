/* Copyright (c) 2010 - 2012 Kaj Magnus Lindberg. All rights reserved. */

// TODO move to namespace debiki.v0.util? (not `window.*`!)
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


// IE 6, 7, 8 has no toISOString.
if (!Date.prototype.toISOString) {
  Date.prototype.toISOString = function () {
    function pad(n) {
      return n < 10 ? '0' + n : n;
    }
    return '"' + this.getUTCFullYear() + '-' +
        pad(this.getUTCMonth() + 1) + '-' +
        pad(this.getUTCDate())      + 'T' +
        pad(this.getUTCHours())     + ':' +
        pad(this.getUTCMinutes())   + ':' +
        pad(this.getUTCSeconds())   + 'Z"';
  };
}


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


d.u.zoomListeners = [];

(function(){
  // Poll the pixel width of the window; invoke zoom listeners
  // if the width has been changed.
  var lastWidth = 0;
  function pollZoomFireEvent() {
    var i;
    var widthNow = $(window).width();
    if (lastWidth === widthNow) return;
    lastWidth = widthNow;
    // Length changed, user must have zoomed, invoke listeners.
    for (i = d.u.zoomListeners.length - 1; i >= 0; --i) {
      d.u.zoomListeners[i]();
    }
  };
  d.u.zoomListenerHandle_dbg = setInterval(pollZoomFireEvent, 100);
}());


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


$.fn.dwCheckIs = function(selector, errorCode) {
  var $ok = this.filter(selector);
  d.u.die2If(this.length !== $ok.length, errorCode || 'DwE093k2', $ok.length +
      ' of '+ this.length +' elems is: '+ selector);
  return this;
};


$.fn.dwBugIfEmpty = function(errorGuid) {
  d.u.bugIf(!this.length, errorGuid);
  return this;
};


// ------- HTML helpers


// Finds all tags with an id attribute, and (hopefully) makes
// the ids unique by appending a unique (within this Web page) number to
// the ids. Updates any <label> `for' attributes to match the new ids.
// If hrefStart specified, appends the unique number to hrefs that starts
// with hrefStart.  (This is useful e.g. if many instances of a jQuery UI
// widget is to be instantiated, and widget internal stuff reference other
// widget internal stuff via ids.)
d.u.makeIdsUniqueUpdateLabels = function(jqueryObj, hrefStart) {
  var seqNo = '_sno-'+ (++idSuffixSequence);
  jqueryObj.find("*[id]").each(function(ix) {
      $(this).attr('id', $(this).attr('id') + seqNo);
    });
  jqueryObj.find('label').each(function(ix) {
      $(this).attr('for', $(this).attr('for') + seqNo);
    });
  jqueryObj.find('*[href^='+ hrefStart + ']').each(function(ix) {
    $(this).attr('href', this.hash + seqNo);
  });
};


// When forms are loaded from the server, they might have ID fields.
// If the same form is loaded twice (e.g. to reply twice to the same comment),
// their ids would clash. So their ids are made unique by appending a form no.
var idSuffixSequence = 0;


d.u.buildTagFind = function(html, selector) {
  if (selector.indexOf('#') !== -1) d.u.die('Cannot lookup by ID: '+
      'getElementById might return false, so use buildTagFindId instead');
  // From jQuery 1.4.2, jQuery.fn.load():
  var $wrap =
      // Create a dummy div to hold the results
      $('<div />')
      // inject the contents of the document in, removing the scripts
      // to avoid any 'Permission Denied' errors in IE
      .append(html.replace(/<script(.|\s)*?\/script>/gi, ''));
  var $tag = $wrap.find(selector);
  return $tag;
};


// Builds HTML tags from `html' and returns the tag with the specified id.
// Works also when $.find('#id') won't (because of corrupt XML?).
d.u.buildTagFindId = function(html, id) {
  if (id.indexOf('#') !== -1) d.u.die('Include no # in id [error DwE85x2jh]');
  var $tag = d.u.buildTagFind(html, '[id="'+ id +'"]');
  return $tag;
};


// ------- jQuery extensions


(function() {
  $.fn.dwDisable = function() {
    return _dwEnableDisableImpl(this, true);
  };

  $.fn.dwEnable = function() {
    return _dwEnableDisableImpl(this, false);
  };

  function _dwEnableDisableImpl(self, disabled) {
    // (Radio buttons and checkboxes have the
    // .ui-helper-hidden-accessible class – jQuery UI places
    // .ui-button on the related <label>, not the <input>.)
    if (self.filter('input, button')
        .is('.ui-button, .ui-helper-hidden-accessible'))
      self.button('option', 'disabled', disabled);
    else self.prop('disabled', disabled);
    return self;
  };
})();


})();


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
