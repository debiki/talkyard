/* Makes Debiki's <iframe> behave like seamless=seamless iframes.
 * Copyright (C) 2013 Kaj Magnus Lindberg (born 1979)
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
var $ = d.i.$;


if (!d.i.isInIframe)
  return;


addEventListener('message', onMessage, false);

window.parent.postMessage('["iframeInited", {}]', '*');

syncDocSizeWithIframeSize();


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
    case 'setBaseAddress':
      addBaseElem(eventData);
      break;
  }
};


function addBaseElem(address) {
  var baseElem = $('<base href="' + address + '" target="_parent">');
  $('head').append(baseElem);
};


/**
 * Polls the document size and tells the parent window to resize this <iframe> if needed,
 * to avoid scrollbars.
 */
function syncDocSizeWithIframeSize() {
  var lastWidth = 0;
  var lastHeight = 0;
  setInterval(pollAndSyncSize, 100);

  function pollAndSyncSize() {
    var currentWidth = $(document).width();
    var currentHeight = $(document).height();
    if (lastWidth === currentWidth && lastHeight === currentHeight)
      return;

    // Add some margin.
    currentWidth += 80;
    currentHeight += 80;

    lastWidth = currentWidth;
    lastHeight = currentHeight;

    var message = JSON.stringify([
      'setIframeSize', {
        width: currentWidth,
        height: currentHeight
      }
    ]);

    window.parent.postMessage(message, '*');
  };
};


// vim: fdm=marker et ts=2 sw=2 list
