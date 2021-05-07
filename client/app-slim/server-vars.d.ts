/// <reference path="model.ts" />


// These variables are initialized in a certain <head><script>.  [5JWKA27]

interface ServerVars {
  doWhat: 'Noop' | 'StartPage' | 'ResetPwd';
  pubSiteId: string;
  siteId: SiteId;  // only in Dev mode  — repl w isFirstSite: boolean?
  secure: boolean;
  isDev: boolean;
  isTestSite: boolean;
  testNowMs: WhenMs | undefined;
  loadGlobalAdminScript: boolean;
  loadGlobalStaffScript: boolean;
  loadGlobalAllScript: boolean;

  // "js" or "min.js"  (but not ".js" or ".min.js").
  minMaxJs: St;

  // This field exists, but don't declare it, shouldn't be used at any more places. Use origin()
  // in links.ts instead.
  // const debugOrigin: string;

  cdnOriginOrEmpty: string;
  cdnOrServerOrigin: string;
  assetUrlPrefix: string;
  debugOrigin: St;

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
  embeddingScriptV?: Nr;
  embeddingOrigin?: string;
  embeddingUrl?: string;
  embeddedPageAltId?: string;  // RENAME to embeddedDiscussionId
  lazyCreatePageInCatId?: CategoryId;
  // Sometimes lazy-inited when the page gets lazy-created, when the first reply is posted. [4HKW28]
  embeddedPageId?: string;

  // When creating new site.
  baseDomain?: string;

  newPasswordData?: NewPasswordData;

  // Is non-zero, if the server is read-only, because of maintenance work. The value
  // is the Unix second when the maintenance work is believed to be done, or 1 if unspecified.
  mainWorkUntilSecs?: number;
}


interface NewPasswordData {
  fullName: St;
  username: St;
  email: St;
  minLength: Nr;
  resetPasswordEmailId: St;
}
