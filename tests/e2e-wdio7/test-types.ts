/// <reference path="./test-types2.ts" />
/// <reference path="./pub-api.ts" />


declare global {

  // Unique hostname for the current test run, so sites won't overwrite each other.
  const __thisSpecLocalHostname: string | undefined;
  function getCidOrDie(): string;



  // ----- WebdriverIO

  // It's unclear if 'browser' refers to an instance of TyE2eTestBrowser
  // or WebdriverIO.BrowserObject, so let's avoid that name.
  const allWdioBrowsers: WebdriverIOAsync.MultiRemoteBrowser; // ... started
  const oneWdioBrowser: WebdriverIOAsync.MultiRemoteBrowser;
  const wdioBrowserA: WebdriverIOAsync.MultiRemoteBrowser;
  const wdioBrowserB: WebdriverIOAsync.MultiRemoteBrowser | U;
  const wdioBrowserC: WebdriverIOAsync.MultiRemoteBrowser | U;

  type Sel = St // selector
  type SelOrEl = St | WebdriverIO.Element;

}


export const enum IsWhere {
  Forum = 1,
  LoginPopup = 2,

  EmbFirst = 3,
  EmbeddingPage = 3,
  EmbCommentsIframe = 4,
  EmbEditorIframe = 5,
  EmbLast = 5,

  // E.g. a blog post index page, with <a href=...> to blog posts with emb comments.
  EmbeddedPagesListPage = 6,

  // If switching to e.g. a link preview embedded iframe.
  UnknownIframe = 9,

  // Another server, e.g. Google's OAuth login page. But not an
  // embedding blog post page.
  External = 10,
}


export function isWhere_isInIframe(where: IsWhere): Bo {
  switch (where) {
    case IsWhere.EmbCommentsIframe: // fall through
    case IsWhere.EmbEditorIframe: // fall through
    case IsWhere.UnknownIframe:
      return true;
    default:
      return false;
  }
}