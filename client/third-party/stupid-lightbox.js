/* The Stupid Lightbox.
 * Copyright (c) 2015 Kaj Magnus Lindberg
 * License: The MIT license.
 */

//---------------------------------------------------------------
   (function() {
//---------------------------------------------------------------

var $overlay;
var $image;

function createLightbox(event) {
  // In case wrapped in an <a> tag, don't navigate away.
  event.preventDefault();

  // Abort if we're already showing a lightboxed image.
  if ($('.stupid-lightbox-image').length)
    return;

  if (!$(this).is('.stupid-lightbox-enlargeable'))
   return;

  $overlay = $($.parseHTML('<div class="stupid-lightbox-overlay">'));
  $image = $($.parseHTML(
      '<div class="stupid-lightbox-wrap">' +
        '<div class="stupid-lightbox-close"></div>' +
        '<img src="' + this.src + '" class="stupid-lightbox-image">' +
      '</div>'));
  $overlay.appendTo(document.body);
  $image.appendTo(document.body);
  $(document).on('click', removeLightbox);
}

function removeLightbox() {
  $overlay.remove();
  $image.remove();
  $overlay = null;
  $image = null;
  $(document).off('click', removeLightbox);
}

function highlight() {
  if (this.width < this.naturalWidth || this.height < this.naturalHeight) {
    $(this).addClass('stupid-lightbox-enlargeable');
  }
}

function removeHighlight() {
  $(this).removeClass('stupid-lightbox-enlargeable');
}

window.StupidLightbox = {
  start: function(selectorBefore, selectorAfter) {
    var selector = (selectorBefore || '') + ' img' + (selectorAfter || '');
    $(document).delegate(selector, 'click', createLightbox);
    $(document).delegate(selector, 'mouseenter', highlight);
    $(document).delegate(selector, 'mouseleave', removeHighlight);
  }
};

//---------------------------------------------------------------
   })();
//---------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
