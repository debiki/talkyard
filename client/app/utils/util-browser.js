/* Miscellaneous stuff, e.g. a browser zoom change detector.
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

var d = { i: debiki.internal, u: debiki.v0.util };


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

if (!console.time) {
  console.time = function() {};
}

if (typeof performance === 'undefined' || !performance.now) {
  window.performance = {
    now: function() { return 0; }
  };
}


// ------- Zoom and resize events


d.u.addZoomOrResizeListener = function(listener) {
  d.u.zoomListeners.push(listener);
};


d.u.removeZoomOrResizeListener = function(listenerToRemove) {
  _.remove(d.u.zoomListeners, function(listener) {
    return listener === listenerToRemove;
  });
};

// COULD stop exposing directly, use `addZoomListener()` instead.
d.u.zoomListeners = [];

(function(){
  // Poll the pixel width of the window; invoke zoom listeners
  // if the width or height has been changed.
  var lastWidth = 0;
  var lastHeight = 0;
  function pollZoomFireEvent() {
    var widthNow = window.innerWidth;
    var heightNow = window.innerHeight;
    if (lastWidth === widthNow && lastHeight === heightNow)
      return;

    lastWidth = widthNow;
    lastHeight = heightNow;
    // Length changed, user must have zoomed, invoke listeners.
    for (var i = d.u.zoomListeners.length - 1; i >= 0; --i) {
      d.u.zoomListeners[i]({ type: 'zoomOrResize' });
    }
  }
  d.u.zoomListenerHandle_dbg = setInterval(pollZoomFireEvent, 100);
}());



// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
