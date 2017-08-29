/* Makes Debiki's <iframe> behave like seamless=seamless iframes.
 * Copyright (c) 2013, 2017 Kaj Magnus Lindberg
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

if (d.i.isInEmbeddedCommentsIframe || d.i.isInEmbeddedEditor) {


addEventListener('message', onMessage, false);

window.parent.postMessage('["iframeInited", {}]', '*');

if (d.i.isInEmbeddedCommentsIframe)
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
      d.i.iframeBaseUrl = eventData.embeddingUrl;  // COULD remove? only d.i.embeddingUrl is enough?
      d.i.embeddingUrl = eventData.embeddingUrl;
      d.i.altPageId = eventData.discussionId;
      addBaseElem(eventData);
      break;
    case 'justLoggedIn':
      debiki2.ReactActions.setNewMe(eventData);
      break;
    case 'logoutClientSideOnly':
      // Sent from the comments iframe to the editor iframe, when one logs out in the comments iframe.
      debiki2.ReactActions.logoutClientSideOnly();
      break;
    case 'editorToggleReply':
      // This message is sent from an embedded comments page to the embedded editor.
      // It opens the editor to write a reply to `postId`.
      var postId = eventData;
      debiki2.editor.toggleWriteReplyToPost(postId, PostType.Normal);
      break;
    case 'handleReplyResult':
      // This message is sent from the embedded editor <iframe> to the comments
      // <iframe> when the editor has posted a new reply and the server has replied
      // with the HTML for the reply. `eventData` is JSON that includes this HTML;
      // it'll be inserted into the comments <iframe>.
      d.i.handleReplyResult(eventData);
      break;
    case 'clearIsReplyingMarks':
      // This is sent from the embedded editor to an embedded comments page.
      d.i.clearIsReplyingMarks();
      break;
    case 'editorEditPost':
      // Sent from an embedded comments page to the embedded editor.
      var postId = eventData;
      debiki2.ReactActions.editPostWithNr(postId);
      break;
    case 'handleEditResult':
      // This is sent from the embedded editor back to an embedded comments page.
      debiki2.ReactActions.handleEditResult(eventData);
      break;
    case 'iframeOffsetWinSize':
      debiki2.iframeOffsetWinSize = eventData;
      break;
  }
};


function addBaseElem(address) {
  // Insert at the top of <head>.
  var baseElem = debiki2.$h.parseHtml('<base href="' + address + '" target="_parent">')[0];
  Bliss.start(baseElem, Bliss('head'));
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
    // Don't use window.innerHeight — that'd be the size of the parent window, outside the iframe.
    // Don't use document.body.clientHeight — it might be too small, before iframe resized.
    var discussion = debiki2.$byId('dwPosts');
    var currentWidth = discussion.clientWidth;
    var currentHeight = discussion.clientHeight;
    if (lastWidth === currentWidth && lastHeight === currentHeight)
      return;

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


}
// vim: fdm=marker et ts=2 sw=2 list
