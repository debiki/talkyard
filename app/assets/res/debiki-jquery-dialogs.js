/* Copyright (c) 2010 - 2012 Kaj Magnus Lindberg. All rights reserved. */


(function() {

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;

var VIEWPORT_MIN_WIDTH = 320; // okay with Modern Android and iPhone mobiles


/**
 * Debiki's default jQuery UI dialog settings.
 */
var jQueryDialogDefault = {
  autoOpen: false,
  autoResize: true,
  modal: true,
  resizable: false,
  // Should use CSS instead of this, but for now:
  width: VIEWPORT_MIN_WIDTH - 20, // ok with modern mobiles
  zIndex: 1190,  // the default, 1000, is lower than <form>s z-index

  /**
   * Adds tabindex to any jQuery buttons, if needed (if any elem
   * in the dialog already has tabindex).
   *
   * And fixes two issues I (KajMagnus) am encountering on my Android phone:
   * 1) The dialog appears outside the <html> elem. — If so, move it to
   * inside the <html> elem (or parts of it will never be visible).
   * 2) Sometimes the dialog does not appear inside the viewport, or
   * only parts of the dialog appear inside the viewport. — If so,
   * scroll the dialog's upper left corner into view.
   *
   * (Might as well run this code on desktop browsers too — simplifies
   * debugging, if nothing else.)
   */
  open: function(event, ui) {
    var $dialog = $(event.target);
    var $dialogFrame = $dialog.parent();

    // If stuff in this dialog is tabbable, add tabindex to any OK and
    // Cancel buttons, or they won't be tabbable.
    if ($dialog.find('[tabindex]:enabled:visible')) {
      $dialog.find('.ui-dialog-buttonpane .ui-button')
          .attr('tabindex', DEBIKI_TABINDEX_DIALOG_MAX);
    }

    // Move dialog into the <html> elem.
    var offs = $dialogFrame.offset();
    if (offs.left < 0 || offs.top < 0) {
      $dialogFrame.offset({
        left: Math.max(offs.left, 0),
        top: Math.max(offs.top, 0)
      });
    }

    $dialogFrame.dwScrollIntoView(
        { marginTop: 5, marginLeft: 5, marginRight: 5, duration: 0 });
  }
};


/**
 * Resets input fields on close.
 */
var jQueryDialogReset = $.extend({}, jQueryDialogDefault, {
  close: function() {
    $(this).find('input[type="text"], textarea')
        .val('').removeClass('ui-state-error');
  }
});


/**
 * Has no close button and doesn't close on Esc key.
 * Use if the user must click e.g. an OK button to close the dealog,
 * perhaps because of some event handler attached to that button.
 * E.g. a "You have been logged in. [OK]" dialog.
 */
var jQueryDialogNoClose = $.extend({}, jQueryDialogDefault, {
  closeOnEscape: false,
  open: function(event, ui) {
    jQueryDialogDefault.open.call(this, event, ui);
    $(this).parent().find('.ui-dialog-titlebar-close').hide();
  }
});


function mobileWidthOr(desktopWidth) {
  return Modernizr.touch ? jQueryDialogDefault.width : desktopWidth;
}


})();

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
