/// <reference path="model.ts" />

// The variables declared here are initialized in a certain <head><script>.  [5JWKA27]

declare namespace eds {
  const pubSiteId: string;
  const siteId: number;  // only in Dev mode
  const secure: boolean;
  const isDev: boolean;
  const isTestSite: boolean;
  const loadGlobalAdminTestScript: boolean;
  const loadGlobalStaffScript: boolean;

  const minMaxJs: boolean;
  const serverOrigin: string;
  const cdnOriginOrEmpty: string;
  const cdnOrServerOrigin: string;
  const assetUrlPrefix: string;
  const uploadsUrlPrefix: string;

  const currentVersion: string;
  const cachedVersion: string;

  const pageDataFromServer: any;
  const volatileDataFromServer: any;

  const isInLoginWindow: boolean;
  const isInLoginPopup: boolean;
  const isInIframe: boolean;

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
