/// <reference path="model.ts" />

declare const talkyard: TalkyardApi;


interface PageSession  {
  xsrfTokenIfNoCookies: string | undefined;
  currentPageSessionId: string | undefined;
}

declare const typs: PageSession;


// These variables are initialized in a certain <head><script>.  [5JWKA27]

interface ServerVars {
  pubSiteId: string;
  siteId: number;  // only in Dev mode
  secure: boolean;
  isDev: boolean;
  isTestSite: boolean;
  testNowMs: WhenMs | undefined;
  loadGlobalAdminTestScript: boolean;
  loadGlobalStaffScript: boolean;

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

  pageDataFromServer: any;
  volatileDataFromServer: VolatileDataFromServer;

  isInLoginWindow: boolean;
  isInLoginPopup: boolean;
  isInIframe: boolean;
  isInAdminArea: boolean;

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
}

declare const eds: ServerVars;  // RENAME to tys  ?  And is there any way to make all fields 'const' ?

// Old:
declare const debiki: any;
