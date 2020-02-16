/* Makes Debiki's <iframe> behave like seamless=seamless iframes.
 * Copyright (c) 2013, 2017-2018 Kaj Magnus Lindberg
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

/// <reference path="prelude.ts" />

//------------------------------------------------------------------------------
   namespace debiki2 {
//------------------------------------------------------------------------------


export function startIframeMessages() {
  addEventListener('message', onMessage, false);

  window.parent.postMessage(
      JSON.stringify(['iframeInited', {}]),
      eds.embeddingOrigin);

  if (eds.isInEmbeddedCommentsIframe)
    syncDocSizeWithIframeSize();
}


function onMessage(event) {
  if (event.origin !== eds.embeddingOrigin)
    return;

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
    case 'loginWithOneTimeSecret':
      dieIf(!eds.isInEmbeddedCommentsIframe, 'TyE50KH4');
      const oneTimeLoginSecret = eventData;
      Server.loginWithOneTimeSecret(oneTimeLoginSecret, function() {
        // typs.weakSessionId has been updated already by the above login fn.
        ReactActions.loadMyself();
      });
      break;
    case 'resumeWeakSession':
      dieIf(!eds.isInEmbeddedCommentsIframe, 'TyE305RK3');
      typs.weakSessionId = eventData;
      // This will send 'justLoggedIn' to the editor iframe, so it'll get updated too.
      ReactActions.loadMyself();
      break;
    case 'justLoggedIn':
      // The getMainWin().typs.weakSessionId has been updated already, by
      // makeUpdNoCookiesTempSessionIdFn() or in the 'case:' just above, lets check:
      // @ifdef DEBUG
      const mainWin: MainWin = getMainWin();
      if (!mainWin.typs.weakSessionId && !getSetCookie('dwCoSid')) {
        logAndDebugDie(`Not really logged in? No cookie, no typs.weakSessionId. ` +
            `This frame name: ${window.name}, ` +
            `main frame name: ${mainWin.name}, ` +
            `this is main frame: ${window === mainWin}, ` +
            `typs: ${JSON.stringify(mainWin.typs)} [TyE60UKTTGL35]`);
      }
      // @endif
      ReactActions.setNewMe(eventData.user);
      break;
    case 'logoutClientSideOnly':
      // Sent from the comments iframe to the editor iframe, when one logs out in the comments iframe.
      ReactActions.logoutClientSideOnly();
      break;
    case 'scrollToPostNr':  // rename to loadAndShowPost  ? + add  anyShowPostOpts?: ShowPostOpts
      var postNr = eventData;
      debiki.scriptLoad.done(function() {
        var pageId = ReactStore.getPageId();
        if (!pageId || pageId === EmptyPageId) {
          // Embedded comments discussion not yet lazy-created, so there's no post to scroll to.
          // (Probably someone accidentally typed an url that ends with '#comment-1' for example,
          // maybe when testing something.)
          return;
        }
        ReactActions.loadAndShowPost(postNr);
      });
      break;
    case 'editorToggleReply':
      // This message is sent from an embedded comments page to the embedded editor.
      // It opens the editor to write a reply to `postId`.
      var postNr = eventData[0];
      var inclInReply = eventData[1];
      var postType = eventData[2] ?? PostType.Normal;
      editor.toggleWriteReplyToPostNr(postNr, inclInReply, postType);
      break;
    case 'handleReplyResult':
      // This message is sent from the embedded editor <iframe> to the comments
      // <iframe> when the editor has posted a new reply and the server has replied
      // with the HTML for the reply. `eventData` is JSON that includes this HTML;
      // it'll be inserted into the comments <iframe>.
      ReactActions.handleReplyResult(eventData[0], eventData[1]);
      break;
    case 'editorEditPost':
      // Sent from an embedded comments page to the embedded editor.
      var postNr = eventData;
      ReactActions.editPostWithNr(postNr);
      break;
    case 'onEditorOpen':
      // Sent from the embedded editor to the comments iframe.
      ReactActions.onEditorOpen(eventData);
      break;
    case 'handleEditResult':
      // This is sent from the embedded editor back to an embedded comments page.
      ReactActions.handleEditResult(eventData);
      break;
    case 'showEditsPreview':
      ReactActions.showEditsPreview(eventData);
      break;
    case 'scrollToPreview':
      ReactActions.scrollToPreview(eventData);
      break;
    case 'hideEditorAndPreview':
      // This is sent from the embedded editor to an embedded comments page.
      ReactActions.hideEditorAndPreview(eventData);
      break;
    case 'iframeOffsetWinSize':
      debiki2.iframeOffsetWinSize = eventData;
      break;
    case 'patchTheStore':
      ReactActions.patchTheStore(eventData);
      break;
  }
}


/**
 * Polls the document size and tells the parent window to resize this <iframe> if needed,
 * to avoid scrollbars.
 */
function syncDocSizeWithIframeSize() {
  var lastWidth = 0;
  var lastHeight = 0;
  setInterval(pollAndSyncSize, 250);

  function pollAndSyncSize() {
    // Don't use window.innerHeight — that'd be the size of the parent window, outside the iframe.
    // Don't use document.body.clientHeight — it might be too small, before iframe resized.
    var discussion = $byId('dwPosts');
    var currentWidth = discussion.clientWidth;
    var currentDiscussionHeight = discussion.clientHeight;

    // Make space for any notf prefs dialog — it can be taller than the emb cmts
    // iframe height, before there're any comments. [IFRRESIZE]
    const anyDialog = $first('.esDropModal_content');
    const dialogHeightPlusPadding = anyDialog ? anyDialog.clientHeight + 30 : 0;

    const currentHeight = Math.max(currentDiscussionHeight, dialogHeightPlusPadding);

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

    window.parent.postMessage(message, eds.embeddingOrigin);
  }
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------

// vim: fdm=marker et ts=2 sw=2 list
