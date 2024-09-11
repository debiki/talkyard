/*
 * Copyright (c) 2013-2014, 2017-2021 Kaj Magnus Lindberg
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

/// <reference path="comments-count.ts" />
/// <reference path="../app-slim/constants.ts" />


declare const debiki: any | undefined;
declare const Bliss: any | undefined;
declare function smoothScroll(elem: Element, x: number, y: number,
    durationMs?: number, onDone?: () => void);

// Why do we prefix everything with `talkyard` instead of placing in a `talkyard: {...}`
// object?  It's for developer & support friendliness:
// - If websearching for any of these functions, one will find Talkyard's docs
//   & discussions, and no off-topic things from unrelated software.
// - Someone A who helps sbd else B with getting blog comments working, can know
//   that B is indeed talking about a Talkyard function, and not something B
//   has created themselves (which could have been slightly unclear if B
//   said e.g. "authnToken" instead of "talkyardAuthnToken").
interface WindowWithTalkyardProps {
  talkyardLogLevel?: Nr;
  talkyardDebug: boolean | number | undefined; // deprecated 2020-06-16
  talkyardAuthnToken?: St | Ay;
  talkyardConsiderQueryParams?: St[];
  edRemoveCommentsAndEditor: () => void;  // deprecated
  edReloadCommentsAndEditor: () => void;  //
  talkyardRemoveCommentsAndEditor: () => void;
  talkyardReloadCommentsAndEditor: () => void;
  talkyardAddCommentsIframe: (ps: { appendInside: HElm, discussionId: St }) => HElm;
  talkyardForgetRemovedCommentIframes: () => Vo;
}

// Later: SSO and HMAC via https://pasteo.io? https://paseto.io/rfc/  [blog_comments_sso]
// User json:
// <script>
// // Page global data:
// takyardData = "pasteo:...";  // json, incl user sso fields, PASTEO signed/encrypted
// </script>
//
// And per comments section config in html attr:
// <div class="talkyard-comments" data-talkyard="pasteo:...">


// Seems need to add  import * as ...  and import  embedding-page.d.ts [052MKHGJw3]
// to be able to add fields to `window` — but then also need to add a bundler
// like Parcel (see commit 2284759b01e9aa "Bundle ES6 libs with Parcel" in
// branch origin/topic-events) so  `import ...` works — *lots* of changes.
// For now, instead:
const windowWithTalkyardProps: WindowWithTalkyardProps = <any> window;


// Talkyard's log levels:  [ty_log_levels]
// off, fatal, partly-fatal, error, warn, info, config, debug, trace, annoying
//   0,   1–9,           1x,    2x,   3x,   4x,     5x,    6x,    7x,       8x
const winLogLvl = windowWithTalkyardProps.talkyardLogLevel;
const winDbg = windowWithTalkyardProps.talkyardDebug; // deprecated
const urlLogLvl = new URLSearchParams(location.hash.substring(1)).get('talkyardLogLevel');
const talkyardLogLevel: Nr | St =
        urlLogLvl || (
        (typeof winLogLvl !== 'undefined') ? winLogLvl : (
            winDbg === false || winDbg === 0 ? 'warn' : 'trace'));

// Default to logging debug messages, for now, because people send screenshots of the
// console when sth is amiss, and nice to get the log messages then.
function makeTalkyardLogFn(forLevel: Nr, consoleLogFn: (...data: Ay[]) => Vo) {
  // For now, so at least 'warn' and 'info' works, as per the "disable logging by ..."
  // comment below.
  const skipInfo  = !talkyardLogLevel || talkyardLogLevel === 'warn';
  const skipDebug = !talkyardLogLevel || talkyardLogLevel === 'info';
  if (skipInfo && forLevel >= 40 || skipDebug && forLevel >= 50 || !window.console)
    return function() {};

  return function logFn(..._arguments) {
    // Clone the function arguments array.
    const args = [].slice.call(arguments);
    // Add a prefix to the 1st arg, the actuall message.
    // (Subsequent args could be an exception to log, who knows.)
    let arg0 = args[0];
    arg0 = "Talkyard comments: " + arg0;
    args.splice(0, 1, arg0);
    // And log the message.
    consoleLogFn.apply(console, args);
  }
}

// const logT =
const logD = makeTalkyardLogFn(65, console.debug);
const logM = makeTalkyardLogFn(45, console.log);
const logW = makeTalkyardLogFn(35, console.warn);
const logE = makeTalkyardLogFn(25, console.error);

// const j2s = JSON.stringify;

logM(`Starting ${TalkyardVersion} ... ` +
      `(disable logging by setting talkyardLogLevel = 'warn' or 'info')`);


const d = { i: debiki.internal };
const serverOrigin = d.i.commentsServerOrigin;


// HTTPS problem? Talkyard must use HTTPS, if the blog uses HTTPS,
// otherwise there'll be an insecure-content-blocked error.
// If not http, then it must be https, right? Or '//' which is ok, will
// use the same protocol as the blog.
const iframeIsHttps = serverOrigin.indexOf('http://') === -1;
const blogIsHttps = location.origin.indexOf('https://') >= 0;
const insecureTyIframeProbl = blogIsHttps && !iframeIsHttps;
//const insecureBlogProbl = !blogIsHttps && iframeIsHttps;

const insecureSomethingErrMsg = insecureTyIframeProbl ? (
    "PROBLEM: This website uses HTTPS but your Talkyard server uses HTTP. " +
    "Most browsers therefore won't show the Talkyard blog comments iframe, " +
    "and they'll log an 'insecure content blocked' error. " +
    "— You need to configure your Talkyard server to use HTTPS. [TyEINSCIFR]") : (
      /*
        insecureBlogProbl ? (
    "PROBLEM: This website uses HTTP but your Talkyard server uses HTTPS. " +
    "This browser therefore might not show the Talkyard blog comments iframe. " +
    "— If this is your site, what if you get a LetsEncrypt cert? [TyEINSCBLG]"
        ) : */  '');

const considerQueryParams = windowWithTalkyardProps.talkyardConsiderQueryParams;

// For automatic Single Sign-On with PASETO authn tokens, either in a variable,
// or a cookie (cookie better? So not incl in html, although encrypted).
const authnTokenInVar = windowWithTalkyardProps.talkyardAuthnToken;
const authnTokenCookieMatches: St[] | Nl = (
        document.cookie.match(
            // (There're no spaces in PASETO tokens.)
            /(^|;)\s*__Host-TalkyardAuthnToken\s*=\s*([^\s;]+)/) ||
        // Backw compat. Remove later? [ty_v1]
        document.cookie.match(
                   /(^|;)\s*TalkyardAuthnToken\s*=\s*([^\s;]+)/));
const authnTokenInCookie: StV = authnTokenCookieMatches ? authnTokenCookieMatches[2] : null;

if (authnTokenInCookie) {
  // Delete, these should be one time tokens [stop_emb_aun_tkn_rply],
  // and shouldn't linger after pat has logged out from the embedd*ing* website.
  // https://stackoverflow.com/questions/2144386/how-to-delete-a-cookie
  document.cookie = 'TalkyardAuthnToken=; Max-Age=0; path=/';
}

if (authnTokenInVar) {
  logM(`Found authn token in js var`);
}
if (authnTokenInCookie) {
  logM(`Found authn token in cookie`);
}

const differentTokens =
        authnTokenInVar && authnTokenInCookie && authnTokenInVar !== authnTokenInCookie;
if (differentTokens) {
  logW(`Authn token in var and cookie differs, ignoring both [TyEAUTKNDIF]`);
}

const autnToken: StV = differentTokens ? null : authnTokenInVar || authnTokenInCookie;

if (insecureSomethingErrMsg) {
  logW(insecureSomethingErrMsg);
}


// (UX COULD have the comments iframes postMessage() to this main win if new comments
// appear, so the main win comment counts will stay up-to-date, without page reload.
// — This is only relevant for pages with many comment iframes, where comment counts
// can be shown together with comment iframes.)  [dyn_upd_com_counts])
//
tyns.fetchAndFillInCommentCounts(serverOrigin);


let oneTimeLoginSecret: St | U;
let authnTried = false;
let postNrToFocus: PostNr | U;  // RENAME to ...AfterCommentsLoaded

let loadWeinre: Bo | U;

// Could move 2 to enums-and-constants.ts. [emb_scr_ver]
const scriptVersionQueryParam = '&embeddingScriptV=2';

const EditorIframeNr = 0;
const FirstCommentsIframeNr = 1;
// 2, 3, 4 etc are other comments iframes.
let numDiscussions = 0;

let sessionIframeInited: Bo | U;
let sessionIframe: HIframeElm | U | Nl;

let commentsElems: HTMLCollectionOf<Elm> | U | Nl;
let loadingElms: HElm[] = [];
let iframeElms: HIframeElm[] = [];
let iframesInited: (Bo | U)[] = [];
let pendingIframeMessages: Ay[][] = [];

let editorIframe: HIframeElm | U;
let editorWrapper: HElm | U;
let editorPlaceholder: HElm | U;


/*
Maybe use MutationObserver — but probaly, don't, not needed?
// (MutationObserver won't work in Opera Mini from 2015, but that's a while ago.)
const mutationObserver = new MutationObserver(function (mutations, observer) {
  for (const mutation of mutations) {
    console.log(`MUTATION: ${mutation.type} tgt: ${mutation.target}`);
    if (mutation.type !== 'childList')
      continue;
    
    console.log(`mutation.removedNodes.length: ${mutation.removedNodes.length}`);
    console.log(`mutation.removedNodes: ${mutation.removedNodes}`);
  }
});

// We don't know what elems the embedding page (blog post) might remove that
// makes comment iframes disappear. So observe everything. (Performance impact
// should be negligible, compared to the actual mutations.)
mutationObserver.observe(document.body, { subtree: true, childList: true });
*/



// For the user to stay logged in, Ty can store not the whole but parts 1 and 2 of
// the session id in localStorage, if 3rd party cookies disabled.
// See docs/ty-security.adoc for more about sessions and parts 1, 2, 3, 4 and 5.
// [NOCOOKIES] Parts 1 and 2 don't let the user do much more than accessing and
// posting blog comments, and moderating blog comments if hen's a moderator
// (but won't give access to, for example, the admin area).
// Some more things to do: [restrict_sid_part_2_more].  [sid_part_3]
//
let someStorage: Storage | undefined;
let tempObjStorage;

// Just *looking* at localStorage throws an exception, if cookies blocked,
// so need try-catch.
try {
  someStorage = localStorage;
  window.addEventListener('storage', onLocalStorageChanged);
}
catch {
}
if (!someStorage) {
  try {
    someStorage = sessionStorage;
  }
  catch {
    tempObjStorage = {};
  }
}

// Dupl code [OBJSTRG].
const theStorage: Storage = someStorage || {
  getItem: function(key: string): string | null {
    return tempObjStorage[key];
  },
  setItem: function(key: string, value: string) {
    tempObjStorage[key] = value;
  },
  removeItem: function(key: string) {
    delete tempObjStorage[key];
  },
} as Storage;


let curSessItemInStorage: St | Nl = null;

function onLocalStorageChanged() {
  // Maybe we logged out in another browser tab?
  /* First fix: [forget_sid12]
  const maybeNewSessItem: St | Nl = theStorage.getItem('talkyardSession');
  if (curSessItemInStorage !== maybeNewSessItem) {
    if (maybeNewSessItem) {
      sendToComments(['resumeWeakSession', maybeNewSessItem]);
    }
    else {
      sendToComments(['logoutServerAndClientSide', null]);
      sendToEditor(['logoutClientSideOnly', null]);
    }
    curSessItemInStorage = maybeNewSessItem;
  } */
}


addEventListener('scroll', messageCommentsIframeNewWinTopSize);
addEventListener('message', onMessage, false);



function loadCommentsCreateEditor() {
  findOneTimeLoginSecret();
  findCommentToScrollTo();
  createSessionFrame();
}



function createSessionFrame() {
  if (sessionIframe)
    return;

  logD("createSessionFrame()");
  sessionIframe = Bliss.create('iframe', {
    id: 'talkyard-session',
    name: 'edComments',
    title: "Talkyard comments helper iframe",
    src: serverOrigin + '/-/session-iframe',
    height: 0, // don't `hide()` [.hdn_iframe]
    'aria-hidden': true,
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

  Bliss.inside(sessionIframe, document.body);
}



function loadFirstCommentsIframe() {
  logD("loadFirstCommentsIframe()");
  // Create <iframe>s for embedded comments and an embedded editor.
  // Show a "Loading comments..." message until comments loaded.
  // For now, choose the first .talkyard-comments only, because
  // the embedded editor will be bound to one page only, and two editors
  // seems complicated.
  commentsElems = document.getElementsByClassName('ed-comments'); // old name [2EBG05]
  if (!commentsElems.length)
    commentsElems = document.getElementsByClassName('talkyard-comments');
  if (!commentsElems.length)
    return;

  numDiscussions = commentsElems.length;
  logD(`Found ${numDiscussions} Ty comment elems`);

  intCommentIframe(commentsElems[0], FirstCommentsIframeNr, numDiscussions > 1);
}



// It's simpler to debug, if waiting with creating additional comments iframes
// until the first one has been created?
function loadRemainingCommentIframes() {
  logD("loadRemainingCommentIframes()");
  if (!commentsElems)
    return;

  // But skip index 0 — that iframe has been loaded already.
  for (let i = 1; i < commentsElems.length; ++i) {
    intCommentIframe(
          commentsElems[i], i + FirstCommentsIframeNr, numDiscussions > 1);
  }

  // No need to hang on to the comments elems.
  commentsElems = null;
}


/**
 * Ex:
 *   talkyardAddCommentsIframe({ appendInside: document.body, discussionId: 'abc123' });
 */
function addCommentsIframe(ps: { appendInside: HElm | St, discussionId: St }): HElm {

  // Tests: TyTEMANYEMBDISAPI.TyTAPNDIFR283
  const appendIn: HElm = typeof ps.appendInside === 'string' ?
          document.querySelector(ps.appendInside) : ps.appendInside;
  if (!appendIn) {
    logE(`No elem to append in: ${ps.appendInside} [TyE0ELM2APND_]`);
    return;
  }

  logD(`Creating iframe for disc id ${ps.discussionId
          } in #${appendIn.id}.${appendIn.className} ...`);

  const wrapperDiv = Bliss.create('div', {
    className: 'talkyard-comments',
    'data-discussion-id': ps.discussionId,
  });

  // (At least iframesInited needs to be appended to. [.if_initd])
  loadingElms.push(undefined);
  iframeElms.push(undefined);
  iframesInited.push(undefined);
  pendingIframeMessages.push(undefined);
  numDiscussions = iframeElms.length - FirstCommentsIframeNr;

  Bliss.inside(wrapperDiv, appendIn);
  const commentIframeNr = iframeElms.length - 1;
  intCommentIframe(wrapperDiv, commentIframeNr, numDiscussions > 1);
  return wrapperDiv;
}



function forgetRemovedCommentIframes() {
  for (let i = iframeElms.length - 1; i >= 0; --i) {
    const iframe = iframeElms[i];
    if (!iframe.isConnected)  {
      loadingElms.splice(i, 1);
      iframeElms.splice(i, 1);
      iframesInited.splice(i, 1);
      pendingIframeMessages.splice(i, 1);
      numDiscussions = iframeElms.length - FirstCommentsIframeNr;
      logD(`Forgot removed iframe ${iframe.name}, ${numDiscussions} discussions left.`);
    }
  }
}



/// Loads newly added embedded discussions, without the embedding page having
/// to call talkyardAddCommentsIframe(..).
/*
function loadNewCommentIframes(commentsElem, iframeNr: Nr, manyCommentsIframes: Bo) {
  const newCommentElems = document.querySelectorAll('.talkyard-comments:not(.ty_IfrCr)');
  const numOld = commentsElems.length;
  const numTotal = numOld + newCommentElems.length;
  for (let i = 0; i < newCommentElems.length; ++i) {
    const iframeNr = numOld + i + FirstCommentsIframeNr;
    intCommentIframe(
          newCommentElems[i], iframeNr, numTotal > 1);
  }
}  */



function intCommentIframe(commentsElem, iframeNr: Nr, manyCommentsIframes: Bo) {
  const existingIframe = commentsElem.querySelector('.ty_CmtsIfr');
  if (existingIframe)
    return;

  logD(`intCommentIframe(..., iframeNr = ${iframeNr}, manyCommentsIframes = ${
          manyCommentsIframes})`);

  // Tests:  embcom.ignore-query-params.2br  TyTEEMCIGQPRMS

  // The server wants the embedding URL, to know if it should add 'localhost'
  // to the allowed frame-ancestors, for development. [embng_url]
  // Ignore the query string, by default. It's almost always just for tracking
  // and analytics — but almost never for deciding what page to show.
  let embeddingUrl = location.origin + location.pathname;

  if (!considerQueryParams) {
    // Noop: Leave embeddingUrl as is, without query params.
  /* Maybe later:
  }
  else if (considerQueryParams === 'AllReally') {
    // Consider all query params, mostly for backw compat.
    embeddingUrl += location.search;
  }
  else if (considerQueryParams === 'SkipTracking') {
    // Exclude:  &ref=  &campaign=... and utm_...= and ...
    // see:  https://en.wikipedia.org/wiki/UTM_parameters
    // and:  https://www.talkyard.io/-645#post-4
    */
  }
  else if (considerQueryParams.length) {
    // Consider only the specified query param(s).
    const url = new URL(location.toString());
    for (let i = 0; i < considerQueryParams.length; ++i) {
      const paramName = considerQueryParams[i];
      const unencVal = url.searchParams.get(paramName);
      const encodedVal = encodeURIComponent(unencVal);
      // For this to work with many query params, would need to call
      // encodeURIComponent on the whole embeddingUrl afterwards [enc_aft],
      // and unencode it server side. And to know that it's been encoded,
      // could rename the param to embgUrl=... whilst the server would know that
      // embeddingUrl hadn't been encoded (the blog comments script is cached
      // for up to a day [embcom_script_cache_time]).
      if (i >= 1) {
        logW(`Only one query param supported, but talkyardConsiderQueryParams is: ${
              JSON.stringify(considerQueryParams)} — ignoring all but ${
              considerQueryParams[0]} [TyEMANYQPS]`);
        break;;
      }
      embeddingUrl += i === 0 ? '?' : '&';
      embeddingUrl += `${paramName}=${encodedVal}`;
    }
  }

  // Could rename param, and encode the value, see above [enc_aft].
  const embeddingUrlParam = 'embeddingUrl=' + embeddingUrl;

  // NEXT:
  // + data-page      = places comments on that page / auto-creates it
  // + data-category  = places any lazy-created page in that category
  // + data-tags      = adds these tags to the page, *iff* gets lazy-created
  // + data-title

  const discussionTitle: StN = commentsElem.getAttribute('data-discussion-title');
  const iframeTitle: StN = commentsElem.getAttribute('data-iframe-title');
  const htmlClass: StN = commentsElem.getAttribute('data-iframe-html-class');

  // The discussion id might include a bit weird chars — it might have been imported
  // from WordPress or Ghost or Disqus [52TKRG40], and e.g. WordPress.com inserted spaces
  // in their ids — which can have gotten imported to Disqus, and now from Disqus to Ty.
  // But at least don't allow newlines and tabs? That'd probably be some weird bug?
  var discussionId = commentsElem.getAttribute('data-discussion-id');
  if (/[\t\r\n]/.test(discussionId)) {
    var errorMessage = "Bad discussion id: " + discussionId + ' [TyEEMDIID]';
    logW(errorMessage);
    if (manyCommentsIframes) return false;  // _other_iframes_might_work
    else throw Error(errorMessage);
  }
  var discIdParam = discussionId ? `discussionId=${discussionId}&` : '';

  // If many iframes on the same page:  Without a discussion id, how could we know
  // which (if any) of the iframe discussion should be associated with just
  // the URL or URL path?  Or if there's a discussion with no id,
  // associated with the URL, and then a 2nd discussion iframe is added, with an id
  // — the Ty server won't know if this is supposed to be a separate discussion,
  // or if the blog admin just wants to add the id, to the already existing discussion.
  //
  // If there's just one comments iframe, *maybe* it ought to have a discussion
  // id — if more comment iframes will soon appear. But we don't know, and it's
  // an extremely rare use case, so, don't log the warning, unless there are
  // *already* >= 2 iframes.
  //
  if (manyCommentsIframes && !discussionId) {
    const warning =
          `iframe nr ${iframeNr}: Attribute 'data-discussion-id=...' missing: ` +
          `Each comments iframe should have a discussion id, when many ` +
          `iframes are shown at the same time, or same URL [TyEMANYIFRID]`;
    logW(warning);
  }

  // To place the lazy-created embedded discussion pages in a specific
  // category. E.g.:  data-category="extid:some_category"
  var categoryRef = commentsElem.getAttribute('data-category');
  if (/[\t\r\n]/.test(categoryRef)) {
    var errorMessage = `Bad category ref: ${categoryRef} [TyEEMCATRFCL]`;
    logW(errorMessage);
    if (manyCommentsIframes) return false;  // _other_iframes_might_work
    else throw Error(errorMessage);
  }
  const catRefParam = categoryRef ? `category=${categoryRef}&` : '';

  var edPageId = commentsElem.getAttribute('data-ed-page-id'); // old name [2EBG05]
  if (!edPageId) {
    edPageId = commentsElem.getAttribute('data-talkyard-page-id');
  }
  var edPageIdParam = edPageId ? 'edPageId=' + edPageId + '&' : '';
  var htmlClassParam = htmlClass ? '&htmlClass=' + htmlClass : '';

  const logLevelParam = talkyardLogLevel ? `&logLevel=${talkyardLogLevel}` : '';

  const allUrlParams =
          edPageIdParam + discIdParam + catRefParam + embeddingUrlParam +
          htmlClassParam + logLevelParam + scriptVersionQueryParam;

  var commentsIframeUrl = serverOrigin + '/-/embedded-comments?' + allUrlParams;
  loadWeinre = location.hash.indexOf('&loadWeinre') >= 0;  // [WEINRE]
  if (loadWeinre) {
    // Let's append the whole hash fragment — nice to see any client "name"
    // you can debug-include in the hash, in Weinre's debug targets list.
    commentsIframeUrl += location.hash;
  }

  // Don't `hide()` the iframe, then FireFox acts as if it doesn't exist: FireFox receives
  // no messages at all from it.  [.hdn_iframe]
  const commentsIframe = Bliss.create('iframe', {
    id: 'ed-embedded-comments',
    name: 'edComments-' + iframeNr,
    className: 'p_CmtsIfr ty_CmtsIfr',   // DEPRECATE old name p_CmtsIfr
    // A title attr, for better accessibility. See: https://www.w3.org/TR/WCAG20-TECHS/H64.html
    title: iframeTitle || "Comments",
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

  commentsElem.classList.add('ty_IfrCr');  // iframe created

  iframeElms[iframeNr] = commentsIframe;
  logD(`Inserted commentsIframes[${iframeNr}]`);

  if (insecureSomethingErrMsg) {
    // If insecureTyIframeProbl, then for sure the comments won't load.
    // If however insecureBlogProbl, then *maybe* they'll load?
    // COULD set a timeout and unhide the error if the comments didn't load
    // in a few seconds?
    const insecureContentErrorElem = Bliss.create('div', {
      textContent: insecureSomethingErrMsg,
      className: 'p_Problem',
      style: {
        padding: '20px',
        margin: '20px 10px',
        width: 'calc(100% - 60px)',  // (20 + 10) * 2 = 60
        background: 'hsl(0,100%,33%)', // dark red
        color: 'yellow',
        fontWeight: 'bold',
        // display: insecureTyIframeProbl ? undefined : 'none',
      },
    });
    Bliss.start(insecureContentErrorElem, commentsElem);
  }

  var loadingCommentsElem = Bliss.create('p', {
    id: 'ed-loading-comments',
    className: 'p_Ldng p_Ldng-Cmts',
    textContent: "Loading comments ..."
  });

  Bliss.start(loadingCommentsElem, commentsElem);
  loadingElms[iframeNr] = loadingCommentsElem;
}



function createEditorIframe() {
  logD(`createEditorIframe()`);

  editorWrapper = Bliss.create('div', {
    id: 'ed-editor-wrapper',
    className: 'p_EdrIfrW',
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
  logD("inserted editorWrapper");

  // [embng_url]
  let editorIframeUrl =
        `${serverOrigin}/-/embedded-editor?embeddingUrl=${location.origin}` +
        scriptVersionQueryParam;

  if (loadWeinre) {
    editorIframeUrl += location.hash;
  }

  editorIframe = Bliss.create('iframe', {
    id: 'ed-embedded-editor',
    name: 'edEditor',
    className: 'p_EdrIfr',
    style: {
      // Otherwise 'inline' —> some blank space below, because of descender spacing?
      display: 'block',
      padding: 0,
      margin: 0,
      width: '100%',
      height: '100%',
      border: 'none'
    },
    seamless: 'seamless',
    src: editorIframeUrl
  });

  iframeElms[EditorIframeNr] = editorIframe;

  Bliss.inside(editorIframe, editorWrapper);
  logD("inserted editorIframe");

  makeEditorResizable();
}



function removeCommentsAndEditor() {
  logD("removeCommentsAndEditor()");

  postNrToFocus = undefined;
  oneTimeLoginSecret = undefined;
  // Maybe?: talkyardAuthnToken = undefined, since won't be able to reuse anyway.
  authnTried = false;

  for (let i = 0; i < iframeElms.length; ++i) {
    const iframe = iframeElms[i];
    if (iframe) {
      iframe.remove();
    }
    const loadingText = loadingElms[i];
    if (loadingText) {
      loadingText.remove();
    }
  }

  loadingElms.length = 0;
  iframeElms.length = 0;
  iframesInited.length = 0;
  pendingIframeMessages.length = 0;
  numDiscussions = 0;

  if (editorIframe) {
    //editorIframe.remove();  // done above
    editorIframe = null;
    editorWrapper.remove();
    editorWrapper = null;
  }
  if (sessionIframe) {
    sessionIframe.remove();
    sessionIframe = null;
    sessionIframeInited = false;
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
  sendToComments(calcSizes);
}


function calcSizes(commentsIframe: HIframeElm): St {
  var rect = commentsIframe.getBoundingClientRect();
  // We're interested in the height part of the viewport that is used for the iframe.

  // If the iframe extends below the lower window edge, we see only the part of it
  // down to `window.innerHeight` (then, don't use `rect.bottom`).
  var height = Math.min(window.innerHeight, rect.bottom);
   // iframeVisibleBottomInParentWin

  // If the iframe starts above the upper window edge, we don't see the parts of it above 0 (zero).
  // And if it starts below the upper window edge, then, `rect.top` is where it starts.
  var iframeVisibleHeight = height - Math.max(0, rect.top);
                                  // iframeVisibleTopInParentWin

  return ('["iframeOffsetWinSize",' +
      '{ "top":' + (-rect.top) +  // why did I negate? [why_neg_ifr_top]
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
  if (!sessionIframe) return;

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

  if (sessionIframe.contentWindow === event.source) {
    // @ifdef DEBUG
    if (eventName !== 'iframeInited')
      throw Error(`Unexpected message from session iframe: ${eventName}  TyE4MREJ36`);
    // @endif
    logM(`Session iframe inited`);
    sessionIframeInited = true;
    createEditorIframe();  // [ed_ifr_1st]
    return;
  }

  const anyFrameAndNr: [HIframeElm, Nr] | U = findIframeThatSent(event);
  if (!anyFrameAndNr)
    return;

  const [iframe, iframeNr] = anyFrameAndNr;
  const isFromCommentsIframe = iframeNr >= FirstCommentsIframeNr;
  const isFromEditorIframe = iframeNr === EditorIframeNr;

  let assertIsFromEditorToComments = function() {};
  let assertIsFromCommentsToEditor = function() {};
  // @ifdef DEBUG
  assertIsFromEditorToComments = function() {
    if (iframe !== editorIframe) {
      logW(`Bad msg dir [TyEMSGDIR1]: '${eventName}', ${JSON.stringify(eventData)}`);
      debugger;
    }
  };
  assertIsFromCommentsToEditor = function() {
    if (!isFromCommentsIframe) {
      logW(`Bad msg dir [TyEMSGDIR2]: '${eventName}', ${JSON.stringify(eventData)}`);
      debugger;
    }
  };
  // @endif

  switch (eventName) {
    case 'iframeInited':
      iframesInited[iframeNr] = true;

      if (isFromEditorIframe) {
        logM(`Editor iframe inited`);
        loadFirstCommentsIframe();  // [ed_ifr_1st]
        return;
      }

      logM(`Comments iframe nr ${iframeNr} inited`);

      if (iframeNr === FirstCommentsIframeNr) {
        loadRemainingCommentIframes();
      }

      // If something prevented the editor from loading, let's continue anyway,
      // so the comments at least appear, although wouldn't be possible to reply.
      // (So start at i = FirstCommentsIframeNr, not 0.)
      for (let i = FirstCommentsIframeNr; i < iframesInited.length; ++i) { // [.if_initd]
        if (!iframesInited[i])
          return;
      }

      logM(`All comment iframes inited.`);

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
      // Log in via the first comments iframe only — otherwise there'd be races
      // and unnecessarily many server requests.
      // (Probably better to not incl any token or secret in any url (as is however
      // done with e.g. `htmlClassParam`, see  [emb_comts_url_params]), so they won't
      // end up in any request logs somewhere.)
      //
      if (authnTried) {
        // Noop.
      }
      else if (autnToken) {
        logM(`Sending authn token to first comments iframe`);
        sendToFirstCommentsIframe(
              JSON.stringify(['loginWithAuthnToken', autnToken]));
      }
      else if (oneTimeLoginSecret) {
        // Tell the comments iframe to login, using our one-time secret.  [306KUD244]
        logM(`Sending one time login secret to first comments iframe`);
        sendToFirstCommentsIframe(
              `["loginWithOneTimeSecret", "${oneTimeLoginSecret}"]`);
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
        let sessionStr: St | NU;
        try {
          sessionStr = theStorage.getItem('talkyardSession');
          // Skip this hereafter?! [btr_sid] Do afterwards instead, if is now invalid.
          // Because otherwise we'd get logged out in other tabs — they listen to localStorage.
          // The iframe can send back a 'failedToLogin' instead?  [forget_sid12]
          theStorage.removeItem('talkyardSession');  // see above (3548236)
          curSessItemInStorage = null;
        }
        catch (ex) {
          logW(`Error getting 'talkyardSession' from theStorage [TyEGETWKSID]`, ex);
        }
        if (sessionStr) {
          logM(`Resuming old session...`);
          try {
            const session = JSON.parse(sessionStr);
            sendToFirstCommentsIframe(
                  ['resumeWeakSession', session]);

            // We'll get back either a 'justLoggedIn' or a 'logoutClientSideOnly' message.
            // In the latter case, we'll forget the session, so we won't needlessly try
            // to use it on every page load.
          }
          catch (ex) {
            logW(
                `Error parsing 'talkyardSession', this: "${sessionStr}" [TyEPARSEWKSID]`, ex);
          }
        }
      }
      authnTried = true;

      // (But not authenticated, yet (happens asynchronically in the iframes). Only
      // public comments visible, until then.)
      // Callback e2e test:
      //    - embcom.log-levels-on-loaded.1br.ec  TyTECLOGSCLBKS.TyTCOMTSCLBK
      callIfExists('onTalkyardCommentsLoaded');
      break;

    case 'setIframeSize':
      //logT(`setIframeSize ${j2s(eventData)}`);

      setIframeSize(iframe, eventData);
      // The comments iframes want to know the real win dimensions, so they can position
      // dialogs on screen (so pat can see the dialogs). But wait until [the iframe
      // whose size we're changing] has been resized — because if the iframe bottom
      // after having been resized, is higher up than the window bottom,
      // then that'd reduce the height we send to the iframe.
      if (isFromCommentsIframe) {
        setTimeout(
              messageCommentsIframeNewWinTopSize);
      }
      // Remove the "loading comments" info text.
      var loadingText = loadingElms[iframeNr];
      if (loadingText) {
        loadingText.remove();
        loadingElms[iframeNr] = undefined;
      }
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

    case 'authnErr':
      logW(`Error logging in using ${eventData.prettyMethod}. ` +
            `Check the console log messages in the Talkyard comments iframe ` +
            `for details (its name is 'edComments-1').`)
      break;

    case 'justLoggedIn':
      const u = eventData.user || {};
      logM(`Logged in as ${u.username || u.fullName} in iframe`);
      // @ifdef DEBUG
      // Here, session id part 3 must not be included — it must not be seen
      // by the embedding website (only by code directly on the Talkyard domain).
      // So, the length should be:  SidLengthCharsPart1 + SidLengthCharsPart2 = 16 + 24
      // for the new fancy sessions. Whilst the old silly sids include a '.' dot.
      if (eventData.weakSessionId && eventData.weakSessionId.length !== 16 + 24
            && eventData.weakSessionId.indexOf('.') === -1)
        throw Error(`tySid12 should be 16 + 24 = ${16 + 24} chars but is ${
                eventData.weakSessionId.length} chars [TyEBADSID12LEN]`);
      // @endif
      if (eventData.rememberEmbSess) try {
        const item = {
          pubSiteId: eventData.pubSiteId,
          weakSessionId: eventData.weakSessionId,
        };
        const isUndef = item.weakSessionId === 'undefined'; // this'd be a bug elsewhere
        /*
        Got changed to  SessionType.AutoToken (bitfield). Setting name: 'rememberEmbSess'.
        if (eventData.sessionType === 'AuthnToken') {
          // Then the embedding page includes a 'authnToken' token,
          // if we're logged in — don't combine that with localStorage, would get
          // too complicated?
        }
        else */
        if (!item.weakSessionId || isUndef) {
          logW(`weakSessionId missing [TyE0WKSID]: ${JSON.stringify(eventData)}`);
          if (isUndef) {
            debugger;
          }
        }
        else {
          // This re-inserts our session (3548236), if we just sent a 'resumeWeakSession'
          // message to the iframe and then removed it from theStorage  — because
          // the comments iframe sends back 'justLoggedIn', after having logged in.
          curSessItemInStorage = JSON.stringify(item);
          theStorage.setItem('talkyardSession', curSessItemInStorage);

          // ! Need a 'failedToLogin' if login failed  [forget_sid12]
        }
      }
      catch (ex) {
        logW(`Error setting 'talkyardSession' in  theStorage [TyESETWKSID]`, ex);
      }
      sendToOtherIframes(event.data, iframeNr);
      break;

    case 'logoutClientSideOnly':
      logM(eventData.why || `Logged out`);
      try {
        theStorage.removeItem('talkyardSession');
        curSessItemInStorage = null;
      }
      catch (ex) {
        logW(`Error removing 'talkyardSession' from  theStorage [TyERMWKSID]`, ex);
      }
      sendToOtherIframes(event.data, iframeNr);
      if (isFromCommentsIframe) {
        showEditor(false);
      }
      if (eventData.goTo) {
        // For SSO-logout, we need to redirect this parent win  [sso_redir_par_win]
        // to the logout url.
        logM(`Going to: ${eventData.goTo}`);
        location.assign(eventData.goTo);
      }
      break;

    // Maybe remove this one, and use only 'showEditsPreviewInPage' instead, renamed to
    // 'showEditorAndPreview'?
    case 'onEditorOpen':
      assertIsFromEditorToComments();
      showEditor(true);
      sendToComments(event.data);
      break;
    case 'showEditsPreview':  // REMOVE DO_AFTER 2020-09-01 deprecated
    case 'showEditsPreviewInPage':
      // REMOVE
      // @ifdef DEBUG
      throw Error('TyE306MWEG25_06');
      // @endif
      assertIsFromEditorToComments();
      sendToComments(event.data);
      break;
    case 'scrollToPreview':
      assertIsFromEditorToComments();
      sendToComments(event.data);
      break;
    case 'hideEditorAndPreview': // CLEAN_UP REMOVE_AFTER 2021-10-01 this line only.
      // REMOVE
      // @ifdef DEBUG
      throw Error('TyE306MWEG25_07');
      // @endif
    case 'hideEditor':
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
      // REMOVE
      // @ifdef DEBUG
      throw Error('TyE306MWEG25_01');
      // @endif
      assertIsFromCommentsToEditor();
      sendToEditor(event.data);
      break;
    case 'handleReplyResult':
      // REMOVE
      // @ifdef DEBUG
      throw Error('TyE306MWEG25_02');
      // @endif
      assertIsFromEditorToComments();
      sendToComments(event.data);
      break;
    case 'editorEditPost':
      // REMOVE
      // @ifdef DEBUG
      throw Error('TyE306MWEG25_03');
      // @endif
      assertIsFromCommentsToEditor();
      sendToEditor(event.data);
      break;
    case 'handleEditResult':
      // REMOVE
      // @ifdef DEBUG
      throw Error('TyE306MWEG25_04');
      // @endif
      assertIsFromEditorToComments();
      sendToComments(event.data);
      break;
    case 'patchTheStore':
      sendToOtherIframes(event.data, iframeNr);
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



/// Returns: [iframe, index] or undefined.
function findIframeThatSent(event): [HIframeElm, Nr] | U {  // [find_evt_ifrm]
  // See http://stackoverflow.com/a/18267415/694469
  for (let i = 0; i < iframeElms.length; ++i) {
    const comIfr = iframeElms[i];
    if (comIfr && comIfr.contentWindow === event.source)
      return [comIfr, i];
  }
}




function sendToOtherIframes(message, skipIframeNr: Nr) {
  // Send to all (except for the one to skip). If we have a specific iframe
  // in mind, then we postMessage() to that one directly instead. [post_dir_2_ifr]
  for (let i = 0; i < iframeElms.length; ++i) {
    if (i === skipIframeNr) {
      continue;
    }
    const otherIframe = iframeElms[i];
    sendToOneIframe(otherIframe, message);
  }
}


function sendToComments(message) {
  sendToOtherIframes(message, EditorIframeNr);
}



function sendToEditor(message) {
  sendToOneIframe(editorIframe, message);
}



function sendToFirstCommentsIframe(message: Ay) {   // [1st_com_frame]
  sendToOneIframe(iframeElms[FirstCommentsIframeNr], message);
}



function sendToOneIframe(iframe, message: any | null, retryNr: Nr = 0) {
  //initedArr: boolean[], pendingMessages,
  // Dupl code (6029084583).

  const iframeNr: Nr = iframeElms.indexOf(iframe);
  if (iframeNr === -1) {
    // Gone, skip message.
    return;
  }

  const iframeInited = iframesInited[iframeNr];
  const pendingMessages = pendingIframeMessages[iframeNr] || [];
  pendingIframeMessages[iframeNr] = pendingMessages;

  // Sometimes one iframe comes alive and wants to message the other one,
  // before that other iframe is ready.
  if (message) {
    pendingMessages.push(message);
  }

  if (!pendingMessages.length)
    return;

  // Wait until the <iframe> is "alive".
  // Posting a message when the html <iframe> has been created but before it's been fully
  // loaded, as of 2019-03 made Chrome send the message to this parent window instead,
  // resulting in errors like these in the dev console:
  //
  //   Failed to execute 'postMessage' on 'DOMWindow': The target origin
  //   provided ('https://comments-for-the-blog-address.talkyard.net') does not match
  //   the recipient window's origin ('https://the-blog-address.com').
  //
  // Explanation: postMessage tried to send to https://comments-for... (the target origin)
  // but instead Chrome sent the message to the top window, https://the-blog-address
  // (the recipient origin).
  //
  // This error typically does not happen on localhost, because then the iframe loads
  // quickly. Instead, it happens in production, sometimes only. To reproduce, on localhost,
  // set a breakpoint in the app server, in EmbeddedTopicsController.showTopic [5BRW02],
  // to block the iframe from loading, and then you can reproduce this error.
  //
  if (!iframeInited) {
    setTimeout(function() {
      // Maybe the iframe is gone, was removed before it got inited?
      // If so, remove it from our iframes list — then, indexOf() above, won't
      // find it so we'd return and skip the message.
      if ((retryNr % 5) === 1) {
        forgetRemovedCommentIframes();
      }
      sendToOneIframe(iframe, null, retryNr + 1);
    }, 500);
    return;
  }

  // Iframe inited, but contents gone? That'd mean it got removed by javascript.
  if (!iframe.contentWindow) {
    // If many iframes gone, we'd call forgetRemovedCommentIframes()
    // unnecessarily many times, that's ok.
    setTimeout(forgetRemovedCommentIframes, 1);
    return;
  }

  for (let i = 0; i < pendingMessages.length; ++i) {
    let m = pendingMessages[i];
    if ((typeof m) === 'function') {
      m = m(iframe, iframeNr);
    }
    else if ((typeof m) !== 'string') {
      // For now. Could remove JSON.parse instead [3056MSDJ1].
      m = JSON.stringify(m);
    }
    iframe.contentWindow.postMessage(m, serverOrigin);
  }
  // Empty the array.
  pendingMessages.length = 0;
}



function findOneTimeLoginSecret() {
  // This need not be at the start of the hash fragment — but if there's anything before
  // or after, needs to be separated with one of [#&].
  var loginSecretHashMatch = location.hash.match(
      /[#&]talkyardOneTimeLoginSecret=([a-zA-Z0-9]+)([#&].*)?$/);
  if (loginSecretHashMatch) {
    oneTimeLoginSecret = loginSecretHashMatch[1];
    // Remove the login secret from the url, because it works only once — and if
    // someone copies the url with this soon-used-up secret in, the server
    // will reply Error and Talkyard would show an error message in the browser.
    logM("Found one time login secret, removing from url: " + oneTimeLoginSecret);
    // Maybe use history.replaceState({}, '', '# ...') instead?
    location.hash = location.hash.replace(
        'talkyardOneTimeLoginSecret=' + oneTimeLoginSecret, '');
  }
}



function findCommentToScrollTo() {
  const commentNrHashMatch = location.hash.match(/^#comment-(\d+)([#&].*)?$/);  // [2PAWC0]
  if (commentNrHashMatch) {
    const commentNrStr = commentNrHashMatch[1];
    const commentNr = parseInt(commentNrStr);
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



function scrollComments(rectToScrollIntoView, options /* CalcScrollOpts */) {
  // For a discussion about using <html> or <body>, see:
  // https://stackoverflow.com/questions/19618545/
  //    body-scrolltop-vs-documentelement-scrolltop-vs-window-pagyoffset-vs-window-scrol
  // COULD use  window.scrollY instead, that's maybe more future compatible,
  // see: https://stackoverflow.com/a/33462363/694469

  // This currently works only with one single comments iframe — if more,
  // then, currently we don't know which one to scroll.
  if (numDiscussions > 1)
    return;

  const commentsIframe = iframeElms[FirstCommentsIframeNr];
  options.parent = document.documentElement.scrollTop ? document.documentElement : document.body;
  const iframeRect = commentsIframe.getBoundingClientRect();
  const rectWithOffset = {
    top: rectToScrollIntoView.top + iframeRect.top,
    bottom: rectToScrollIntoView.bottom + iframeRect.top,
    left: rectToScrollIntoView.left + iframeRect.left,
    right: rectToScrollIntoView.right + iframeRect.left
  };
  const coords /* CalcScrollResult */ = d.i.calcScrollRectIntoViewCoords(rectWithOffset, options);
  if (coords.needsToScroll) {
    smoothScroll(document.body, coords.desiredParentLeft, coords.desiredParentTop);
  }
}


let hasInitedEditorHeight = false;

function showEditor(show: boolean) {
  if (show) {
    editorWrapper.style.display = 'block';
    if (!hasInitedEditorHeight) {
      hasInitedEditorHeight = true;
      // Apparently this needs be done after display = 'block'.
      const initialHeight = Math.max(Math.min(300, window.innerHeight), window.innerHeight / 2.8);
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
    editorWrapper.style.top = '0px'; // bottom is 0 already
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
  const editorWrapper = document.getElementById('ed-editor-wrapper');
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


/// The editor's own resize functionality won't work, because it is height 100% inside
/// the editor iframe. Instead, here we resize the whole editor iframe. [RESEMBEDTR]
///
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
    const newHeight = startHeight - event.clientY + startY;
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
  const newVisibilityStyle = { style: { visibility: cover ? 'hidden' : 'visible' }};
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
  const comments = document.getElementById('ed-embedded-comments');
  const editor = document.getElementById('ed-embedded-editor');
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
windowWithTalkyardProps.talkyardAddCommentsIframe = addCommentsIframe;
windowWithTalkyardProps.talkyardForgetRemovedCommentIframes = forgetRemovedCommentIframes;
//windowWithTalkyardProps.talkyardLoadNewCommentIframes = loadNewCommentIframes;

// @ifdef DEBUG
windowWithTalkyardProps['e2e_getNumEmbDiscs'] = () => numDiscussions;
// @endif



function callIfExists(functionName: St) {
  const fn = windowWithTalkyardProps[functionName];
  if ((typeof fn) === 'function') {
    fn();
  }
}

// Callback e2e test:
//    - embcom.log-levels-on-loaded.1br.ec  TyTECLOGSCLBKS.TyTSCRIPTCLBK
callIfExists('onTalkyardScriptLoaded');

// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list
