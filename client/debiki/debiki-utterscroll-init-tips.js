/* Copyright (c) 2012 Kaj Magnus Lindberg. All rights reserved. */


(function() {

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


/**
 * Enalbes Utterscroll, and shows a tips about Utterscroll, if you
 * use the horizontal scrollbar.
 */
d.i.initUtterscrollAndTips = function() {
  d.u.bugIf(Modernizr.touch);
  // Activate Utterscroll, and show tips if people use the window scrollbars,
  // hide it on utterscroll.
  var hasUtterscrolled = false;
  var $utterscrollTips;
  debiki.Utterscroll.enable({
    scrollstoppers: '.CodeMirror,'+
        ' .ui-draggable, .ui-resizable-handle, .dw-p-hd',
    onMousedownOnWinHztlScrollbar: function() {
      if (hasUtterscrolled || $utterscrollTips)
        return;
      var $tips = $('#dw-tps-utterscroll');
      $tips.show()
          // Place tips in the middle of the viewport.
          // (The tips has position: fixed.)
          .css('top', ($(window).height() - $tips.height()) / 2)
          .css('left', ($(window).width() - $tips.width()) / 2)
          .click(function() { $tips.hide(); });
      $utterscrollTips = $tips;
    },
    onHasUtterscrolled: function() {
      hasUtterscrolled = true;
      if ($utterscrollTips) $utterscrollTips.hide();
    }
  });
};


})();

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
