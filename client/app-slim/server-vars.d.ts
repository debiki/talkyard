/// <reference path="model.ts" />

declare const talkyard: TalkyardApi;


interface PageSession  {
  xsrfTokenIfNoCookies: string | undefined;

  // Initialized when the page loads, by checking navigator.cookieEnabled.
  canUseCookies?: boolean;

  // This session id is available to client side Javascript, and can be stolen
  // if there's an XSS vulnerability. So, it's going to have fewer capabilities
  // than a http-only session when the Talkyard site is opened as the main window
  // (rather than embedded in an iframe).
  //
  // It's needed because Safari and FF blocks 3rd party cookies, so
  // we need to remember the login session in a non-cookie somehow.
  //
  // ADD_TO_DOCS
  //
  weakSessionId: string | undefined;
}

// REMOVE? shouldn't access, if in emb cmts editor or login popup,
// instead, should use getMainWin().typs.
declare const typs: PageSession;

interface __MainWinInterface extends Window {
  typs: PageSession;
}

type MainWin = __MainWinInterface & typeof globalThis;


// These variables are initialized in a certain <head><script>.  [5JWKA27]

interface ServerVars {
  pubSiteId: string;
  siteId: number;  // only in Dev mode
  secure: boolean;
  isDev: boolean;
  isTestSite: boolean;
  testNowMs: WhenMs | undefined;
  loadGlobalAdminScript: boolean;
  loadGlobalStaffScript: boolean;
  loadGlobalAllScript: boolean;

  minMaxJs: boolean;

  // This field exists, but don't declare it, shouldn't be used at any more places. Use origin()
  // in links.ts instead.
  // const debugOrigin: string;

  cdnOriginOrEmpty: string;
  cdnOrServerOrigin: string;
  assetUrlPrefix: string;

  // To be used only when rendering commonmark to html. (But when running React,
  // the store Origin fields should be used instead. There is, hovewer,
  // no store, when rendering commonmark to html, so then currently we use this.)
  // CLEAN_UP COULD send the upl prefix to replaceLinks(md) instead, so won't need this here? [5YKF02]
  uploadsUrlPrefixCommonmark: string;

  currentVersion: string;
  cachedVersion: string;

  wantsServiceWorker: boolean;
  useServiceWorker: boolean;  // if both wants it, and it's available

  pageDataFromServer: any;
  volatileDataFromServer: VolatileDataFromServer;

  isIos: boolean;
  isInLoginWindow: boolean;
  isInLoginPopup: boolean;
  isInIframe: boolean;
  isInAdminArea: boolean;
  isRtl: boolean;  // right-to-left language? then right-pull menus instead of left-pull

  // For embedded comments.
  isInEmbeddedCommentsIframe: boolean;
  isInEmbeddedEditor: boolean;
  embeddingOrigin: string | undefined;
  embeddingUrl: string | undefined;
  embeddedPageAltId: string | undefined;
  // Sometimes lazy-inited when the page gets lazy-created, when the first reply is posted. [4HKW28]
  embeddedPageId: string | undefined;

  // When creating new site.
  baseDomain: string | undefined;

  // Is non-zero, if the server is read-only, because of maintenance work. The value
  // is the Unix second when the maintenance work is believed to be done, or 1 if unspecified.
  mainWorkUntilSecs?: number;
}

declare const eds: ServerVars;  // RENAME to tys  ?  And is there any way to make all fields 'const' ?

// Old:
declare const debiki: any;
