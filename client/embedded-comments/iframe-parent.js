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


// Create <iframe>s for embedded comments and an embedded editor.
// Show a "Loading comments..." message until comments loaded.
// For now, choose the first .debiki-emdbedded-comments only, because
// the embedded editor will be bound to one topic only, and two editors
// seems complicated.
$('.debiki-embedded-comments').first().each(function() {
  var wrapper = $(this);
  var topicId = wrapper.attr('data-topic-id');
  var topicUrl = wrapper.attr('data-topic-url');
  if (!topicUrl) {
    // Don't include the hash fragment.
    topicUrl = window.location.origin + window.location.pathname + window.location.search;
  }
  var topicIdUrlParam = topicId ? 'topicId=' + topicId : 'topicUrl=' + topicUrl;

  var commentsIframe = $('<iframe id="dw-embedded-comments"></iframe>');
  var commentsIframeUrl = d.i.debikiServerOrigin + '/-/embedded-comments?' + topicIdUrlParam;

  // Don't `hide()` the iframe, then FireFox acts as if it doesn't exist: FireFox receives
  // no messages at all from it.
  commentsIframe
    .height(0) // don't `hide()`
    .width($(window).width())
    .css('border', 'none')
    .attr('seamless', 'seamless')
    .attr('src', commentsIframeUrl);

  wrapper.append(commentsIframe);
  wrapper.append($('<p>Loading comments...</p>'));

  var editorIframe = $('<iframe id="dw-embedded-editor"></iframe>');
  var editorIframeUrl = d.i.debikiServerOrigin + '/-/embedded-editor?' + topicIdUrlParam;
  editorIframe
      .height(0) // don't `hide()`, or FF sends no messages
      .css('width', '100%')
      .css('left', 0)
      .css('position', 'fixed')
      .css('bottom', 0)
      .css('border', 'none')
      .attr('seamless', 'seamless')
      .attr('src', editorIframeUrl);
  $(document.body).append(editorIframe);

  var editorPlaceholder = $('<div id="dw-editor-placeholder"></div>');
  $(document.body).append(editorPlaceholder);
  editorPlaceholder.hide();
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
    case 'showEditor':
      showEditor(true);
      break;
    case 'hideEditor':
      showEditor(false);
      break;
    case 'editorToggleReply':
      sendToEditor(event.data);
      break;
    case 'handleReplyResult':
      sendToComments(event.data);
      break;
    case 'clearIsReplyingMarks':
      sendToComments(event.data);
      break;
    case 'editorEditPost':
      sendToEditor(event.data);
      break;
    case 'handleEditResult':
      sendToComments(event.data);
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
  var iframes = $('.debiki-embedded-comments iframe, #dw-embedded-editor');
  for (var i = 0; i < iframes.length; ++i) {
    var iframe = iframes[i];
    if (iframe.contentWindow === event.source)
      return iframe;
  }
};


function sendToComments(message) {
  var commentsWindow = document.getElementById("dw-embedded-comments").contentWindow;
  commentsWindow.postMessage(message, '*');
};


function sendToEditor(message) {
  var editorWindow = document.getElementById("dw-embedded-editor").contentWindow;
  editorWindow.postMessage(message, '*');
};


function showEditor(show) {
  var placeholder = $('#dw-editor-placeholder');
  var editor = $('#dw-embedded-editor');
  if (show) {
    placeholder.show();
    placeholder.height(300);
    editor.height(300);
  }
  else {
    placeholder.hide();
    // Don't hide() the editor, then it would receive no messages in FireFox.
    editor.height(0);
  }
}


// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list
