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

  if (!isNoPage(eds.embeddedPageId)) {
    const sessWin = getMainWin();
    if (sessWin.tydyn) {
      sessWin.tydyn.allIframePageIds.push(eds.embeddedPageId);
    }
  }

  window.parent.postMessage(
      JSON.stringify(['iframeInited', {}]),
      eds.embeddingOrigin);

  if (eds.isInEmbeddedCommentsIframe)
    syncDocSizeWithIframeSize();
}


function onMessage(event) {
  const isFromOtherFrame = event.origin === location.origin;
  if (event.origin !== eds.embeddingOrigin && !isFromOtherFrame)
    return;

  // The message is a "[eventName, eventData]" string because IE <= 9 doesn't support
  // sending objects.  But now we don't support IE9 any longer! [3056MSDJ1]
  var eventName;
  var eventData;
  try {
    var json = JSON.parse(event.data);
    eventName = json[0];
    eventData = json[1];
  }
  catch (error) {
    // Not from Talkyard.
    return;
  }

  // We can access other Ty frames  [many_embcom_iframes], but if the sender is
  // window.parent, we cannot access it — then, set to undefined.
  const fromFrame = isFromOtherFrame ? event.source : undefined;

  // If the embedding script's cache time hasn't yet expired, it might be
  // old and then don't show the editor (it too likely would malfunction).
  // Could move 2 to enums-and-constants.ts. [emb_scr_ver]
  const curScriptV = 2;
  if (eds.isInEmbeddedEditor && eds.embeddingScriptV !== curScriptV) {
    (fromFrame || window.parent).postMessage(
          JSON.stringify(['tooOldEmbeddingScript', {
            embeddingScriptV: eds.embeddingScriptV,
            curScriptV,
          }]),
          fromFrame ? location.origin : eds.embeddingOrigin);
    return;
  }

  switch (eventName) {
    case 'loginWithAuthnToken':
      // This gets sent to the first comments iframe only. [1st_com_frame]
      const authnToken = eventData;
      // REFACTOR to Authn.loginWithToken, calls Server and loadMyself()? [ts_authn_modl]
      Server.loginWithAuthnToken(authnToken, SessionType.AutoTokenSiteCustomSso,
              function() {
        // typs.weakSessionId should have been updated by the above login fn.
        ReactActions.loadMyself();  // later: skip [incl_me_in_aun_rsp]
      });

      break;
    case 'loginWithOneTimeSecret':
      // This gets sent to the first comments iframe only. [1st_com_frame]
      dieIf(!eds.isInEmbeddedCommentsIframe, 'TyE50KH4');
      const oneTimeLoginSecret = eventData;
      // REFACTOR to Authn.loginWithOneTimeSecret? [ts_authn_modl]
      Server.loginWithOneTimeSecret(oneTimeLoginSecret, function() {
        // REFACTOR call loadMyself() directly from loginWithOneTimeSecret().
        // typs.weakSessionId has been updated already by the above login fn.
        ReactActions.loadMyself();  // later: skip [incl_me_in_aun_rsp]
      });
      break;
    case 'resumeWeakSession':
      // This gets sent to the first comments iframe only. [1st_com_frame]
      dieIf(!eds.isInEmbeddedCommentsIframe, 'TyE305RK3');
      const pubSiteId = eventData.pubSiteId;
      if (eds.pubSiteId === pubSiteId) {
        // REFACTOR break out fn Authn.loginWithOldSession()?  [ts_authn_modl]
        const mainWin = debiki2.getMainWin();
        mainWin.typs.weakSessionId = eventData.weakSessionId;
        typs.weakSessionId = eventData.weakSessionId;
        // This sends 'justLoggedIn' to other iframes, so they'll get updated too.
        ReactActions.loadMyself(function(resp: FetchMeResponse) {
          if (resp.me) {
            // Maybe send 'justLoggedIn' from here, instead of from inside loadMyself()?
            // Can do after: [incl_me_in_aun_rsp].
            // For now, noop, here.
          }
          else {
            // This'll delete any session parts saved in cookies or  [forget_sid12]
            // browser storage — the session doesn't work anyway.
            ReactActions.logoutClientSideOnly({ msg: "Could not resume session [TyMSES0VLD]"});
          }
        });
      }
      else {
        // This session id won't work — it's for some other Talkyard site.
        // This happens if debugging and testing on localhost, deleting and
        // creating different Talkyard sites at the same something.localhost address.
      }
      break;
    case 'justLoggedIn':
      // The getMainWin().typs.weakSessionId has been updated already, by
      // makeUpdNoCookiesTempSessionIdFn() or in the 'case:' just above, lets check:
      // @ifdef DEBUG
      const mainWin: MainWin = getMainWin();
      if (!me_hasSid()) {
        logAndDebugDie(`justLoggedIn but not logged in? ` +
            `No session cookie, no typs.weakSessionId. ` +
            `This frame name: ${window.name}, ` +
            `main frame name: ${mainWin.name}, ` +
            `this is main frame: ${window === mainWin}, ` +
            `mainWin.typs: ${JSON.stringify(mainWin.typs)} [TyE60UKTTGL35]`);
      }
      // mainWin.theStore.me was updated by ReactActions.loadMyself():
      dieIf(!mainWin.theStore.me, 'justLoggedIn but mainWin.theStore.me missing [TyE406MR4E2]');
      dieIf(!eventData.user, 'justLoggedIn but user missing [TyE406MR4E3]');
      // DO_AFTER v0.2021.31:
      //dieIf(!eventData.stuffForMe, 'justLoggedIn but stuffForMe missing [TyE406MR4E4]');
      // Could assert present also in setNewMe() and loadMyself(), and change
      // param to cannot-be-undefined.
      // @endif
      ReactActions.setNewMe(eventData.user, eventData.stuffForMe);
      break;
    case 'logoutServerAndClientSide':
      Server.logoutServerAndClientSide();
      break;
    case 'logoutClientSideOnly':
      // Sent from the comments iframe one logged out in, to the editor iframe
      // and other comments iframes.
      ReactActions.logoutClientSideOnly({ skipSend: true });
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
      // This message is sent from a comments iframe to the editor iframe.
      // Will open the editor to write a reply to `postNr` in that comments iframe.
      var postNr = eventData[0];
      var inclInReply = eventData[1];
      var postType = eventData[2] ?? PostType.Normal;
      editor.toggleWriteReplyToPostNr(postNr, inclInReply, postType, fromFrame);
      break;
    case 'handleReplyResult':
      // This message is sent from the embedded editor <iframe> to the comments
      // <iframe> when the editor has posted a new reply and the server has replied
      // with the HTML for the reply. `eventData` is JSON that includes this HTML;
      // it'll be inserted into the comments <iframe>.
      ReactActions.handleReplyResult(eventData[0], eventData[1]);
      break;
    case 'editorEditPost':
      // Sent from a comments iframe to the editor iframe.
      var postNr = eventData;
      ReactActions.editPostWithNr(postNr, fromFrame);
      break;
    case 'onEditorOpen':
      // Sent from the embedded editor to all comment iframes, so they can
      // disable Reply and Edit buttons, since pat is already editing editing sth.
      ReactActions.onEditorOpen(eventData);
      break;
    case 'handleEditResult':
      // Sent from the editor iframe to the iframe with the edited comment.
      ReactActions.handleEditResult(eventData);
      break;
    case 'showEditsPreview':  // REMOVE DO_AFTER 2020-09-01 deprecated
    case 'showEditsPreviewInPage':
    case 'showEditsPreviewInDisc': // use instead?
      ReactActions.showEditsPreviewInPage(eventData);
      break;
    case 'scrollToPreview':
      ReactActions.scrollToPreview(eventData);
      break;
    case 'hideEditor':
      ReactActions.hideEditor();
      break;
    case 'hideEditorAndPreview':
      // This is sent from the embedded editor to an embedded comments page.
      ReactActions.hideEditorAndPreview(eventData);
      break;
    case 'tooOldEmbeddingScript':
      // Sent from the editor iframe to a comments iframe that says anything,
      // if the embedding script (on the embedding blog post page) are too old,
      // so the editor might not work. [embcom_upgr_0cache]
      // (The cache time is just 15 minutes, for this upgrade.)
      pagedialogs.getServerErrorDialog().openForBrowserError(
            "Try again in 15 minutes.\n\n" +
            "This server was recently upgraded. The changes will take effect " +
            "within 15 minutes — thereafter, you can post and edit comments again.\n\n" +
            "Details: " + JSON.stringify(eventData) + " [TyM04MWEJQ3]",
            { title: "Wait for a while" });
      /* Or, but won't appear in the middle:
      morebundle.openDefaultStupidDialog({
         body: ...
          });*/
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
    // 1) Don't use window.innerHeight — that'd be the size of the parent window,
    // outside the iframe.  2) Don't use document.body.clientHeight — it might be
    // too small, before iframe resized. 3) body.offsetHeight can be incorrect
    // if nested elems have margin-top.  But this works fine:  [iframe_height]
    var discussion = $byId('esPageColumn'); // <—— works for emb forums too?   was: 'dwPosts'
    var currentWidth = discussion.clientWidth;
    var currentDiscussionHeight = discussion.clientHeight;

    // Make space for any notf prefs dialog — it can be taller than the emb cmts
    // iframe height, before there're any comments. [IFRRESIZE]
    const anyDialog = $first('.esDropModal_content');
    let dialogHeightPlusPadding = 0;
    if (anyDialog) {
      const rect = anyDialog.getBoundingClientRect();
      dialogHeightPlusPadding = rect.bottom + 30;
      // Was: anyDialog.clientHeight + 30, but that didn't incl whitespace above.
    }

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
