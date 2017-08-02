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

var theIframe;

// Create <iframe>s for embedded comments and an embedded editor.
// Show a "Loading comments..." message until comments loaded.
// For now, choose the first .debiki-emdbedded-comments only, because
// the embedded editor will be bound to one topic only, and two editors
// seems complicated.
var embeddedCommentsElems = document.getElementsByClassName('debiki-embedded-comments');
if (embeddedCommentsElems.length) {
  var embElem = embeddedCommentsElems[0];
  //var wrapper = $(this);  // !
  var topicId = embElem.getAttribute('data-topic-id');
  var topicUrl = embElem.getAttribute('data-topic-url');
  if (!topicUrl) {
    // Don't include the hash fragment.
    topicUrl = window.location.origin + window.location.pathname + window.location.search;
  }
  var topicIdUrlParam = topicId ? 'topicId=' + topicId : 'topicUrl=' + topicUrl;
  var commentsIframeUrl = d.i.debikiServerOrigin +  //   + '/-/embedded-comments?' + topicIdUrlParam;
      '/-29/testing-nested-comment-is-it-working-or-not';

  // Don't `hide()` the iframe, then FireFox acts as if it doesn't exist: FireFox receives
  // no messages at all from it.
  theIframe = Bliss.create('iframe', {
    id: 'ed-embedded-comments',
    height: 0, // don't `hide()` (see comment just above)
    style: {
      border: 'none',
      width: '100%'
    },
    seamless: 'seamless',
    src: commentsIframeUrl
  });

  Bliss.start(theIframe, embElem);
  /*

  wrapper.append(commentsIframe);
  wrapper.append($('<p>Loading comments...</p>'));
  */

  var editorWrapper = Bliss.create('div', {
    id: 'ed-editor-wrapper',
    style: {
      border: 'none',
      width: '100%',
      height: 350,
      left: 0,
      position: 'fixed',
      bottom: 0,
      'border-top': '8px solid #888',
      cursor: 'ns-resize',
      background: 'white',
      display: 'none'
    }
  });

  Bliss.inside(editorWrapper, document.body);

  var editorIframeUrl = d.i.debikiServerOrigin + '/-/embedded-editor?' + topicIdUrlParam;
  var editorIframe = Bliss.create('iframe', {
    id: 'ed-embedded-editor',
    style: {
      border: 'none',
      width: '100%',
      height: '100%',
      border: 'none'
    },
    seamless: 'seamless',
    src: editorIframeUrl
  });

  Bliss.inside(editorIframe, editorWrapper);

  // Editor placeholder, so the <iframe> won't occlude the lower parts of the page.
  var editorPlaceholder = Bliss.create('div', {
    id: 'ed-editor-placeholder',
    display: 'none'
  });
  Bliss.inside(editorPlaceholder, document.body);

  makeEditorResizable();
}


/* Enable Utterscroll in parent window.
// Once the iframe has been loaded, Utterscroll will run in the iframe too,
// and the two Utterscroll instances will cooperate via `window.postMessage`.
jQuery(function($) {   // xx
  if (!Modernizr.touch) { // if not a smartphone
    d.i.initUtterscrollAndTips();
  }
}); */



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
      var iframe = findIframeThatSent(event);
      setIframeSize(iframe, eventData);
      // Remove "loading comments" message.
      //iframe.parent().children(':not(iframe)').remove();
      break;
      /*
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
      */
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
}


function setIframeBaseAddress(iframe) {
  iframe.contentWindow.postMessage(
      JSON.stringify(['setBaseAddress', window.location.href]), '*');
}


function setIframeSize(iframe, dimensions) {
  // Add 50px margin, otherwise for some reason there'll be scrollbars-y.
  // Previously: iframe.style.width = dimensions.width + 'px'; — but now 2d scrolling disabled.
  iframe.style.height = (dimensions.height + 50) + 'px';
}


function findIframeThatSent(event) {
  // See http://stackoverflow.com/a/18267415/694469

  var commentsIframe = document.getElementById('ed-embedded-comments');
  if (commentsIframe.contentWindow === event.source)
    return commentsIframe;

  var editorIframe = document.getElementById('ed-embedded-editor');
  if (editorIframe.contentWindow === event.source)
    return editorIframe;
}


function sendToComments(message) {
  var commentsWindow = document.getElementById("ed-embedded-comments").contentWindow;
  commentsWindow.postMessage(message, '*');
};


function sendToEditor(message) {
  var editorWindow = document.getElementById("ed-embedded-editor").contentWindow;
  editorWindow.postMessage(message, '*');
};


function showEditor(show) {
  var placeholder = document.getElementById('ed-editor-placeholder');
  var editorWrapper = document.getElementById('ed-editor-wrapper');
  if (show) {
    //var displayBlock = { style: { display: 'block' }};
    //Bliss.set(editorWrapper, displayBlock);
    //Bliss.set(placeholder, displayBlock);
    editorWrapper.style.display = 'block';
    placeholder.style.display = 'block';
    placeholder.style.height = editorWrapper.clientHeight + 'px';
  }
  else {
    editorWrapper.style.display = 'none';
    placeholder.style.display = 'none';
    //var displayNone = { style: { display: 'none' }};
    //Bliss.set(editorWrapper, displayNone);
    //Bliss.set(placeholder, displayNone);
    sendToComments('["clearIsReplyingMarks", {}]');
  }
}


function makeEditorResizable() {
  var editorPlaceholder = document.getElementById('ed-editor-placeholder');
  var editorWrapper = document.getElementById('ed-editor-wrapper');
  editorWrapper.addEventListener('mousedown', startDrag);

  var startY = 0;
  var startHeight = 0;

  function startDrag(event) {
    coverIframesSoWontStealMouseEvents(true);
    startY = event.clientY;
    startHeight = editorWrapper.clientHeight;
    document.documentElement.addEventListener('mousemove', doDrag, false);
    document.documentElement.addEventListener('mouseup', stopDrag, false);
  }

  function doDrag(event) {
    var newHeight = startHeight - event.clientY + startY;
    editorPlaceholder.style.height = newHeight + 'px';
    editorWrapper.style.height = newHeight + 'px';
  }

  function stopDrag(event) {
    coverIframesSoWontStealMouseEvents(false);
    document.documentElement.removeEventListener('mousemove', doDrag, false);
    document.documentElement.removeEventListener('mouseup', stopDrag, false);
  }
}


function coverIframesSoWontStealMouseEvents(cover) {
  var newVisibilityStyle = { style: { visibility: cover ? 'hidden' : 'visible' }};
  var comments = document.getElementById('ed-embedded-comments');
  var editor = document.getElementById('ed-embedded-editor');
  Bliss.set(comments, newVisibilityStyle);
  Bliss.set(editor, newVisibilityStyle);
}


// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list
