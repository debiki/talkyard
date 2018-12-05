/* The Stupid Lightbox.
 * Copyright (c) 2015 Kaj Magnus Lindberg
 * License: The MIT license. (this file only)
 */

//---------------------------------------------------------------
   (function() {
//---------------------------------------------------------------

var $overlay;
var $image;
var anySkipSelectors;

function createLightbox(elem, event) {
  // In case wrapped in an <a> tag, don't navigate away.
  event.preventDefault();

  // Abort if we're already showing a lightboxed image.
  if (debiki2.$all('.stupid-lightbox-image').length)
    return;

  if (!elem.classList.contains('stupid-lightbox-enlargeable'))
   return;

  $overlay = debiki2.$h.parseHtml('<div class="stupid-lightbox-overlay">')[0];
  $image = debiki2.$h.parseHtml(
      '<div class="stupid-lightbox-wrap">' +
        '<div class="stupid-lightbox-close"></div>' +
        '<img src="' + elem.src + '" class="stupid-lightbox-image">' +
      '</div>')[0];
  document.body.appendChild($overlay);
  document.body.appendChild($image);
}

function removeLightbox() {
  if ($image) {
    $overlay.remove();
    $image.remove();
    $overlay = null;
    $image = null;
  }
}

function highlight(elem) {
  if (elem.width < elem.naturalWidth || elem.height < elem.naturalHeight) {
    debiki2.$h.addClasses(elem, 'stupid-lightbox-enlargeable');
  }
}

function removeHighlight(elem) {
  debiki2.$h.addClasses(elem, 'stupid-lightbox-enlargeable');
}

window.StupidLightbox = {
  start: function(selectorBefore, skipSelectors) {
    var selector = (selectorBefore || '') + ' img';
    document.addEventListener('click', removeLightbox);
    debiki2.ifEventOnNotThen('click', selector, skipSelectors, createLightbox);
    debiki2.ifEventOnNotThen('mouseover', selector, skipSelectors, highlight);
    debiki2.ifEventOnNotThen('mouseleave', selector, skipSelectors, removeHighlight);
  }
};

//---------------------------------------------------------------
   })();
//---------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
