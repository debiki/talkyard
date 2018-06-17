/// <reference path="model.ts" />

// The variables declared here are initialized in a certain <head><script>.  [5JWKA27]

declare const talkyard: TalkyardApi;

declare namespace eds {
  const pubSiteId: string;
  const siteId: number;  // only in Dev mode
  const secure: boolean;
  const isDev: boolean;
  const isTestSite: boolean;
  const testNowMs: WhenMs | undefined;
  const loadGlobalAdminTestScript: boolean;
  const loadGlobalStaffScript: boolean;

  const minMaxJs: boolean;
  const serverOrigin: string;
  const cdnOriginOrEmpty: string;
  const cdnOrServerOrigin: string;
  const assetUrlPrefix: string;

  // To be used only when rendering commonmark to html. (But when running React,
  // the store Origin fields should be used instead. There is, hovewer,
  // no store, when rendering commonmark to html, so then currently we use this.)
  // CLEAN_UP COULD send the upl prefix to replaceLinks(md) instead, so won't need this here? [5YKF02]
  const uploadsUrlPrefixCommonmark: string;

  const currentVersion: string;
  const cachedVersion: string;

  const pageDataFromServer: any;
  const volatileDataFromServer: any;

  const isInLoginWindow: boolean;
  const isInLoginPopup: boolean;
  const isInIframe: boolean;
  const isInAdminArea: boolean;

  // For embedded comments.
  const isInEmbeddedCommentsIframe: boolean;
  const isInEmbeddedEditor: boolean;
  const embeddingOrigin: string | undefined;
  const embeddingUrl: string | undefined;
  const embeddedPageAltId: string | undefined;
  // Sometimes lazy-inited when the page gets lazy-created, when the first reply is posted. [4HKW28]
  let embeddedPageId: string | undefined;

  // When creating new site.
  const baseDomain: string | undefined;
}

// Old:
declare const debiki: any;
