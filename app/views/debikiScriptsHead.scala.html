@**
 * Copyright (c) 2013-2019 Kaj Magnus Lindberg
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
 *@

@(tpi: debiki.SiteTpi, siteId: Int, isInLoginWindow: Boolean, isInLoginPopup: Boolean,
  isAdminApp: Boolean, reactStoreSafeJsonString: String, minMaxJs: String, minMaxCss: String)

@import tpi.globals
@import com.debiki.core.PageType.InfoPageMaxId
@import com.debiki.core.PageType.EmbeddedComments
@import org.owasp.encoder.Encode

@discussionIdOrUndefined = @{
  tpi.anyDiscussionId.map(id => s"'${ Encode.forJavaScript(id) }'") getOrElse "undefined"
}

@lazyCreatePageInCatId = @{
  tpi.lazyCreatePageInCatId.map((id: Int) => s"${id}") getOrElse "undefined"
}

@embeddingUrlOrUndefined = @{
  tpi.anyEmbeddingUrl.map(url => s"'${ Encode.forJavaScript(url) }'") getOrElse "undefined"
}

@embeddingOriginOrUndefined = @{
  tpi.anyEmbeddingOrigin.map(url => s"'${ Encode.forJavaScript(url) }'") getOrElse "undefined"
}

@isInLoginWindowBoolStr = @{
  if (isInLoginWindow) "true" else "false"
}

@isInLoginPopupBoolStr = @{
  if (isInLoginPopup) "true" else "false"
}

@testNowMs = @{
  tpi.anyTestNowMs match {
    case None => "undefined"
    case Some(nowMs) => nowMs
  }
}

<script id="theVolatileJson" type="application/json">
@* Here we place quickly changing data and user specific data. Note that
this tag is placed before #thePageJson below, so if e.g. a comment contains
the below magic string then that won't matter because we replace only the very first
occurrence of the magic string with volatile + user specific data. [8BKAZ2G] *@
@Html(controllers.ViewPageController.HtmlEncodedVolatileJsonMagicString)
</script>

<script id="thePageJson" type="application/json">
@* Play Framework escapes too much (it escapes '"'), so use @Html and OWASP instead. *@
@Html(Encode.forHtmlContent(reactStoreSafeJsonString))
</script>

@* All Debiki's stuff is placed somewhere inside `debiki`.
 - The debiki.scriptLoad $.Deferred is resolved later by debiki.js.
 - Use $.extend in case any window.opener has already specified some
   debiki.v0 callbacks. (Example: an admin page specifies an
   on-save callback, to be notified when a newly created page is saved.)
*@
<script>
@* This <html> class helps us avoid flashes-of-whatever. (Moderinzr won't run until later.) *@
var _doc = document.documentElement;
_doc.className += ' js';

@* So that we can avoid iOS CSS bugs, and the-iPhone-keyboard-covers-half-the-screen problems. *@
var _ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
var _iphone = _ios && /iPhone|iPod/.test(navigator.userAgent);
if (_ios) _doc.className += ' ios';@* RENAME to s_ios so can grep & find, & for naming consistency. *@
if (_iphone) _doc.className += ' s_iphone';

@* See https://stackoverflow.com/a/1912522/694469. The <div> isn't added to the document
 so no <script> would be executed. — But yes it would indeed?
 Test this in Dev Tools:
   document.createElement('div').innerHTML =
      '<img src=http://broken.example.com onerror=alert(1337)>';
 the image will be requested, that fails, so the script runs.
 (See http://stackoverflow.com/a/430240/694469)
 However, we have already escaped the HTML, so any < are already escaped and will be
 converted back to text only. Search for "Encode.forHtmlContent" above.
 *@
function _unencodeHtmlContent(escapedHtml) {
  var elem = document.createElement('div');
  elem.innerHTML = escapedHtml;
  var result = '';
  @* Chrome splits innerHTML into many child nodes, each one at most 65536. Whereas
  FF creates just one single huge child node. *@
  for (var i = 0; i < elem.childNodes.length; ++i) {
    result = result + elem.childNodes[i].nodeValue;
  }
  return result;
}

var _store = JSON.parse(_unencodeHtmlContent(document.getElementById('thePageJson').text));
var _volatileData = JSON.parse(_unencodeHtmlContent(document.getElementById('theVolatileJson').text)) || {};
var _me = _volatileData.me || _store.me || {};@* also used when constructing routes [7UKWBA2] *@

@* [4GKRW02] *@
var _pageId = _store.currentPageId;
var _cp = _store.pagesById[_pageId];
_store.currentPage = _cp; @* Is set to {} in the embedded editor [2BK4P3R] *@


var _isInIframe;
try { _isInIframe = window.self !== window.top; }
catch (e) { _isInIframe = true; }

var _isInEmbCmtsIframe = (_cp || {}).pageRole === @{ EmbeddedComments.toInt } && _isInIframe;

@* This css class hides the topbar and sidebars — they'd be confusing in an embedded
blog comments discussion section.  COULD RENAME to s_InEmbCmtsIframe ? *@
if (_isInEmbCmtsIframe) _doc.className += ' s_InIframe';

@* In FF, in an embedded comments iframe, this error might happen, when doing getItem(..):  [7IWD20ZQ1]
  "SecurityError: The operation is insecure"
This happens if the user has disabled cookies from third-party websites: the iframe isn't
the website being visited, so cookies are blocked, and apparently FF then also blocks localStorage.
See: https://bugzilla.mozilla.org/show_bug.cgi?id=1233964
Just ignore localStorage then, not so important anyway. *@
function _getLocal(what) {
  var result;
  try { result = localStorage.getItem(what); }
  catch (ignored) {}
  return result;
}

var _hideIntro = _getLocal('hideForumIntro');
_store.hideForumIntro = _hideIntro && _hideIntro !== 'false';
if (_store.hideForumIntro) {
  _doc.className += ' dw-hide-forum-intro';
}

var _narrow = window.innerWidth < 780 || _ios;@* dupl constant, see ReactStore.ts [5YKT42] *@
if (_narrow) {
  _doc.className += ' esSidebarsOverlayPage';
  _store.shallSidebarsOverlayPage = true;
}

@* This lets an embedding page, e.g. a blog post, add a CSS class to the HTML tag,
so the embedding page can change the colors, e.g. use a dark or a bright theme —
which might be per user customizable over at the blog. Won't work in IE: no URL object.
COULD use a polyfill: https://github.com/ungap/url-search-params,
see: https://stackoverflow.com/a/979995/694469  for more details. *@
try {
  var _searchParams = new URLSearchParams(location.search);
  var _class = _searchParams.get('htmlClass');
  if (_class) {
    _doc.className += ' ' + _class.replace(/[^a-zA-Z0-9_-]/g, ' ');
  }
}
catch (ignored) {
}

@* Show the watchbar, unless we're on an info page. But do show it, if it's open already,
 also on info pages. Otherwise people get confused when they click a recent page in the
 watchbar, and then it (the watchbar) just disappears (closes). *@
var _infoPage = !_cp || !_cp.pageRole || _cp.pageRole <= @InfoPageMaxId;

@* The watchbar = important, because quickly sees new direct messages / chat messages, +
recent topic list (which is very useful). Try to show it, always, if screen wide enough.
iPad pro = 1366 wide; then, always watchbar = OK *@
var edAlwaysWatchbar = !_infoPage && window.innerWidth > 1350;

var _wbOpen = _getLocal('isWatchbarOpen');
var _queryHideWb = location.search.search('&hideWatchbar') >= 0;
var _showWb = false;
if (_store.isEmbedded) {
  @* Don't show the watchbar in the embedded comments iframe. *@
}
else if (_store.settings.watchbarStartsOpen === false) {
  _showWb = _wbOpen === 'true' && !_narrow && !_queryHideWb;
}
else if ((_wbOpen !== 'false' && !_narrow && !_queryHideWb && (
    !_infoPage || _wbOpen === 'true')) || edAlwaysWatchbar) {
  _showWb = true;
}
if (_showWb) {
  _doc.className += ' es-watchbar-open';
  _store.isWatchbarOpen = true;
}

@* Hide the contextbar  by default, or new users will be overwhelmed by everything there is
to see. But do show the Admin Getting Started Guide (it's in the sidebar [8YKFW32]) for
new admins. *@
var _cbOpen = _getLocal('isContextbarOpen');
var _showAdmGuide = _getLocal('showAdminGuide') !== 'false' && _me.isAdmin &&
      !_store.isEmbedded && _cbOpen !== 'false' && !_me.isEmbeddedCommentsSite;
if (_showAdmGuide || (!_narrow && _cbOpen === 'true' &&
    location.search.search('&hideContextbar') === -1)) {
  _doc.className += ' es-pagebar-open';
  _store.isContextbarOpen = true;
}

@* EffectiveDiscussions Static data = 'eds', RENAME to 'tys' (Talkyard static)
 is included in the initial response from the server.
 Add an entry in server-vars.d.ts whenever adding sth here. [5JWKA27]
 CLEAN_UP REFACTOR: Move everything that affects server side rendering to the store instead; [7AKBQ2]
  having it here is a bit error prone: need to init when rendering server side too, dupl code.
 And make eds = undefined when type checking server side, to catch buggy access. *@
var eds = {
  pubSiteId: '@tpi.pubSiteId',
  siteId: @siteId,@* LATER remove in Prod mode [5UKFBQW2] *@
  currentVersion: '@tpi.currentVersionString',
  cachedVersion: '@tpi.cachedVersionString',
  wantsServiceWorker: @{ globals.config.useServiceWorker },
  useServiceWorker: @{ globals.config.useServiceWorker } && ('serviceWorker' in navigator),
  secure: @{globals.secure},
  pageDataFromServer: _store,
  volatileDataFromServer: _volatileData,
  isDev: @{ if (globals.isDev) "true" else "false" },
  testNowMs: @testNowMs,
  minMaxJs: '@minMaxJs',
  debugOrigin: '@{tpi.httpsColonOrEmpty}//@tpi.serverAddress',@* [INLTAGORIG] *@
  cdnOriginOrEmpty: '@{tpi.cdnOrigin getOrElse ""}',
  cdnOrServerOrigin: '@tpi.cdnOrServerOrigin',@* for admin page embedded comments code *@
  isIos: _ios,
  isInLoginWindow: @isInLoginWindowBoolStr,
  isInLoginPopup: @isInLoginPopupBoolStr,
  isInIframe: _isInIframe,
  isInEmbeddedCommentsIframe: _isInEmbCmtsIframe,
  isInAdminArea: @{ if (isAdminApp) "true" else "false" },
  isRtl: @{ if (tpi.isRtlLanguage) "true" else "false" },
  embeddingOrigin: @Html(embeddingOriginOrUndefined),
  embeddingUrl: @Html(embeddingUrlOrUndefined),
  embeddedPageId: _isInIframe ? _pageId : undefined,
  embeddedPageAltId: @Html(discussionIdOrUndefined),
  lazyCreatePageInCatId: @Html(lazyCreatePageInCatId),
  assetUrlPrefix: '@tpi.assetUrlPrefix',
  uploadsUrlPrefixCommonmark: '@tpi.uploadsUrlPrefix',
  isTestSite: @{ tpi.site.isTestSite.toString },
  loadGlobalAdminScript: @{ tpi.globals.loadGlobalAdminScript.toString },
  loadGlobalStaffScript: @{ tpi.globals.loadGlobalStaffScript.toString },
  mainWorkUntilSecs: @{ tpi.globals.mainWorkUntilSecs getOrElse 0 }
};

@* Backw compat CLEAN_UP convert old js code in these 'namespaces' to Typescript instead [4KSWPY]
  RENAME to tyd ("Talkyard Dynamic" things, like is-sth-ready promises?, remove 'internal' and 'v0' *@
var debiki = { internal: {}, v0: { util: {}} };

@* Talkyard per page load session data (if we avoid cookies). [NOCOOKIES]   rename to  tyd?  see above *@
var typs = {
  xsrfTokenIfNoCookies: _volatileData.xsrfTokenIfNoCookies,
  canUseCookies: navigator.cookieEnabled
};

@* API, for custom scripts, e.g. MathJax. Type declaration in model.ts [5ABJH72]. *@
var talkyard = {};
</script>

