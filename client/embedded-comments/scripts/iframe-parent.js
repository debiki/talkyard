/* Makes Debiki work in a child iframe.
 * Copyright (C) 2013-2014 Kaj Magnus Lindberg (born 1979)
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


// Find Debiki server origin, by extracting origin of the debiki-embedded-comments.js script.
// Then the website admin won't need to repeat the site id or address anywhere.
var debikiServerOrigin = (function() {
  var origin;
  $('script').each(function() {
    script = $(this);
    var srcAttr = script.attr('src');
    var isEmbeddedCommentsScript = srcAttr.search(/\/-\/debiki-embedded-comments.js/) !== -1;
    if (isEmbeddedCommentsScript) {
      origin = srcAttr.match(/^[^/]*\/\/[^/]+/)[0];
    }
  });
  if (!origin && console.error) {
    console.error(
      'Error extracting Debiki server origin, is there no "/-/debiki-embedded-comments.js" script?');
  }
  return origin;
})();


// Hide Debiki embedded comments iframes until they've been loaded,
// show "Loading comments..." message instead.
// Also add `src` and `seamless` attributs to Debiki embedded comments <iframe>s.
$('.debiki-embedded-comments')
  .hide()
  .before($('<p class="debiki-loading-comments-message">Loading comments...</p>'))
  .width($(window).width())
  .css('border', 'none')
  .attr('seamless', 'seamless')
  .each(function() {
    var iframe = $(this);
    var pageId = iframe.attr('data-topic-id');
    var iframePath = '/-/embed/comments/' + pageId;
    var iframeUrl = debikiServerOrigin + iframePath;
    iframe.attr('src', iframeUrl);
  });


// Enable Utterscroll in parent window.
// Once the iframe has been loaded, Utterscroll will run in the iframe too,
// and the two Utterscroll instances will cooperate via `window.postMessage`.
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
      var iframe = $(findIframeThatSent(event));
      iframe.show();
      setIframeSize(iframe, eventData);
      // Remove "loadin comments" message.
      // This currently removes that message for all <iframes> if there're more
      // than one. Doesn't matter much.
      iframe.parent().children('.debiki-loading-comments-message').remove();
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


// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list
