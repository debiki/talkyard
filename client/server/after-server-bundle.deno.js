/**
 * Copyright (c) 2014-2023 Kaj Magnus Lindberg
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
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/// <reference path="../types-and-const-enums.ts" />


function renderReactServerSide(reactStore) {
  var exceptionAsString;
  try {
    theStore = reactStore;
    theStore.currentPage = theStore.pagesById[theStore.currentPageId];

    // Fill in no-page-data to avoid null errors. Dupl code. [4FBR20]
    theStore.me.myCurrentPageData = {
      pageId: '0', // EmptyPageId, but isn't defined here
      myPageNotfPref: undefined,
      groupsPageNotfPrefs: [],
      votes: {},
      unapprovedPosts: {},
      unapprovedPostAuthors: [],
      postNrsAutoReadLongAgo: [],
      postNrsAutoReadNow: [],
      marksByPostId: {},
    };

    // Each language file creates a 't_(lang-code)' global variable, e.g. 't_en_US' for English.
    // And they all set a global 'var t' to themselves (t is declared in those files).
    // Update 't' here; it gets used during rendering. If language missing (that'd be a bug),
    // fallback to English.
    var langCode = theStore.settings.languageCode || '$languageCode';
    t = global['t_' + langCode] || t_en_US;

    // The React store should be used instead, when running React.
    eds.uploadsUrlPrefixCommonmark = 'TyEFORCOMMONMARK';  // [7AKBQ2]

    var pageHtml = debiki2.renderPageServerSideToString();
    return new Response(pageHtml);
  }
  catch (e) {
    printStackTrace(e);
    exceptionAsString = exceptionToString(e);
    const errMsg = '$ErrorRenderingReact\n\n' + exceptionAsString;  // TODO
    return new Response(errMsg, { status: 500 });
  }
  finally {
    // Reset things to error codes, to fail fast, if attempts to access these,
    // when using this same Nashorn engine to render Markdown to HTML.
    t = 'TyEBADACCESSLANG';
    theStore = 'TyEBADACCESSSTORE';
  }
}


var md;
try {
  // Dupl code browser side: [9G03MSRMW2].
  md = markdownit({ html: true, linkify: true, breaks: true });
  md.use(debiki.internal.MentionsMarkdownItPlugin);
  md.use(debiki.internal.LinkPreviewMarkdownItPlugin);
  ed.editor.CdnLinkifyer.replaceLinks(md);
}
catch (e) {
  console.error("Error creating CommonMark renderer: [TyECMARKRENDR]");
  printStackTrace(e);
}

// Returns [html, mentions] if ok, else a string with an error message
// and exception stack trace.
function renderAndSanitizeCommonMark(ps: {
      commonmarkSource: St,
      allowClassIdDataAttrs: Bo,
      followLinks: Bo,
      instantLinkPreviewRenderer: null,
      uploadsUrlPrefixCommonmark: St }): Response {
  var exceptionAsString;
  try {
    theStore = null; // Fail fast. Don't use here, might not have been inited.
    eds.uploadsUrlPrefixCommonmark = ps.uploadsUrlPrefixCommonmark;  // [7AKBQ2]
    debiki.internal.serverSideLinkPreviewRenderer = ps.instantLinkPreviewRenderer;
    debiki.mentionsServerHelp = [];
    var unsafeHtml = md.render(ps.commonmarkSource);
    var mentionsThisTime = debiki.mentionsServerHelp;
    delete debiki.mentionsServerHelp;
    var allowClassAndIdAttr = ps.allowClassIdDataAttrs;
    var allowDataAttr = ps.allowClassIdDataAttrs;
    var safeHtml = googleCajaSanitizeHtml(
          unsafeHtml, allowClassAndIdAttr, allowDataAttr, ps.followLinks);
    // Fail fast — simplify detection of reusing without reinitialzing:
    eds.uploadsUrlPrefixCommonmark = 'TyE4GKFWB0';
    debiki.internal.serverSideLinkPreviewRenderer = 'TyE56JKW20';
    return Response.json({ safeHtml, mentions: mentionsThisTime });  // stringify ?
  }
  catch (e) {
    console.error("Error in renderAndSanitizeCommonMark: [TyERNDRCM02A]");
    printStackTrace(e);
    exceptionAsString = exceptionToString(e);
    const errMsg = "Error in renderAndSanitizeCommonMark: [TyERNDRCM02B]\n\n" +
                        exceptionAsString;
    return new Response(errMsg, { status: 500 });
  }
}

// (Don't name this function 'sanitizeHtml' because it'd then get overwritten by
// a function with that same name from a certain sanitize-html npm module.)
function sanitizeHtmlServerSide(ps: { source: St, followLinks?: Bo }): Response {
  try {
    // This function calls both Google Caja and the sanitize-html npm module. CLEAN_UP RENAME.
    const safeHtml = googleCajaSanitizeHtml(ps.source, false, false, ps.followLinks);
    return new Response(safeHtml);
  }
  catch (e) {
    printStackTrace(e);
    exceptionAsString = exceptionToString(e);
    return new Response("Error sanitizing HTML in render server [TyE5GBCU6]\n\n" +
            exceptionAsString, { status: 500 });
  }
}

// If line and column numbers aren't defined, the exception might be a Nashorn bug.
// For example, if the exception.toString is: 'java.lang.ArrayIndexOutOfBoundsException: 10'.
function printStackTrace(exception) {
  console.error('File: nashorn-ok-delete.js');
  console.error('Line: ' + exception.lineNumber);
  console.error('Column: ' + exception.columnNumber);
  console.error('Stack trace: ' + exception.stack);
  console.error('Exception as is: ' + exception);
  console.error('Exception as JSON: ' + JSON.stringify(exception));
}

// CLEAN_UP DO_AFTER 2018-11-01 use this + console.error(), instead of printStackTrace(exception) ?
// — just wait for a short while, in case there's some surprising problem with this fn:
// Could actually remove printStackTrace() and always log the error from Scala instead? since
// needs to return the error to Scala anyway, so can show in the browser.
function exceptionToString(exception) {
  return (
      'File: nashorn-ok-delete.js\n' +
      'Line: ' + exception.lineNumber  + '\n' +
      'Column: ' + exception.columnNumber  + '\n' +
      'Exception message: ' + exception + '\n' +
      'Exception as JSON: ' + JSON.stringify(exception) + '\n' +
      // It's useful to include the 2 lines above, not only `.stack` below, because
      // sometimes, e.g. if doing `throw 'text'`, then `.stack` will be `undefined`.
      // However, `exception.toString()` will be 'text'.
      'Stack trace: ' + exception.stack  + '\n');
}


globalThis.serverReqHandler = async (req: Request): Pr<Response> => {
  console.debug("Method:", req.method);

  const url = new URL(req.url);
  console.debug("Path:", url.pathname);
  console.debug("Query parameters:", url.searchParams);

  console.debug("Headers:", req.headers);

  if (!req.body) {
    return new Response("No request body [TyERENDSV_0BDY]", 400);
  }

  const reqBody = await req.text();
  console.debug("Body:", reqBody);

  let reqJson;
  try {
    reqJson = JSON.parse(reqBody);
  }
  catch (ex) {
    printStackTrace(e);
    exceptionAsString = exceptionToString(e);
    const errMsg = `Invalid JSON sent to: ${url.pathname} [TyERENDSV_JSN]\n\n` +
            exceptionAsString;
    return new Response(errMsg, 400);
  }

  let response: Response;

  if (url.pathname === '/renderAndSanitizeCommonMark') {
    console.debug(`I will:  renderAndSanitizeCommonMark`);
    response = renderAndSanitizeCommonMark(reqJson);
            // renderAndSanitizeCommonMark(reqBody, false, false, null, '/uploads_url_prefx/');
    // It works!
    /*
    curl http://localhost:8087/renderAndSanitizeCommonMark -d  '**boldify** _italics_   

    ```
    code in
       backticks()
    ```
    '   */
  }
  else if (url.pathname === '/sanitizeHtmlServerSide') {
    console.debug(`I will:  sanitizeHtmlServerSide`);
    response = sanitizeHtmlServerSide(reqJson);

    // It works!
    //    curl http://localhost:8087/sanitizeHtmlServerSide -d '<div>I am in a div. JSON: {"aa": 11, "bb": 22}</div> <b>bold?</bold> Param like:  http://ex.co/aa/bb?qq=vv;q2=v2,q3=v3'
    //
  }
  else if (url.pathname === '/renderReactServerSide') {
    console.debug(`I will:  renderReactServerSide`);
    response = renderReactServerSide(reqJson);
  }
  else if (url.pathname === '/slugifyTitle') {
    console.debug(`I will:  slugifyTitle`);
    const titleSlug = window.debikiSlugify(reqJson.title);
    response = new Response(titleSlug);
  }
  else if (url.pathname === '/denoExit') {
    console.debug(`I will:  Deno.exit`);
    Deno.exit();
  }
  else {
    console.error(`I won't:  ${url.pathname}`);
    response = new Response(`Bad url path: ${url.pathname}`, { status: 400 })
  }

  return response;
}


