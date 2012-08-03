/* Copyright (c) 2012 Kaj Magnus Lindberg. All rights reserved. */


(function() {

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


var tipsHtmlStr =
    "<div class='dw-tps' id='dw-tps-utterscroll'>"+
    "<p><b>Scroll quickly:</b></p>"+
      "<p>Click <b>and hold</b> left mouse button, on the white"+
      "background,<br>"+
      "and move the mouse leftwards and rightwards.</p>"+
      "<p class='dw-tps-close'>(Do that, please, to dismiss this box)</p>"+
    "</div>";


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
      var $tips = $(tipsHtmlStr);
      $tips.appendTo($('body')).show()
          // Place tips in the right part of the viewport.
          // I guess that's where people tend to look, since they're most
          // likely scrolling to the right.
          // (The tips has position: fixed.)
          .css('top', ($(window).height() - $tips.height()) / 2)
          .css('left', $(window).width() * 2 / 3 - $tips.width() / 2)
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
