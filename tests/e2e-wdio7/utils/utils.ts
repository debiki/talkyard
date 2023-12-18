/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from './ty-assert';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { j2s, logMessage, logBoring, logUnusual, logError, dieIf, logWarning } from './log-and-die';
import settings from './settings';
import c from '../test-constants';
import * as utils from './utils';
import { SiteType, NewSiteOwnerType } from '../test-constants';

const toTalkyardScript =
        (settings.isInProjBaseDir ? './' : '../../') +
        'to-talkyard/dist/to-talkyard/src/to-talkyard.js';


export function firstDefinedOf(x, y, z?) {
  return !_.isUndefined(x) ? x : (!_.isUndefined(y) ? y : z);
}

export function encodeInBase64(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64');
}

export function regexEscapeSlashes(origin: string): string {
  return origin.replace(/\//g, '\\/');
}

export function generateTestId(): string {
  return Date.now().toString().slice(3, 10);
}

export function generateNewSiteData(ps: {
  newSiteOwner?: NewSiteOwnerType,
  alreadyLoggedInAtIdProvider?: boolean,
} = {}): NewSiteData {

  const testId = utils.generateTestId();
  const localHostname = utils.getLocalHostname('create-site-' + testId);

  return {
    siteType: SiteType.Forum,
    testId: testId,
    localHostname: localHostname,
    origin: utils.makeSiteOrigin(localHostname),
    //originRegexEscaped: utils.makeSiteOriginRegexEscaped(localHostname),
    orgName: "E2E Org Name",
    newSiteOwner: ps.newSiteOwner ||
        // Backw compat, old tests:
        NewSiteOwnerType.OwenOwner,
    alreadyLoggedInAtIdProvider: ps.alreadyLoggedInAtIdProvider,
    fullName: 'E2E Test ' + testId,
    email: settings.testEmailAddressPrefix + testId + '@example.com',
    // Prefix the number with 'z' because '..._<number>' is reserved. [7FLA3G0L]
    username: 'e2e_test_z' + testId,
    password: 'pub5KFV2FY8C',
  }
}

export async function postJsonPatchToTalkyard(ps: {
        filePath: St, apiSecret: St, talkyardSiteOrigin: St, fail?: true,
        expectedErrors?: St[] }) {
  const cmd =
      `node ${toTalkyardScript} ` +
        `--talkyardJsonPatchFile=${ps.filePath} ` +
        `--sysbotApiSecret=${ps.apiSecret} ` +
        `--sendTo=${ps.talkyardSiteOrigin}`
  logMessage(`Executing this:\n  ${cmd}`)
  try {
    await execSync(cmd);  // 'await' so won't forget later
    if (ps.fail) {
      assert.fail(`This ought to have failed:\n\n` +
      `    ${cmd}\n\n` +
      `    with these error substrings: ${j2s(ps.expectedErrors)}\n`);
    }
  }
  catch (ex) {
    if (!ps.fail) throw ex;
    const actualErrText = ex.toString();
    for (const expErr of ps.expectedErrors || []) {
      assert.includes(actualErrText, expErr);
    }
  }
}

export function getLocalHostname(anyDefaultNameExclTestPrefix?: string): string {
  return settings.localHostname || (
      anyDefaultNameExclTestPrefix
          ? settings.testLocalHostnamePrefix + anyDefaultNameExclTestPrefix
          : (global as any).__thisSpecLocalHostname);
}

export function makeSiteOrigin(localHostname: string): string {
  return settings.scheme + '://' + localHostname + '.' + settings.newSiteDomain;
}

export function makeSiteOriginRegexEscaped(localHostname: string): string {
  return settings.scheme + ':\\/\\/' + localHostname + '.' + settings.newSiteDomain;
}

export function makeCreateSiteWithFakeIpUrl(): St {
  return _makeCreateSiteUrlImpl(false);
}

export function makeCreateEmbeddedSiteWithFakeIpUrl(): St {
  return _makeCreateSiteUrlImpl(true);
}

function _makeCreateSiteUrlImpl(isEmbeddedSite: boolean): St {
  function randomIpPart() { return '.' + Math.floor(Math.random() * 256); }
  const ip = '0' + randomIpPart() + randomIpPart() + randomIpPart();
  const embedded = isEmbeddedSite ? '/embedded-comments' : '';
  return settings.mainSiteOrigin + `/-/create-site${embedded}?fakeIp=${ip}` +
      `&e2eTestPassword=${settings.e2eTestPassword}&testSiteOkDelete=true`;
}

///
/// Changes e.g.: "http://e2e-test-cid-0-0-now-6233.localhost/-2/owenspagetitle"
///      to e.g.: "http://e2e-test-cid-0-0-now-6233.localhost/-2#post-1"
///
export function replaceSlugWithPostNr(pageUrl: St, postNr: PostNr): St {
  return pageUrl.replace(/\/[^/]+$/, `#post-${postNr}`);
}

export function findFirstLinkToUrlIn(url: St, text: St): St {
  return _findFirstLinkToUrlImpl(url, text, true);
}

export function findAnyFirstLinkToUrlIn(url: St, text: St): St | U {
  return _findFirstLinkToUrlImpl(url, text, false);
}

function _findFirstLinkToUrlImpl(url: string, text: string, mustMatch: boolean): string | U {
  // Make sure ends with ", otherwise might find: <a href="..">http://this..instead..of..the..href</a>.
  // This:  (?: ...)  is a non-capture group, so the trailing " won't be incl in the match.
  const regexString = '(' + regexEscapeSlashes(url) + '[^"\']*)(?:["\'])';
  const matches = text.match(new RegExp(regexString));
  dieIf(mustMatch && !matches,
      `No link matching /${regexString}/ found in email [EsE5GPYK2],\n` +
      `---- email body: --------------------------\n${
      text
      }\n------------------------------------------`);
  return matches ? matches[1] : undefined;
}


export function numReplies(n: Partial<NumReplies>): NumReplies {
  return {
    numNormal: 0,
    numPreviews: 0,
    numDrafts: 0,
    numUnapproved: 0,
    numDeleted: 0,
    ...n,
  };
}


const __brokenPreview = '.s_LnPv-Err';
const __intLinkProvider: LinkPreviewProvider = { name: 'Int', inSandboxedIframe: false };


// REMOVE use makeLinkPreviewSelector(..) instead.
export function makePreviewOkSelector(provider: LinkPreviewProvider | 'InternalLink',
        opts: { url?: St } = {}): St {
  return makeLinkPreviewSelector(provider, { ...opts, broken: false });
}


// REMOVE use makeLinkPreviewSelector(..) instead.
export function makePreviewBrokenSelector(provider: LinkPreviewProvider | 'InternalLink',
        opts: { url?: St, errCode?: St } = {}): St {
  return makeLinkPreviewSelector(provider, { ...opts, broken: true });
}


export function makeLinkPreviewSelector(provider: LinkPreviewProvider | 'InternalLink',
          opts: { url?: St, broken?: Bo, errCode?: St } = {}): St {

    // Internal broken links renders as normal links, in case some people
    // may actually see the linked page — maybe it's access restricted. Then
    // it'd be weird with a "Not found" error text.  [brkn_int_ln_pv]
    if (provider === 'InternalLink' && opts.broken) {
      // The error code might be longer than opts.errCode — so don't require
      // a full match.  It's not incl in prod builds.
      const dashErrCode = !opts.errCode || settings.prod ? '' : '-' + opts.errCode;
      let sel = `a[class^="c_LnPvNone${dashErrCode}"]`;
      if (opts.url) {
        sel += `[href="${opts.url}"]`;
      }
      return sel;
    }

    if (provider === 'InternalLink') provider = __intLinkProvider;
    const colonNotPara = opts.broken ? '' : ':not(';
    const endPara      = opts.broken ? '' : ')';
    let sel = `.s_LnPv-${provider.lnPvClassSuffix || provider.name}${
          colonNotPara}${
            __brokenPreview}${
          endPara}`;
    if (opts.url) sel += ` a[href="${opts.url}"]`;
    return sel;
}


export async function ssoLogin(ps: { member: Member, ssoId, browser,
        origin: string, server, apiSecret: string, apiRequesterId?: UserId,
        thenGoTo: string }) {
    const extUser = makeExternalUserFor(ps.member, { ssoId: ps.ssoId });
    logMessage(`SSO: Upserting @${ps.member.username}, getting a one time secret ...`);
    const oneTimeLoginSecret = await ps.server.apiV0.upsertUserGetLoginSecret({
        origin: ps.origin,
        apiRequesterId: ps.apiRequesterId || c.SysbotUserId,
        apiSecret: ps.apiSecret,
        externalUser: extUser });
    logMessage(`SSO: Logging in as @${ps.member.username}, using one time secret ...`);
    await ps.browser.apiV0.loginWithSecret({
        origin: ps.origin,
        oneTimeSecret: oneTimeLoginSecret,
        thenGoTo: ps.thenGoTo || '/' });
    logMessage(`SSO: Done`);
}


/// For blog comments SSO.
///
/// Used to use this Javascript lib:
/// import * as Paseto from 'paseto.js';
/// But, crypto problem, see:
///     ./embcom.sso.token-in-cookie.2br.test.ts--e2e-crypto-probl.txt
///
export function encryptLocalPasetoV2Token(sharedSecret: St, msgObj: any): St {
  const messageAsSt = JSON.stringify(msgObj);
  const secretNoHexPrefix = sharedSecret.replace(/^hex:/, '');
  const cmd = '../../modules/paseto-cmd/target/debug/paseto-cmd ' +
                `'${secretNoHexPrefix}' ` +
                `'${messageAsSt}'`;
  const token = execSync(cmd, { encoding: 'utf8' }).trim();
  const username: St | U = msgObj?.data?.user?.username;
  const logMsg = `Generated PASETO token for ${username}:  ${token}`;
  if (username) logBoring(logMsg);
  else logWarning(logMsg + ` BUT username missing in token data? User missing?`);
  return 'paseto:' + token;
}


export function makeExternalUserFor(member: Member, opts: {
    ssoId: string,
    primaryEmailAddress?: string,
    isEmailAddressVerified?: boolean,
    username?: string,
    fullName?: string,
    avatarUrl?: string,
    aboutUser?: string,
    isAdmin?: boolean,
    isModerator?: boolean,
  }): ExternalUser {
    return {
      ssoId: opts.ssoId,
      primaryEmailAddress: firstDefinedOf(opts.primaryEmailAddress, member.emailAddress),
      isEmailAddressVerified: firstDefinedOf(opts.isEmailAddressVerified, !!member.emailVerifiedAtMs),
      username: firstDefinedOf(opts.username, member.username),
      fullName: firstDefinedOf(opts.fullName, member.fullName),
      avatarUrl: opts.avatarUrl,
      aboutUser: opts.aboutUser,
      isAdmin: firstDefinedOf(opts.isAdmin, member.isAdmin),
      isModerator: firstDefinedOf(opts.isModerator, member.isModerator),
    };
}


export function makeEmbeddedCommentsHtml(ps: { pageName: string, discussionId?: string,
      talkyardPageId?: string, categoryRef?: string,
      localHostname?: string, color?: string, bgColor: string, htmlToPaste?: string,
      talkyardConsiderQueryParams?: St[],
      authnToken?: St | Ay, authnTokenCookie?: St | Ay,
      talkyardLogLevel?: St | Nr, appendExtraHtml?:  St  }): St {
    // Dupl code [046KWESJJLI3].
    dieIf(!!ps.localHostname && !!ps.htmlToPaste, 'TyE502PK562');
    dieIf(!ps.localHostname && !ps.htmlToPaste, 'TyE7FHQJ45X');
    let htmlToPaste = ps.htmlToPaste;

    const discIdAttr = `data-discussion-id="${ps.discussionId || ''}"`;
    const catRefAttr = ps.categoryRef ? `data-category="${ps.categoryRef}"` : '';

    if (ps.discussionId && htmlToPaste) {
      htmlToPaste = htmlToPaste.replace(
        ` data-discussion-id=""`, ` data-discussion-id="${ps.discussionId}"`);
    }

    const talkyardLogLevel = _.isUndefined(ps.talkyardLogLevel) ? '' :
            `talkyardLogLevel=${ps.talkyardLogLevel}`;
    const ignQueryParams = !ps.talkyardConsiderQueryParams ? '' :
            `talkyardConsiderQueryParams = ${JSON.stringify(ps.talkyardConsiderQueryParams)};`;

    // Dupl code [_authn_tokn_html].
    const authnTokenCookieScript = !ps.authnTokenCookie ? '' : `
<script>
document.cookie = 'TalkyardAuthnToken=${ps.authnTokenCookie}; Max-Age=3600; path=/';
</script>`;

    const authnTokenScript = !ps.authnToken ? '' : `
<script>
talkyardAuthnToken = ${JSON.stringify(ps.authnToken)};
</script>`;

    const ieEmpty = !ps.discussionId ? ', i.e. <b>no</b> id' : '';

    let resultHtmlStr = `
<!DOCTYPE html>
<html>
<head><title>Embedded comments E2E test</title></head>
<body style="background: ${ps.bgColor || 'black'}; color: ${ps.color || '#ccc'}; font-family: monospace; font-weight: bold;">
<p>Embedded comments E2E test page "${ps.pageName}".<br>
Discussion id: "${ps.discussionId || ''}"${ieEmpty}.<br>
Talkyard page id: "${ps.talkyardPageId || ''}".<br>
Category ref: "${ps.categoryRef || ''}"${ps.categoryRef ? '' : " (none)"}.<br>
Ok to delete. The comments: (generated by the admin js bundle [2JKWTQ0])</p>
<hr>
${ htmlToPaste ? htmlToPaste :
authnTokenCookieScript +
authnTokenScript + `
<script>
talkyardServerUrl='${settings.scheme}://${ps.localHostname}.localhost';
${talkyardLogLevel}
${ignQueryParams}
</script>
<script async defer src="${settings.scheme}://${ps.localHostname}.localhost/-/talkyard-comments.js"></script>
<div class="talkyard-comments" ${discIdAttr} ${catRefAttr} style="margin-top: 45px;"></div>
`}
${ps.appendExtraHtml || ''}
<hr>
<p>/End of page.</p>
</body>
</html>`;

    if (ps.talkyardPageId) {
      // The attribute  data-talkyard-page-id  isn't included by default.
      resultHtmlStr = resultHtmlStr.replace(
        ` data-discussion-id=`,
        ` data-talkyard-page-id="${ps.talkyardPageId}" data-discussion-id=`);
    }

    return resultHtmlStr;
  }


export function makeManyEmbeddedCommentsHtml(ps: {
      pageName: St, discussionIds?: St[],
      showCommentCountsForDiscIds?: St[],
      localHostname?: St, color?: St, bgColor: St,
      authnToken?: St | Ay, authnTokenCookie?: St | Ay   }): St {
    // Dupl code [046KWESJJLI3].

    const showDiscIds = ps.discussionIds || [];
    const showCountsForDiscIds = ps.showCommentCountsForDiscIds || [];
    let allIds = [...showDiscIds, ...showCountsForDiscIds];
    allIds = _.uniq(allIds.sort());

    let multiCommentsHtml = '';
    for (let discId of allIds) {
      const discDiv = !showDiscIds.find(id => id === discId) ?  '' :
            `<div class="talkyard-comments" data-discussion-id="${discId}"></div>`;
      const countDiv = !showCountsForDiscIds.find(id => id === discId) ?  '' :
            `<div>Num comments: <span class="ty_NumCmts" data-discussion-id="${
              discId}"></span></div>`;
      multiCommentsHtml += `
<hr>
<div class="diid-${discId}">
<p>Discussion id '${discId}':</p>
${discDiv}
${countDiv}
</div>
`
    }

    // Dupl code [_authn_tokn_html].
    const authnTokenCookieScript = !ps.authnTokenCookie ? '' : `
<script>
document.cookie = 'TalkyardAuthnToken=${ps.authnTokenCookie}; Max-Age=3600; path=/';
</script>`;

    const authnTokenScript = !ps.authnToken ? '' : `
<script>
talkyardAuthnToken = ${JSON.stringify(ps.authnToken)};
</script>`;

    let resultHtmlStr = `
<html>
<head>
<title>Embedded comments many iframes E2E test</title>
<style>
body { background: ${ps.bgColor || 'black'}; color: ${ps.color || '#ccc'}; font-family: monospace; }
iframe { margin: 15px 0 25px; }
</style>
</head>
<body>
<div id="comment_iframes">
<p>Embedded comments E2E test page "${ps.pageName}".<br>
Discussion ids: ${j2s(showDiscIds)}.<br>
Comment counts disc ids: ${j2s(showCountsForDiscIds)}.<br>
Ok to delete. The comments: (generated by the admin js bundle [603MRATE24])</p>
<hr>
${ authnTokenCookieScript }
${ authnTokenScript }
<script>
talkyardServerUrl='${settings.scheme}://${ps.localHostname}.localhost';
</script>
<script async defer src="${settings.scheme}://${ps.localHostname}.localhost/-/talkyard-comments.js"></script>
${multiCommentsHtml}
<hr>
</div>
<p>/End of page.</p>
</body>
</html>`;

    return resultHtmlStr;
  }


export function makeBlogPostIndexPageHtml(ps: { localHostname?: St, urlA: St, urlB: St, urlC: St,
          urlD: St, urlE: St, urlF: St, urlG: St,
          urlH: 'NoHref', urlI: 'NoLinkTag' }): St {
    // For now:
    const tyServerOrigin = `${settings.scheme}://${ps.localHostname}.localhost`;
    const html = `
        <html>
        <head>
        <title>Embedded comments E2E test</title>
        <style>a { color: white }</style>
        </head>
        <body style="background: #000; color: #bbb; font-family: monospace;">
        <p>Embedded comments E2E test page, for showing comment counts. [7J3RKHULWF4]<p>

        <script>talkyardServerUrl='${tyServerOrigin}';</script>
        <script async defer src='${tyServerOrigin}/-/talkyard-comments.js'></script>

        <h2>Test blog posts list</h2>
        <ol>${''
          /* Trying with a bit different HTML structure below, in each <li>
                  — everything should work fine  */}
          <li>
            <a href="${ps.urlA}">
              A:
              <span class="ty_NumCmts"></span> comments,
              <span class="ty_NumOpLikeVotes"></span> likes, href: ${ps.urlA}<br>
            </a>
          </li>
          <li>
            <a href="${ps.urlB}">
              <span>B: </span>
              <span class="ty_NumCmts"></span> comments,
              <span class="ty_NumOpLikeVotes"></span> likes, href: ${ps.urlB}<br>
            </a>
          </li>
          <li>
            <a href="${ps.urlC}">C: </a>
            <a href="${ps.urlC}#comments-section" class="ty_NumCmts"></a> comments,
            <a href="${ps.urlC}#comments-section" class="ty_NumOpLikeVotes"></a> likes,
            href: ${ps.urlC}#comments-section
          </li>
          <li>
            ${''/*
            // Weird html structure: An enclosing elem with a href. (Cannot place
            // an <a> in an <a> so it'll be a div.href  not an  a.href)  */}
            <div href="http://wrong-url.example.com">
              <a href="${ps.urlD}">D: <span class="ty_NumCmts"></span></a> comments,
              <a href="${ps.urlD}"><span class="ty_NumOpLikeVotes"></span></a> likes,
              url: ${ps.urlD}
            </div>
          </li>
          <li>
            <a href="${ps.urlE}">E:
              <i><b><i><b><i class="ty_NumCmts"> comments
              </i></b></i></b></i>
            </a>, url: ${ps.urlE}, deeply nested comments count.
          </li>
          <li>
             F: <a href="${ps.urlF}" class="ty_NumCmts"></a> at url ${ps.urlF}
          </li>
          <li>
            <a href="${ps.urlG}" class="ty_NumCmts"></a>
            <span>, at urlG: ${ps.urlG}</span>
          </li>
          <li>
            <span>urlH: NoHref — the <a> tag has no href attr: </span>
            <a class="ty_NumCmts"></a>
          </li>
          <li>
            <span>urlI: NoLinkTag — there's no <a> tag </span>
            <span class="ty_NumCmts"></span>
          </li>
        </ol>
        <p>/End of page.</p>
        </body>
        </html>`;

    assert.eq(html.match(/ty_NumCmts/g).length, 9);  // ttt
    return html;
  }


export const ssoLoginPageSlug = 'sso-dummy-login.html';
export const ssoAfterLogoutPageSlug = 'after-logout-page.html';
export const ssoLogoutRedirPageSlug = 'logout-redir-page.html';

export function createSingleSignOnPagesInHtmlDir() {
    // Chrome? Webdriverio? wants a 200 OK reply, so we need dummy pages.
    createPageInHtmlDirUnlessExists(ssoLoginPageSlug,
            '<html><body>\n' +
            "SSO Login Ty test page. [8906QKSHM40]\n" +
            '</body></html>\n');
    createPageInHtmlDirUnlessExists(ssoAfterLogoutPageSlug,
            '<html><body>\n' +
            "After Logout Ty SSO test page. [AFT_LGO_TST_537503_]\n" +
            '</body></html>\n');
    createPageInHtmlDirUnlessExists(ssoLogoutRedirPageSlug,
            '<html><body>\n' +
            "Logout Redir Ty SSO test page. [LGO_RDR_TST_865033_]\n" +
            '</body></html>\n');
  }


export function createPageInHtmlDirUnlessExists(pageSlug: St, html: St) {
    const fileSysPath = './target/' + pageSlug;
    if (fs.existsSync(fileSysPath)) {
      logMessage(`Page already exists: ${fileSysPath}`);
      return;
    }
    logMessage(`Creating html page: ${fileSysPath}`);
    fs.writeFileSync(fileSysPath, html);
  }


export function page_isChat(pageRole: PageRole): Bo {
  return pageRole === c.TestPageRole.JoinlessChat ||
          pageRole === c.TestPageRole.OpenChat ||
          pageRole === c.TestPageRole.PrivateChat;
}


export function checkNewPageFields(page, ps: {
     categoryId: CategoryId,
      authorId?: UserId,
      numPostsTotal?: number,
    }) {

    // -2: Skip title and body posts.
    const numRepliesTotal = ps.numPostsTotal ? ps.numPostsTotal - 2 : 0;

    assert.eq(page.htmlTagCssClasses, "");
    assert.eq(page.hiddenAt, null);
    assert.ok(!!page.createdAtMs);
    assert.ok(!!page.publishedAtMs);
    assert.ok(!!page.updatedAtMs);
    if (ps.authorId) assert.eq(page.authorId, ps.authorId);
    // The version number is 2 (not 1 becuse the page gets re-saved with correct
    // stats and a version bump, after the initial insert (with wrong stats)). [306MDH26]
    assert.eq(page.version, 2);
    assert.eq(page.categoryId, ps.categoryId);
    assert.eq(page.numLikes, 0);
    assert.eq(page.numWrongs, 0);
    assert.eq(page.numBurys, 0);
    assert.eq(page.numUnwanteds, 0);
    assert.eq(page.numOrigPostLikeVotes, 0);
    assert.eq(page.numOrigPostWrongVotes, 0);
    assert.eq(page.numOrigPostBuryVotes, 0);
    assert.eq(page.numOrigPostUnwantedVotes, 0);
    assert.eq(page.numPostsTotal, ps.numPostsTotal || 2);
    assert.eq(page.numRepliesTotal, numRepliesTotal);
    assert.eq(page.numRepliesVisible, numRepliesTotal);
    if (page_isChat(page.pageType)) {
      // Chat messages don't reply to any particular post.
      assert.eq(page.numOrigPostRepliesVisible, 0);
    }
    else {
      // For now. (Won't work if a post replies to not-the-OP.)
      assert.eq(page.numOrigPostRepliesVisible, numRepliesTotal);
    }

    // Maybe shouldn't include the below things, + some things above, in the publ api?
    // So don't bother updating this test code — for now, just return instead,
    // if there're replies included on the page already.
    // And later, remove everything below? + some / most tests above.
    if (ps.numPostsTotal)
      return;
    assert.eq(page.lastApprovedReplyById, null);
    assert.eq(page.lastApprovedReplyAt, null);
    assert.eq(page.pinOrder, null);
    assert.eq(page.pinWhere, null);
    assert.eq(page.answeredAt, null);
    assert.eq(page.answerPostId, null);
    assert.eq(page.lockedAt, null);
    assert.eq(page.plannedAt, null);
    assert.eq(page.startedAt, null);
    assert.eq(page.bumpedAtMs, null);
    assert.eq(page.doingStatus, 1);
    assert.eq(page.doneAt, null);
    assert.eq(page.closedAt, null);
    assert.eq(page.unwantedAt, null);
    assert.eq(page.frozenAt, null);
    assert.eq(page.deletedAt, null);
    assert.eq(page.htmlHeadDescription, "");
    assert.eq(page.htmlHeadTitle, "");
    assert.eq(page.layout, 0);
    assert.eq(page.embeddingPageUrl, null);
    assert.ok(!!page.frequentPosterIds);
    assert.eq(page.frequentPosterIds.length, 0);
}


export function checkNewPostFields(post, ps: {
      postNr: PostNr,
      parentNr?: PostNr,
      postType: PostType,
      pageId: PageId,
      authorId?: UserId,
      approvedSource: string,
      approvedHtmlSanitized: string,
    }) {

    assert.ok(!post.lastApprovedEditAt);
    assert.eq(post.closedStatus, 0);
    assert.eq(post.numPendingEditSuggestions, 0);
    assert.eq(post.nr, ps.postNr);
    if (ps.parentNr) assert.eq(ps.parentNr, post.parentNr);
    assert.ok(!post.bodyHiddenById);
    assert.ok(!post.currRevSourcePatch);
    assert.ok(!post.collapsedById);
    assert.eq(post.numUnwantedVotes, 0);
    assert.eq(post.numHandledFlags, 0);
    assert.eq(post.numWrongVotes, 0);
    assert.ok(!post.prevRevNr);
    assert.ok(!!post.createdAt);
    assert.ok(!post.closedById);
    assert.ok(!!post.currRevStartedAt);
    assert.eq(post.approvedRevNr, 1);
    assert.ok(!post.collapsedStatus);
    assert.eq(post.currRevNr, 1);
    assert.ok(!post.deletedById);
    assert.eq(post.numPendingFlags, 0);
    assert.ok(!!post.id);
    assert.eq(post.approvedById, c.SysbotUserId);
    assert.ok(!post.closedAt);
    assert.eq(post.numLikeVotes, 0);
    assert.eq(post.numTimesRead, 0);
    if (ps.authorId) assert.eq(post.createdById, ps.authorId);
    assert.ok(!post.branchSideways);
    assert.eq(post.deletedStatus, 0);
    assert.ok(!post.pinnedPosition);
    assert.ok(!post.safeRevNr);
    assert.eq(post.postType, ps.postType);
    //assert.eq(post.multireplyPostNrs, []);  not in use
    assert.eq(post.pageId, ps.pageId);
    assert.ok(!!post.approvedAt);
    assert.ok(!post.collapsedAt);
    assert.ok(!!post.urlPaths.canonical);
    assert.ok(post.urlPaths.canonical.endsWith('#post-' + post.nr));
    assert.ok(!post.deletedAt);
    assert.ok(!post.bodyHiddenAt);
    assert.eq(post.numDistinctEditors, 1);
    assert.eq(post.numBuryVotes, 0);
    assert.ok(!post.currRevLastEditedAt);
    assert.eq(post.approvedSource.trim(), ps.approvedSource.trim());
    assert.ok(!post.bodyHiddenReason);
    assert.eq(post.approvedHtmlSanitized.trim(), ps.approvedHtmlSanitized.trim());
    if (ps.authorId) assert.eq(post.currRevById, ps.authorId);
    assert.ok(!post.lastApprovedEditById);
}


export async function tryManyTimes<R>(what, maxNumTimes, fn: () => Pr<R>,
          ps: { afterErr?: () => Pr<Vo> } = {}): Pr<R> {
  let delayMs = 250;
  let res: any;
  for (let retryCount = 1; retryCount <= maxNumTimes; ++retryCount) {
    try {
      res = await fn();
      break;
    }
    catch (ex) {
      if (retryCount < maxNumTimes) {
        logUnusual(`RETRYING: ${what}  [TyME2ERETRY], because: ${ex.toString()}`);
        if (ps.afterErr) {
          await ps.afterErr();
        }
      }
      else {
        logError(`Failed too many times: ${what}  [TyEE2ERETRY], error: ${ex.toString()}`);
        throw ex;
      }
    }

    await oneWdioBrowser.pause(delayMs);
    delayMs = delayMs * 1.3
    delayMs = Math.min(2500, delayMs);
  }

  dieIf(res === false, `Don't use tryManyTimes() with a fn that returns false —
              did you mean to use tryUntilTrue() instead? [TyE8RDK256]`)
  return res;
}


export async function tryUntilTrue<R>(what: St, maxNumTimes: Nr | 'ExpBackoff',
        fn: 'ExpBackoff' | (() => Pr<Bo>), fn2?: () => Pr<Bo>) {
    let delayMs = 300;

    const doExpBackoff = maxNumTimes === 'ExpBackoff' || fn === 'ExpBackoff';
    if (_.isString(fn)) {
      fn = fn2;
    }

    for (let retryCount = 0; true; ++retryCount) {
      if (retryCount === maxNumTimes)
        throw Error(`Tried ${maxNumTimes} times but failed:  ${what}`)

      try {
        const done = await fn();
        if (done)
          return;

        logUnusual(`Retrying: ${what}  [TyME2ERETRYA]`);
      }
      catch (error) {
        logUnusual(`Retrying: ${what}  [TyME2ERETRYB], because error: ${error.toString()}`);
      }

      if (doExpBackoff) {
        await oneWdioBrowser.pause(delayMs);
        delayMs = delayMs * 1.3
        delayMs = Math.min(2500, delayMs);
      }
      else {
        await oneWdioBrowser.pause(delayMs);
      }
    }
}
