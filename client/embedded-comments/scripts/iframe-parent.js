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


var d = { i: debiki.internal };


addEventListener('message', onMessage, false);


// Create <iframes> for Debiki embedded comments.
// Show a "Loading comments..." message until they've been loaded.
$('.debiki-embedded-comments').each(function() {
  var wrapper = $(this);
  var topicIdOrUrl = wrapper.attr('data-topic');
  if (!topicIdOrUrl) {
    // Don't include the hash fragment.
    topicIdOrUrl = window.location.origin + window.location.pathname + window.location.search;
  }
  var iframe = $('<iframe></iframe>');
  var iframePath = '/-/embedded/comments?topicIdOrUrl=' + topicIdOrUrl;
  var iframeUrl = d.i.debikiServerOrigin + iframePath;

  // Don't `hide()` the iframe, then FireFox acts as if it doesn't exist: FireFox receives
  // no messages at all from it.
  iframe
    .height(0) // don't `hide()`
    .width($(window).width())
    .css('border', 'none')
    .attr('seamless', 'seamless')
    .attr('src', iframeUrl);

  wrapper.append(iframe);
  wrapper.append($('<p>Loading comments...</p>'));
});


// Enable Utterscroll in parent window.
// Once the iframe has been loaded, Utterscroll will run in the iframe too,
// and the two Utterscroll instances will cooperate via `window.postMessage`.
jQuery(function($) {
  if (!Modernizr.touch) { // if not a smartphone
    d.i.initUtterscrollAndTips();
  }
});


function onMessage(event) {

  // The message is a "[eventName, eventData]" string because IE <= 9 doesn't support
  // sending objects.
  var eventName;
  var eventData;
  try {
    var json = JSON.parse(event.data);
    eventName = json[0];
    eventData = json[1];
  }
  catch (error) {
    // This isn't a message from Debiki.
    return;
  }

  switch (eventName) {
    case 'iframeInited':
      setIframeBaseAddress(findIframeThatSent(event));
      break;
    case 'setIframeSize':
      var iframe = $(findIframeThatSent(event));
      setIframeSize(iframe, eventData);
      // Remove "loading comments" message.
      iframe.parent().children(':not(iframe)').remove();
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
  iframe.contentWindow.postMessage(
      JSON.stringify(['setBaseAddress', window.location.href]), '*');
};


function setIframeSize(iframe, dimensions) {
  $(iframe).width(dimensions.width);
  $(iframe).height(dimensions.height);
};


function findIframeThatSent(event) {
  // See http://stackoverflow.com/a/18267415/694469
  var iframes = $('.debiki-embedded-comments iframe');
  for (var i = 0; i < iframes.length; ++i) {
    var iframe = iframes[i];
    if (iframe.contentWindow === event.source)
      return iframe;
  }
};


// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list
