/*
 * Copyright (c) 2013-2014, 2017-2018 Kaj Magnus Lindberg
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

// Default to logging debug messages, for now, because people send screenshots of the
// console when sth is amiss, and nice to get the log messages then.
var debugLog = window.talkyardDebug === false || window.talkyardDebug === 0 || !window.console ?
    function() {} : window.console.log;

debugLog("iframe-parent: start (disable logging by setting talkyardDebug = false)");

var d = { i: debiki.internal };
var serverOrigin = d.i.commentsServerOrigin;

var postNrToFocus;

var commentsIframe;
var commentsIframeInited;
var editorIframe;
var editorWrapper;
var editorPlaceholder;

addEventListener('scroll', messageCommentsIframeNewWinTopSize);
addEventListener('message', onMessage, false);


function loadCommentsCreateEditor() {
  debugLog("iframe-parent: loadCommentsCreateEditor()");
  // Create <iframe>s for embedded comments and an embedded editor.
  // Show a "Loading comments..." message until comments loaded.
  // For now, choose the first .talkyard-comments only, because
  // the embedded editor will be bound to one page only, and two editors
  // seems complicated.
  var commentsElems = document.getElementsByClassName('ed-comments'); // old name [2EBG05]
  if (!commentsElems.length)
    commentsElems = document.getElementsByClassName('talkyard-comments');
  if (!commentsElems.length)
    return;
  var commentsElem = commentsElems[0];
  debugLog("iframe-parent: found commentsElem");

  var embeddingUrl = window.location.origin + window.location.pathname + window.location.search;
  var embeddingUrlParam = 'embeddingUrl=' + embeddingUrl;

  var discussionTitle = commentsElem.getAttribute('data-iframe-title');

  var discussionId = commentsElem.getAttribute('data-discussion-id');
  if (/[#?& \t\n]/.test(discussionId)) {
    var errorMessage = "Bad discussion id: " + discussionId + ' [EdE8UKWB4]';
    debugLog(errorMessage);
    throw Error(errorMessage);
  }
  var discussionIdParam = discussionId ? 'discussionId=' + discussionId + '&' : '';

  var edPageId = commentsElem.getAttribute('data-ed-page-id'); // old name [2EBG05]
  if (!edPageId) {
    edPageId = commentsElem.getAttribute('data-talkyard-page-id');
  }
  var edPageIdParam = edPageId ? 'edPageId=' + edPageId + '&' : '';

  var allUrlParams = edPageIdParam + discussionIdParam + embeddingUrlParam;
  var commentsIframeUrl = serverOrigin + '/-/embedded-comments?' + allUrlParams;
  var loadWeinre = window.location.hash.indexOf('&loadWeinre') >= 0;  // [WEINRE]
  if (loadWeinre) {
    // Let's append the whole hash fragment — nice to see any client "name"
    // you can debug-include in the hash, in Weinre's debug targets list.
    commentsIframeUrl += location.hash;
  }

  // Don't `hide()` the iframe, then FireFox acts as if it doesn't exist: FireFox receives
  // no messages at all from it.
  commentsIframeInited = false;
  commentsIframe = Bliss.create('iframe', {
    id: 'ed-embedded-comments',
    name: 'edComments',
    // A title attr, for better accessibility. See: https://www.w3.org/TR/WCAG20-TECHS/H64.html
    title: discussionTitle || "Comments",
    src: commentsIframeUrl,
    height: 0, // don't `hide()` (see comment just above)
    style: {
      padding: 0,
      margin: 0,
      width: '100%',
      border: 'none',
      overflow: 'hidden'
    },
    allowtransparency: 'true',
    frameborder: 0,
    scrolling: 'no',
    horizontalscrolling: 'no',
    verticalscrolling: 'no'
  });

  Bliss.start(commentsIframe, commentsElem);
  debugLog("iframe-parent: inserted commentsIframe");

  var loadingCommentsElem = Bliss.create('p', {
    id: 'ed-loading-comments',
    text: "Loading comments ..."
  });

  Bliss.start(loadingCommentsElem, commentsElem);

  editorWrapper = Bliss.create('div', {
    id: 'ed-editor-wrapper',
    style: {
      display: 'none',
      width: '100%',
      // The height will be set once opened.
      left: 0,
      position: 'fixed',
      // Some websites have sidebars with z-index > 0. Try to place the editor above them,
      // otherwise parts of the editor will be obscured by the sidebars.
      // Bootstrap's modal's z-index is 1040 by default (at least was in the past)
      // so stay < 1040.
      'z-index': 1000,
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
  debugLog("iframe-parent: inserted editorWrapper");

  var editorIframeUrl = serverOrigin + '/-/embedded-editor?' + allUrlParams;
  if (loadWeinre) {
    editorIframeUrl += location.hash;
  }

  editorIframe = Bliss.create('iframe', {
    id: 'ed-embedded-editor',
    name: 'edEditor',
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

  Bliss.inside(editorIframe, editorWrapper);
  debugLog("iframe-parent: inserted editorIframe");

  findCommentToScrollTo();
  makeEditorResizable();
}


function removeCommentsAndEditor() {
  debugLog("iframe-parent: removeCommentsAndEditor()");
  if (commentsIframe) {
    commentsIframe.remove();
    commentsIframe = null;
    commentsIframeInited = false;
  }
  if (editorIframe) {
    editorIframe.remove();
    editorIframe = null;
    editorWrapper.remove();
    editorWrapper = null;
  }
}


// Editor placeholder, so the <iframe> won't occlude the lower parts of the page.
function createEditorPlaceholder() {
  editorPlaceholder = Bliss.create('div', {
    id: 'ed-editor-placeholder',
    display: 'none'
  });
  Bliss.inside(editorPlaceholder, document.body);
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
  if (!commentsIframe) {
    // Not yet created, or maybe got deleted by some other Javascript.
    return;
  }

  // Wait until the <iframe> is "alive".
  // Posting a message when the html <iframe> has been created but before it's been fully
  // loaded, as of 2019-03 makes Chrome send the message to this parent frame instead,
  // resulting in errors like these in the dev console:
  //
  //   Failed to execute 'postMessage' on 'DOMWindow': The target origin
  //   provided ('https://comments-for-the-blog-address.talkyard.net') does not match
  //   the recipient window's origin ('https://the-blog-address.com').
  //
  // Explanation: postMessage tried to send to https://comments-for... (the target origin) but
  // instead Chrome sent the message to the main window https://the-blog-address
  // (the recipient origin).
  //
  // This error typically does not happen on localhost, because then the iframe loads
  // quickly. Instead, it happens in production, sometimes only. To reproduce, on localhost,
  // set a breakpoint in the app server, in EmbeddedTopicsController.showTopic [5BRW02],
  // to block the iframe from loading, and then you can reproduce this error.
  //
  if (!commentsIframeInited) {
    setTimeout(messageCommentsIframeNewWinTopSize, 1000);
    return;
  }

  var rect = commentsIframe.getBoundingClientRect();
  // We're interested in the height part of the viewport that is used for the iframe.
  var height = Math.min(window.innerHeight, rect.bottom);
  sendToComments('["iframeOffsetWinSize", {' +
      '"top":' + (-rect.top) + ', "height":' + height + '}]');
}


// Tells the iframe js code to scroll postNr into view, which it'll do by sending back a message to this
// code here in the main win, with info about how to scroll — because the actuall scrolling is done
// here in the main win.
function messageCommentsIframeToMessageMeToScrollTo(postNr) {
  sendToComments('["scrollToPostNr", ' + postNr + ']');
}


function onMessage(event) {
  if (!commentsIframe) return;

  // The message is a "[eventName, eventData]" string because IE <= 9 doesn't support
  // sending objects. CLEAN_UP COULD send a real obj nowadays, because we don't support IE 9 any more.
  // Should add a date for when the browser cached js file that assumes type string expires —
  // it's cached for a year. Then, after a year, this if === 'string' can eventually be removed and
  // js objects, instead of strings, can be used. DO_AFTER 2019-03-01 maybe? Today is 2018-01-03.
  var eventName;
  var eventData;
  try {
    if (typeof event.data === 'string') {
      var json = JSON.parse(event.data);
      eventName = json[0];
      eventData = json[1];
    }
    else {
      eventName = event.data[0];
      eventData = event.data[1];
    }
  }
  catch (error) {
    // This message isn't for us.
    return;
  }

  // COULD REFACTOR: Actually, child iframes can message each other directly;
  // need not send via the parent.

  var iframe;

  switch (eventName) {
    case 'iframeInited':
      debugLog("iframe-parent: got 'iframeInited' message");
      iframe = findIframeThatSent(event);
      if (iframe === commentsIframe) {
        commentsIframeInited = true;
        // If we want to scroll to & highlight a post: The post is inside the iframe and we don't
        // know where. So tell the iframe to send back a 'scrollComments' message to us,
        // with info about how to scroll.
        if (postNrToFocus) {
          messageCommentsIframeToMessageMeToScrollTo(postNrToFocus);
        }
      }
      break;
    case 'setIframeSize':  // COULD rename to sth like setIframeSizeAndMaybeScrollToPost
      iframe = findIframeThatSent(event);
      setIframeSize(iframe, eventData);
      // The comments iframe wants to know the real win dimensions, so it can position modal
      // dialogs on screen. But wait until the iframe has been resized — because if
      // the iframe bottom, is higher up than the window bottom, then that'd reduce
      // the height we send to the iframe.
      if (iframe === commentsIframe) {
        setTimeout(messageCommentsIframeNewWinTopSize);
      }
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
      iframe = findIframeThatSent(event);
      if (iframe === commentsIframe) {
        sendToEditor(event.data);
      }
      else {
        sendToComments(event.data);
      }
      break;
    case 'logoutClientSideOnly':
      iframe = findIframeThatSent(event);
      if (iframe === commentsIframe) {
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


function setIframeSize(iframe, dimensions) {
  // Previously: iframe.style.width = dimensions.width + 'px'; — but now 2d scrolling disabled.
  iframe.style.height = dimensions.height + 'px';
  // Without min height, an annoying scrollbar might appear if opening the More menu.
  // Or sometimes directly, also without opening the More menu.
  iframe.style.minHeight = 280;
}


function findIframeThatSent(event) {
  // See http://stackoverflow.com/a/18267415/694469
  if (commentsIframe && commentsIframe.contentWindow === event.source)
    return commentsIframe;
  if (editorIframe && editorIframe.contentWindow === event.source)
    return editorIframe;
}


function sendToComments(message) {
  if (commentsIframe) {
    commentsIframe.contentWindow.postMessage(message, serverOrigin);
  }
}


function sendToEditor(message) {
  if (editorIframe) {
    editorIframe.contentWindow.postMessage(message, serverOrigin);
  }
}


function findCommentToScrollTo() {
  var commentNrHashMatch = window.location.hash.match(/^#comment-(\d+)$/);  // [2PAWC0]
  if (commentNrHashMatch) {
    var commentNrStr = commentNrHashMatch[1];
    var commentNr = parseInt(commentNrStr);
    postNrToFocus = commentNr + 1;  // comment nr = post nr - 1  [2PAWC0]
  }
}


function scrollComments(rectToScrollIntoView, options) {
  // For a discussion about using <html> or <body>, see:
  // https://stackoverflow.com/questions/19618545/
  //    body-scrolltop-vs-documentelement-scrolltop-vs-window-pagyoffset-vs-window-scrol
  // COULD use  window.scrollY instead, that's maybe more future compatible,
  // see: https://stackoverflow.com/a/33462363/694469
  options.parent = document.documentElement.scrollTop ? document.documentElement : document.body;
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
  if (show) {
    editorWrapper.style.display = 'block';
    if (!hasInitedEditorHeight) {
      hasInitedEditorHeight = true;
      // Apparently this needs be done after display = 'block'.
      var initialHeight = Math.max(Math.min(300, window.innerHeight), window.innerHeight / 2.8);
      editorWrapper.style.height = initialHeight + 'px';
    }
    editorPlaceholder.style.display = 'block';
    editorPlaceholder.style.height = editorWrapper.clientHeight + 'px';
  }
  else {
    editorWrapper.style.display = 'none';
    editorPlaceholder.style.display = 'none';
    sendToComments('["clearIsReplyingMarks", {}]');
  }
}


var oldHeight;
var oldBorderTop;
var oldPaddingTop;

function setEditorMaximized(maximized) {
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


createEditorPlaceholder();
loadCommentsCreateEditor();

// Some static sites, like Gatsby.js, don't reload whole pages, instead they load json, un/re-mount
// React componets and do history.push, to render the new page. Then a way is needed
// to load the comments for the new URL.
window.edRemoveCommentsAndEditor = removeCommentsAndEditor;  // old name [2EBG05]
window.edReloadCommentsAndEditor = loadCommentsCreateEditor; // old name [2EBG05]
window.talkyardRemoveCommentsAndEditor = removeCommentsAndEditor;
window.talkyardReloadCommentsAndEditor = loadCommentsCreateEditor;

// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list
