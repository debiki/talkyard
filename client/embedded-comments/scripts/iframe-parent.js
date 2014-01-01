/* Makes Debiki work in a child iframe.
 * Copyright (C) 2010 - 2012 Kaj Magnus Lindberg (born 1979)
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


// Some files assume this has been defined:
window.debiki. internal = {};
window.debiki.v0 = { util: {} };


addEventListener('message', onMessage, false);

$('.debiki-embedded-comments').width($(window).width());


jQuery(function($) {
  if (!Modernizr.touch) { // if not a smartphone
    debiki.Utterscroll.enable();
  }
});


function onMessage(event) {
  var eventName = event.data[0];
  var eventData = event.data[1];
  switch (eventName) {
    case 'iframeInited':
      setIframeBaseAddress(findIframeThatSent(event));
      break;
    case 'setIframeSize':
      setIframeSize(findIframeThatSent(event), eventData);
      break;
    case 'startUtterscrolling':
      debiki.Utterscroll.startScrolling(eventData);
      break;
    case 'onMouseMove':
    case 'doUtterscroll':
      debiki.Utterscroll.doScroll(eventData);
      break;
    case 'stopUtterscrolling':
      debiki.Utterscroll.stopScrolling(eventData);
      break;
  }
};


function setIframeBaseAddress(iframe) {
  iframe.contentWindow.postMessage(['setBaseAddress', window.location.href], '*');
};


function setIframeSize(iframe, dimensions) {
  $(iframe).width(dimensions.width);
  $(iframe).height(dimensions.height);
};


function findIframeThatSent(event) {
  // See http://stackoverflow.com/a/18267415/694469
  var iframes = document.getElementsByClassName('debiki-embedded-comments');
  for (var i = 0; i < iframes.length; ++i) {
    var iframe = iframes[i];
    if (iframe.contentWindow === event.source)
      return iframe;
  }
};


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
