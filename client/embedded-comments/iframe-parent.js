/* Makes Debiki work in a child iframe.
 * Copyright (c) 2013-2014, 2017 Kaj Magnus Lindberg
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
var console = window.console || { log: function() {}};
console.log("iframe-parent: start");

var d = { i: debiki.internal };
var serverOrigin = d.i.commentsServerOrigin;

// Escape any hash fragment.
var embeddingUrl = window.location.origin + window.location.pathname + window.location.search;
var discussionId;

var theCommentsIframe;
var theEditorIframe;

addEventListener('scroll', messageCommentsIframeNewWinTopSize);
addEventListener('message', onMessage, false);


// Create <iframe>s for embedded comments and an embedded editor.
// Show a "Loading comments..." message until comments loaded.
// For now, choose the first .debiki-emdbedded-comments only, because
// the embedded editor will be bound to one page only, and two editors
// seems complicated.
var commentsElems = document.getElementsByClassName('ed-comments');
if (commentsElems.length) {
  var commentsElem = commentsElems[0];
  console.log("iframe-parent: found commentsElem");

  var embeddingUrlParam = 'embeddingUrl=' + embeddingUrl;

  discussionId = commentsElem.getAttribute('data-discussion-id');
  var discussionIdParam = discussionId ? '&discussionId=' + discussionId : '';

  var edPageId = commentsElem.getAttribute('data-ed-page-id');
  var edPageIdParam = edPageId ? '&edPageId=' + edPageId : '';

  var allUrlParams = embeddingUrlParam + discussionIdParam + edPageIdParam;
  var commentsIframeUrl = serverOrigin + '/-/embedded-comments?' + allUrlParams;
  // '/-' + pageId; // '/-29/testing-nested-comment-is-it-working-or-not';  // /-/pageId

  // Don't `hide()` the iframe, then FireFox acts as if it doesn't exist: FireFox receives
  // no messages at all from it.
  theCommentsIframe = Bliss.create('iframe', {
    id: 'ed-embedded-comments',
    height: 0, // don't `hide()` (see comment just above)
    style: {
      padding: 0,
      margin: 0,
      width: '100%',
      border: 'none'
    },
    seamless: 'seamless',
    src: commentsIframeUrl
  });

  Bliss.start(theCommentsIframe, commentsElem);
  console.log("iframe-parent: inserted theCommentsIframe");

  var loadingCommentsElem = Bliss.create('p', {
    id: 'ed-loading-comments',
    text: "Loading comments ..."
  });

  Bliss.start(loadingCommentsElem, commentsElem);

  var editorWrapper = Bliss.create('div', {
    id: 'ed-editor-wrapper',
    style: {
      display: 'none',
      width: '100%',
      // height will be set once opened.
      left: 0,
      position: 'fixed',
      bottom: 0,
      'box-sizing': 'content-box',
      cursor: 'ns-resize',
      boxShadow: 'rgba(0, 0, 0, 0.4) 0 0 32px 10px',
      background: 'hsl(0, 0%, 53%)',
      border: 'none',
      borderTop: '1px solid hsl(0, 0%, 78%)',
      padding: '8px 0 0 0',
      margin: 0
    }
  });

  Bliss.inside(editorWrapper, document.body);
  console.log("iframe-parent: inserted editorWrapper");

  var editorIframeUrl = serverOrigin + '/-/embedded-editor?' + allUrlParams;
  theEditorIframe = Bliss.create('iframe', {
    id: 'ed-embedded-editor',
    style: {
      display: 'block', // otherwise 'inline' —> some blank space below, because of descender spacing?
      padding: 0,
      margin: 0,
      width: '100%',
      height: '100%',
      border: 'none'
    },
    seamless: 'seamless',
    src: editorIframeUrl
  });

  Bliss.inside(theEditorIframe, editorWrapper);
  console.log("iframe-parent: inserted editorIframe");

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


function messageCommentsIframeNewWinTopSize() {
  var rect = theCommentsIframe.getBoundingClientRect();
  sendToComments('["iframeOffsetWinSize", {' +
      '"top":' + (-rect.top) + ', "height":' + window.innerHeight + '}]');
}


function onMessage(event) {
  // The message is a "[eventName, eventData]" string because IE <= 9 doesn't support
  // sending objects. CLEAN_UP COULD send a real obj nowadays, because we don't support IE 9 any more.
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
      console.log("iframe-parent: got 'iframeInited' message");
      var iframe = findIframeThatSent(event);
      setIframeBaseAddress(iframe);
      if (iframe === theCommentsIframe) {
        messageCommentsIframeNewWinTopSize();
      }
      break;
    case 'setIframeSize':
      var iframe = findIframeThatSent(event);
      setIframeSize(iframe, eventData);
      // Remove the "loading comments" info text.
      var loadingText = document.getElementById('ed-loading-comments');
      if (loadingText)
        loadingText.parentNode.removeChild(loadingText);
      break;
    case 'scrollComments':
      var rectToScrollIntoView = eventData[0];
      var options = eventData[1];
      scrollComments(rectToScrollIntoView, options);
      break;
      /* CLEAN_UP remove this
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
    case 'justLoggedIn':
      var iframe = findIframeThatSent(event);
      if (iframe === theCommentsIframe) {
        sendToEditor(event.data);
      }
      else {
        sendToComments(event.data);
      }
      break;
    case 'logoutClientSideOnly':
      var iframe = findIframeThatSent(event);
      if (iframe === theCommentsIframe) {
        sendToEditor(event.data);
        showEditor(false);
      }
      else {
        sendToComments(event.data);
      }
      break;
    case 'showEditor':
      showEditor(true);
      break;
    case 'hideEditor':
      showEditor(false);
      break;
    case 'maximizeEditor':
      setEditorMaximized(eventData);
      break;
    case 'minimizeEditor':
      setEditorMinimized(eventData);
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
      JSON.stringify(['setBaseAddress', {
        embeddingUrl: window.location.href,
        discussionId: discussionId
      }]), '*');
}


function setIframeSize(iframe, dimensions) {
  // Previously: iframe.style.width = dimensions.width + 'px'; — but now 2d scrolling disabled.
  iframe.style.height = dimensions.height + 'px';
  // Without min height, an annoying scrollbar might appear if opening the More menu.
  iframe.style.minHeight = 220;
}


function findIframeThatSent(event) {
  // See http://stackoverflow.com/a/18267415/694469

  var commentsIframe = document.getElementById('ed-embedded-comments');
  if (commentsIframe && commentsIframe.contentWindow === event.source)
    return commentsIframe;

  var editorIframe = document.getElementById('ed-embedded-editor');
  if (editorIframe && editorIframe.contentWindow === event.source)
    return editorIframe;
}


function sendToComments(message) {
  if (theCommentsIframe) {
    theCommentsIframe.contentWindow.postMessage(message, '*');
  }
}


function sendToEditor(message) {
  if (theEditorIframe) {
    theEditorIframe.contentWindow.postMessage(message, '*');
  }
}


function scrollComments(rectToScrollIntoView, options) {
  options.parent = document.body;
  var commentsIframe = document.getElementById('ed-embedded-comments');
  var iframeRect = commentsIframe.getBoundingClientRect();
  var rectWithOffset = {
    top: rectToScrollIntoView.top + iframeRect.top,
    bottom: rectToScrollIntoView.bottom + iframeRect.top,
    left: rectToScrollIntoView.left + iframeRect.left,
    right: rectToScrollIntoView.right + iframeRect.left
  };
  var coords = d.i.calcScrollRectIntoViewCoords(rectWithOffset, options);
  if (coords.needsToScroll) {
    smoothScroll(document.body, coords.desiredParentLeft, coords.desiredParentTop);
  }
}


var hasInitedEditorHeight = false;

function showEditor(show) {
  var placeholder = document.getElementById('ed-editor-placeholder');
  var editorWrapper = document.getElementById('ed-editor-wrapper');
  if (show) {
    editorWrapper.style.display = 'block';
    if (!hasInitedEditorHeight) {
      hasInitedEditorHeight = true;
      // Apparently this needs be done after display = 'block'.
      var initialHeight = Math.max(Math.min(300, window.innerHeight), window.innerHeight / 2.8);
      editorWrapper.style.height = initialHeight + 'px';
    }
    placeholder.style.display = 'block';
    placeholder.style.height = editorWrapper.clientHeight + 'px';
  }
  else {
    editorWrapper.style.display = 'none';
    placeholder.style.display = 'none';
    sendToComments('["clearIsReplyingMarks", {}]');
  }
}


var oldHeight;
var oldBorderTop;
var oldPaddingTop;

function setEditorMaximized(maximized) {
  var editorWrapper = document.getElementById('ed-editor-wrapper');
  if (maximized) {
    oldHeight = editorWrapper.style.height;
    oldBorderTop = editorWrapper.style.borderTop;
    oldPaddingTop = editorWrapper.style.paddingTop;
    editorWrapper.style.top = 0; // bottom is 0 already
    editorWrapper.style.height = 'auto';
    editorWrapper.style.borderTop = 'none';
    editorWrapper.style.paddingTop = 'none';
  }
  else {
    editorWrapper.style.top = 'auto';
    editorWrapper.style.height = oldHeight;
    editorWrapper.style.borderTop = oldBorderTop;
    editorWrapper.style.paddingTop = oldPaddingTop;
  }
}

function setEditorMinimized(minimized) {
  var editorWrapper = document.getElementById('ed-editor-wrapper');
  if (minimized) {
    oldHeight = editorWrapper.style.height;
    oldBorderTop = editorWrapper.style.borderTop;
    oldPaddingTop = editorWrapper.style.paddingTop;
    editorWrapper.style.height = 45 + 'px';  // works fine right now, August 2017
    editorWrapper.style.borderTop = 'none';
    editorWrapper.style.paddingTop = '0px';
  }
  else {
    editorWrapper.style.height = oldHeight;
    editorWrapper.style.borderTop = oldBorderTop;
    editorWrapper.style.paddingTop = oldPaddingTop;
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
  /*  This won't work, still steals mouse clicks/drags and starts selecting text "randomly".
  var newValue = cover ? 'none' : 'auto';
  var newVisibilityStyle = { style: {
    'pointer-events' : newValue,
    '-webkit-touch-callout': newValue, // iOS Safari
    '-webkit-user-select': newValue, // Safari
    '-khtml-user-select': newValue, // Konqueror HTML
    '-moz-user-select': newValue, // Firefox
    '-ms-user-select': newValue, // Internet Explorer/Edge
    'user-select': newValue
  }}; */
  var comments = document.getElementById('ed-embedded-comments');
  var editor = document.getElementById('ed-embedded-editor');
  Bliss.set(comments, newVisibilityStyle);
  Bliss.set(editor, newVisibilityStyle);
}


// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list
