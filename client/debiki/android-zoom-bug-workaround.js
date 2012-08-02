/* Copyright (c) 2012 Kaj Magnus Lindberg. All rights reserved. */

/**
 * Works around an Android viewport dimension bug. Call on
 * page load. Also, perhaps the viewport's initial-scale must be 1.0.
 *
 * The bug: On text input focus, Android auto zooms that text input.
 * But when auto zooming, Android won't update these viewport dimension
 * related values:  (they're unchanged, as if still zoomed out)
 * screen.width and height, window.innerWidth and innerHeight,
 * document.documentElement.clientWidth and clientHeight,
 * window.pageXOffset and pageYOffset.
 *
 * The workaround: Whenever a text input is focused, reset zoom
 * to 1.0. Then all above values are updated correctly, by Android.
 * When zoom has been reset (this might take some 100 ms), scroll back
 * to the focused text input.
 * Here I found info on an (the?) Android bug:
 *   http://code.google.com/p/android/issues/detail?id=10775#c26
 *   By stephen....@carisenda.com, Jun 27, 2011
 *   "innerWidth is reported incorrectly after a page zoom on some but
 *   not all devices running Android, it seems to be device rather than
 *   android version dependent. For example the bug appears in Samsung Galaxy S
 *   and Tab but not on HTC Evo or Hero (this is after adding in a viewport
 *   meta tag (see comment 20))."
 *   (Without the viewport meta tag, viewport dimenstions are *always*
 *   wrong on my Android (and some of theirs).)
 *
 * Arguments: jQuery
 * Requires:
 *   $.dwScrollIntoView
 *   Modernizr
 *   console.debug, console.log (should remove this dependency)
 */
debiki.v0.util.workAroundAndroidZoomBug = function($) {

  // Cancel if not Android, or if bug fixed in this Android version.
  var androidVersion = window.navigator.userAgent.match(/Android\s+([\d\.]+)/);
  if (!androidVersion) return;
  androidVersion = androidVersion[1];
  // Should find out in which versions the bug is present:
  // if (androidVersion == ... || androidVersion > ...) return;

  // Remember window dimensions, initially when the viewport's initial-scale
  // is 1.0. Then we can work around certain Android bugs later.
  var windowInnerWidthUnscaled = window.innerWidth;
  var windowInnerHeightUnscaled = window.innerHeight;

  // Returns a $.Deferred, and resolves it when zoom has been reset
  // (or somewhat later). However if zoom hasn't been reset after
  // a while, rejects the $.Deferred.
  function resetMobileZoom() {
    var resetStatus = $.Deferred();

    if (!Modernizr.touch || isZoomReset())
      return resetStatus.resolve();

    console.debug('Resetting zoom to initial-scale=1.0...');
    $('meta[name=viewport]').attr('content',
       'initial-scale=1.0, maximum-scale=0.05');

    var pollHandle = setInterval(pollZoomResolveStatus, 100);
    pollZoomResolveStatus();

    // If zoom not reset within two seconds, something is amiss?
    var failHandle = setTimeout(function() {
      resetStatus.reject();
      clearInterval(pollHandle);
      console.debug('Cancelled zoom reset polling.');
    }, 2000);

    function pollZoomResolveStatus() {
      if (!isZoomReset()) return;
      console.debug('Zoom has been reset.');
      resetStatus.resolve();
      clearInterval(pollHandle);
      clearTimeout(failHandle);
    }

    return resetStatus;
  }

  // Returns true if zoom has been, or need not be, reset.
  function isZoomReset() {
    // If portrait orientation initially, and portrait now, or if
    // landscape initially, landscape now, then, when zoom reset:
    //   window.innerWidth === windowInnerWidthUnscaled
    //   window.innerHeight === windowInnerHeightUnscaled
    //   — however, don't require that heights match,
    //   because sometimes the width isn't scaled, but only the
    //   height — and then it's better not to reset zoom, because
    //   resetting zoom causes the viewport to move to 0,0 and
    //   when dwScrollIntoView scrolls back again, everything looks
    //   jerky.
    // If portrait initially, but landscape now, or
    // landscape initially, but portrait now:
    //   window.innerWidth === windowInnerHeightUnscaled
    //   window.innerHeight === windowInnerWidthUnscaled
    return (window.innerWidth === windowInnerWidthUnscaled) ||
      (window.innerWidth === windowInnerHeightUnscaled &&
        window.innerHeight === windowInnerWidthUnscaled);
  }

  $(document).on('focus', 'textarea, input[type=text]', function() {
    console.log('');
    var $input = $(this);
    if (!isZoomReset()) resetMobileZoom().done(function() {
      // $input.blur().focus() won't scroll $input into view on my Android.
      $input.dwScrollIntoView(
          { marginRight: 20, marginBottom: 100, duration: 0 });
    });
  });
};

