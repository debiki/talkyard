/*
 * Copyright (c) 2013-2014, 2017-2019 Kaj Magnus Lindberg
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

 // TODO: if iframe not loaded within X seconds,
 // then show error, mention needs to upd  Allow embedding from:  ____
 // — how know if not loaded? Set timeout, wait for iframe-inited messge.

declare const debiki: any | undefined;
declare const Bliss: any | undefined;
declare const smoothScroll: any;

interface WindowWithTalkyardProps {
  talkyardDebug: boolean | number | undefined;
  edRemoveCommentsAndEditor: () => void;
  edReloadCommentsAndEditor: () => void;
  talkyardRemoveCommentsAndEditor: () => void;
  talkyardReloadCommentsAndEditor: () => void;
}

// Seems need to add  import * as ...  and import  embedding-page.d.ts [052MKHGJw3]
// to be able to add fields to `window` — but then also need to add a bundler
// like Parcel (see commit 2284759b01e9aa "Bundle ES6 libs with Parcel" in
// branch origin/topic-events) so  `import ...` works — *lots* of changes.
// For now, instead:
const windowWithTalkyardProps: WindowWithTalkyardProps = <any> window;


// Default to logging debug messages, for now, because people send screenshots of the
// console when sth is amiss, and nice to get the log messages then.
const debugLog: (...args) => void =
    (windowWithTalkyardProps.talkyardDebug === false ||
        windowWithTalkyardProps.talkyardDebug === 0 ||
        !window.console)
    ? function() {}
    : function() {
      // Clone the function arguments array.
      var args = [].slice.call(arguments);
      // Add a prefix to the 1st arg, the actuall message.
      // (Subsequent args could be an exception to log, who knows.)
      var arg0 = args[0];
      arg0 = "Talkyard comments: " + arg0;
      args.splice(0, 1, arg0);
      // And log the message.
      console.log.apply(console, args);
    };

debugLog("Starting... (disable logging by setting talkyardDebug = false)");

var d = { i: debiki.internal };
var serverOrigin = d.i.commentsServerOrigin;

// HTTPS problem? Talkyard must use HTTPS, if the blog uses HTTPS,
// otherwise there'll be an insecure-content-blocked error.
// If not http, then it must be https, right? Or '//' which is ok, will
// use the same protocol as the blog.
const iframeIsHttps = serverOrigin.indexOf('http://') === -1;
const blogIsHttps = location.origin.indexOf('https://') >= 0;
const insecureContenError = blogIsHttps && !iframeIsHttps;
const insecureContentErrorMessage = !insecureContenError ? '' : (
    "PROBLEM: This website uses HTTPS but your Talkyard server uses HTTP. " +
    "Most browsers therefore won't show the Talkyard blog comments iframe, " +
    "and they'll log an 'insecure content blocked' error. " +
    "— You need to configure your Talkyard server to use HTTPS. [TyEEMBHTTPS]");
if (insecureContentErrorMessage) {
  debugLog(insecureContentErrorMessage);
}

var oneTimeLoginSecret;
var postNrToFocus;

var commentsIframe;
var commentsIframeInited;  // dupl, remove, use Arr instead (contents dyn upd)
var commentsIframeInitedArr = [false];
var editorIframe;
var editorIframeInitedArr = [false];
var editorWrapper;
var editorPlaceholder;

// We store a weak session in localStorage, if 3rd party cookies disabled.
// It's fairly ok to use localStorage in our case, see:
//   ../../docs/session-in-local-storage.md
//
// [NOCOOKIES] [weaksid] ADD_TO_DOCS The session is (will be) "weak", in
// the sense that, even if you're admin, you cannot use it to go to the admin area
// and do things there. Then instead you need to login directly to the Talkyard
// server, rather than on the embedding site via the iframe — so an XSS
// vulnerability on the embedding site (the blog) cannot give admin access.
var theStorage = localStorage;

addEventListener('scroll', messageCommentsIframeNewWinTopSize);
addEventListener('message', onMessage, false);


function loadCommentsCreateEditor() {
  debugLog("loadCommentsCreateEditor()");
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
  debugLog("found commentsElem");

  var embeddingUrl = window.location.origin + window.location.pathname + window.location.search;
  var embeddingUrlParam = 'embeddingUrl=' + embeddingUrl;

  var discussionTitle = commentsElem.getAttribute('data-iframe-title');
  var htmlClass = commentsElem.getAttribute('data-iframe-html-class');

  // The discussion id might include a bit weird chars — it might have been imported
  // from WordPress or Ghost or Disqus [52TKRG40], and e.g. WordPress.com inserted spaces
  // in their ids — which can have gotten imported to Disqus, and now from Disqus to Ty.
  // But at least don't allow newlines and tabs? That'd probably be some weird bug?
  var discussionId = commentsElem.getAttribute('data-discussion-id');
  if (/[\t\r\n]/.test(discussionId)) {
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
  var htmlClassParam = htmlClass ? '&htmlClass=' + htmlClass : '';

  var allUrlParams = edPageIdParam + discussionIdParam + embeddingUrlParam + htmlClassParam;
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
  debugLog("inserted commentsIframe");

  if (insecureContentErrorMessage) {
    const insecureContentErrorElem = Bliss.create('div', {
      textContent: insecureContentErrorMessage,
      style: {
        padding: '20px',
        margin: '20px 10px',
        width: 'calc(100% - 60px)',  // (20 + 10) * 2 = 60
        background: 'hsl(0,100%,33%)', // dark red
        color: 'yellow',
        fontWeight: 'bold',
      },
    });
    Bliss.start(insecureContentErrorElem, commentsElem);
  }

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
  debugLog("inserted editorWrapper");

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
  debugLog("inserted editorIframe");

  findOneTimeLoginSecret();
  findCommentToScrollTo();
  makeEditorResizable();
}


function removeCommentsAndEditor() {
  debugLog("removeCommentsAndEditor()");
  if (commentsIframe) {
    commentsIframe.remove();
    commentsIframe = null;
    commentsIframeInited = false;
    commentsIframeInitedArr = [false];
  }
  if (editorIframe) {
    editorIframe.remove();
    editorIframe = null;
    editorWrapper.remove();
    editorWrapper = null;
    editorIframeInitedArr = [false];
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
  // Dupl code (6029084583).
  // Remove this; reuse sendToIframeImpl instead?

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

  // If the iframe extends below the lower window edge, we see only the part of it
  // down to `window.innerHeight` (then, don't use `rect.bottom`).
  var height = Math.min(window.innerHeight, rect.bottom);

  // If the iframe starts above the upper window edge, we don't see the parts of it above 0 (zero).
  // And if it starts below the upper window edge, then, `rect.top` is where it starts.
  var iframeVisibleHeight = height - Math.max(0, rect.top);

  sendToComments('["iframeOffsetWinSize",' +
      '{ "top":' + (-rect.top) +  // why did I negate?
      ', "height":' + height +    // rename 'height'? but to what? Maybe 'iframeVisibleBottom'?
      ', "iframeVisibleHeight": ' + iframeVisibleHeight + '}]');
}


// Tells the iframe js code to scroll postNr into view, which it'll do by sending back a message to this
// code here in the main win, with info about how to scroll — because the actuall scrolling is done
// here in the main win.
function messageCommentsIframeToMessageMeToScrollTo(postNr) {
  sendToComments(['scrollToPostNr', postNr]);
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

  const iframe = findIframeThatSent(event);

  let assertIsFromEditorToComments = function() {};
  let assertIsFromCommentsToEditor = function() {};
  // @ifdef DEBUG
  assertIsFromEditorToComments = function() {
    if (iframe !== editorIframe) {
      debugLog(`Bad msg dir [TyEMSGDIR1]: '${eventName}', ${JSON.stringify(eventData)}`);
      debugger;
    }
  };
  assertIsFromCommentsToEditor = function() {
    if (iframe !== commentsIframe) {
      debugLog(`Bad msg dir [TyEMSGDIR2]: '${eventName}', ${JSON.stringify(eventData)}`);
      debugger;
    }
  };
  // @endif

  switch (eventName) {
    case 'iframeInited':
      debugLog("got 'iframeInited' message");

      if (iframe !== commentsIframe) {
        editorIframeInitedArr = [true];
        return;
      }

      debugLog("it's the comments iframe");
      commentsIframeInited = true;
      commentsIframeInitedArr = [true];

      // Any comment to scroll into view?
      //
      // If we want to scroll to & highlight a post: The post is inside the iframe and we don't
      // know where. So tell the iframe to send back a 'scrollComments' message to us,
      // with info about how to scroll.
      //
      // (Could wait until after has resumed any old session? See below. Barely matters.)
      //
      if (postNrToFocus) {
        messageCommentsIframeToMessageMeToScrollTo(postNrToFocus);
      }

      // Can we login? Already logged in?
      //
      if (oneTimeLoginSecret) {
        // Tell the comments iframe to login, using our one-time secret.  [306KUD244]
        sendToComments(`["loginWithOneTimeSecret", "${oneTimeLoginSecret}"]`);
      }
      else {
        // Resume any old session.
        //
        // The comments iframe will message us back if we can log in / are logged in,
        // and then we'll tell the editor iframe about that,
        // and we'll also remember the session again. (3548236)
        //
        // However, if the login fails (e.g. account suspended or self-deleted),
        // then we won't remember the session again — so that after page reload,
        // any resume-session error message won't re-appear.
        //
        var sessionStr;
        try {
          sessionStr = theStorage.getItem('talkyardSession');
          theStorage.removeItem('talkyardSession');  // see above (3548236)
        }
        catch (ex) {
          debugLog(`Error getting 'talkyardSession' from theStorage [TyEGETWKSID]`, ex);
        }
        if (sessionStr) {
          try {
            const session = JSON.parse(sessionStr);
            sendToComments(`["resumeWeakSession", "${session.weakSessionId}"]`);
          }
          catch (ex) {
            debugLog(
                `Error parsing 'talkyardSession', this: "${sessionStr}" [TyEPARSEWKSID]`, ex);
          }
        }
      }
      break;
    case 'setIframeSize':
      setIframeSize(iframe, eventData);
      // The comments iframe wants to know the real win dimensions, so it can position modal
      // dialogs on screen. But wait until the iframe has been resized — because if
      // the iframe bottom after the above resize, is higher up than the window bottom,
      // then that'd reduce the height we send to the iframe.
      if (iframe === commentsIframe) {
        setTimeout(messageCommentsIframeNewWinTopSize);
      }
      // Remove the "loading comments" info text.
      var loadingText = document.getElementById('ed-loading-comments');
      if (loadingText)
        loadingText.parentNode.removeChild(loadingText);
      break;
    case 'scrollToPostNr':
      // The comments iframe will calculate the rectangle to scroll into view,
      // and then reply with a 'scrollComments' message, because the actual scrolling
      // needs to happen here in the parent frame.
      sendToComments(event.data);
      break;
    case 'scrollComments':   // RENAME to 'scrollCommentsIframe'?
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
      try {
        const item = {
          pubSiteId: eventData.pubSiteId,
          weakSessionId: eventData.weakSessionId,
        };
        const isUndef = item.weakSessionId === 'undefined'; // this'd be a bug elsewhere
        if (!item.weakSessionId || isUndef) {
          debugLog(`weakSessionId missing [TyE0WKSID]: ${JSON.stringify(eventData)}`);
          if (isUndef) {
            debugger;
          }
        }
        else {
          // This re-inserts our session (3548236), if we just sent a 'resumeWeakSession'
          // message to the iframe and then removed it from theStorage  — because
          // the comments iframe sends back 'justLoggedIn', after having logged in.
          theStorage.setItem('talkyardSession', JSON.stringify(item));
        }
      }
      catch (ex) {
        debugLog(`Error setting 'talkyardSession' in  theStorage [TyESETWKSID]`, ex);
      }
      if (iframe === commentsIframe) {
        sendToEditor(event.data);
      }
      else {
        sendToComments(event.data);
      }
      break;
    case 'logoutClientSideOnly':
      try {
        theStorage.removeItem('talkyardSession');
      }
      catch (ex) {
        debugLog(`Error removing 'talkyardSession' from  theStorage [TyERMWKSID]`, ex);
      }
      if (iframe === commentsIframe) {
        sendToEditor(event.data);
        showEditor(false);
      }
      else {
        sendToComments(event.data);
      }
      break;
    // Maybe remove this one, and use only 'showEditsPreview' instead, renamed to
    // 'showEditorAndPreview'?
    case 'onEditorOpen':
      assertIsFromEditorToComments();
      showEditor(true);
      sendToComments(event.data);
      break;
    case 'showEditsPreview':
      assertIsFromEditorToComments();
      sendToComments(event.data);
      break;
    case 'scrollToPreview':
      assertIsFromEditorToComments();
      sendToComments(event.data);
      break;
    case 'hideEditorAndPreview':
      assertIsFromEditorToComments();
      showEditor(false);
      sendToComments(event.data);
      break;
    case 'maximizeEditor':
      setEditorMaximized(eventData);
      break;
    case 'minimizeEditor':
      setEditorMinimized(eventData);
      break;
    case 'editorToggleReply':
      assertIsFromCommentsToEditor();
      sendToEditor(event.data);
      break;
    case 'handleReplyResult':
      assertIsFromEditorToComments();
      sendToComments(event.data);
      break;
    case 'editorEditPost':
      assertIsFromCommentsToEditor();
      sendToEditor(event.data);
      break;
    case 'handleEditResult':
      assertIsFromEditorToComments();
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


const pendingMainIframeMessages = [];

function sendToComments(message) {
  sendToIframeImpl(
      commentsIframe, commentsIframeInitedArr, pendingMainIframeMessages, message);
}


const pendingEditorIframeMessages = [];

function sendToEditor(message) {
  sendToIframeImpl(
      editorIframe, editorIframeInitedArr, pendingEditorIframeMessages, message);
}

function sendToIframeImpl(iframe, initedArr: boolean[], pendingMessages,
      message: any | null) {
  // Dupl code (6029084583).

  // Sometimes one iframe comes alive and wants to message the other one,
  // before that other iframe is ready.
  // [E2EBUG] it's not impossible that an e2e test browser super quickly clicks something,
  // before any pending message has been delivered?  This'd be harmless — would only
  // affect e2e tests; humans aren't that fast.
  if (message) {
    pendingMessages.push(message);
  }
  if (!initedArr[0]) {
    setTimeout(function() {
      sendToIframeImpl(iframe, initedArr, pendingMessages, null);
    }, 500);
    return;
  }
  for (let i = 0; i < pendingMessages.length; ++i) {
    const m = pendingMessages[i];
    iframe.contentWindow.postMessage(m, serverOrigin);
  }
  // Empty the array.
  pendingMessages.length = 0;
}


function findOneTimeLoginSecret() {
  // This need not be at the start of the hash fragment — but if there's anything before
  // or after, needs to be separated with one of [#&].
  var loginSecretHashMatch = window.location.hash.match(
      /[#&]talkyardOneTimeLoginSecret=([a-zA-Z0-9]+)([#&].*)?$/);
  if (loginSecretHashMatch) {
    oneTimeLoginSecret = loginSecretHashMatch[1];
    // Remove the login secret from the url, because it works only once — and if
    // someone copies the url with this soon-used-up secret in, the server
    // will reply Error and Talkyard would show an error message in the browser.
    debugLog("Found one time login secret, removing from url: " + oneTimeLoginSecret);
    // Maybe use history.replaceState({}, '', '# ...') instead?
    window.location.hash = window.location.hash.replace(
        'talkyardOneTimeLoginSecret=' + oneTimeLoginSecret, '');
  }
}


function findCommentToScrollTo() {
  var commentNrHashMatch = window.location.hash.match(/^#comment-(\d+)([#&].*)?$/);  // [2PAWC0]
  if (commentNrHashMatch) {
    var commentNrStr = commentNrHashMatch[1];
    var commentNr = parseInt(commentNrStr);
    // If the comment nr is > 1e6, something is amiss. Probably the #comment-NNN
    // url hash, is instead for a Disqus comment — which also happen to use
    // that same hash frag, for refering to a comment via the url, and their
    // comment ids are really large numbers, like 1e9.
    if (0 < commentNr && commentNr < 1e6) { // also see TooHighNumber, [05RKVJWG2]
      // The comment nr is post nr - 1  [2PAWC0].
      postNrToFocus = commentNr + 1;
    }
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

function showEditor(show: boolean) {
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
windowWithTalkyardProps.edRemoveCommentsAndEditor = removeCommentsAndEditor;  // old name [2EBG05]
windowWithTalkyardProps.edReloadCommentsAndEditor = loadCommentsCreateEditor; // old name [2EBG05]
windowWithTalkyardProps.talkyardRemoveCommentsAndEditor = removeCommentsAndEditor;
windowWithTalkyardProps.talkyardReloadCommentsAndEditor = loadCommentsCreateEditor;

// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list
