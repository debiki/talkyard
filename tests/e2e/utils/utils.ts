/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import * as assert from './ty-assert';
import * as fs from 'fs';
import { logMessage, logUnusual, dieIf } from './log-and-die';
import settings = require('./settings');
import c = require('../test-constants');



function firstDefinedOf(x, y, z?) {
  return !_.isUndefined(x) ? x : (!_.isUndefined(y) ? y : z);
}

function encodeInBase64(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64');
}

const utils = {

  firstDefinedOf,

  encodeInBase64,

  regexEscapeSlashes: function(origin: string): string {
    return origin.replace(/\//g, '\\/');
  },

  generateTestId: function(): string {
    return Date.now().toString().slice(3, 10);
  },

  getLocalHostname(anyDefaultNameExclTestPrefix?: string): string {
    return settings.localHostname || (
        anyDefaultNameExclTestPrefix
            ? settings.testLocalHostnamePrefix + anyDefaultNameExclTestPrefix
            : (global as any).__thisSpecLocalHostname);
  },

  makeSiteOrigin: function(localHostname: string): string {
    return settings.scheme + '://' + localHostname + '.' + settings.newSiteDomain;
  },

  makeSiteOriginRegexEscaped: function(localHostname: string): string {
    return settings.scheme + ':\\/\\/' + localHostname + '.' + settings.newSiteDomain;
  },

  makeCreateSiteWithFakeIpUrl: function () {
    return utils._makeCreateSiteUrlImpl(false);
  },

  makeCreateEmbeddedSiteWithFakeIpUrl: function () {
    return utils._makeCreateSiteUrlImpl(true);
  },

  _makeCreateSiteUrlImpl: function (isEmbeddedSite: boolean) {
    function randomIpPart() { return '.' + Math.floor(Math.random() * 256); }
    const ip = '0' + randomIpPart() + randomIpPart() + randomIpPart();
    const embedded = isEmbeddedSite ? '/embedded-comments' : '';
    return settings.mainSiteOrigin + `/-/create-site${embedded}?fakeIp=${ip}` +
        `&e2eTestPassword=${settings.e2eTestPassword}&testSiteOkDelete=true`;
  },

  findFirstLinkToUrlIn: function(url: string, text: string): string {
    return utils._findFirstLinkToUrlImpl(url, text, true);
  },

  findAnyFirstLinkToUrlIn: function(url: string, text: string): string | U {
    return utils._findFirstLinkToUrlImpl(url, text, false);
  },

  _findFirstLinkToUrlImpl: function(url: string, text: string, mustMatch: boolean): string | U {
    // Make sure ends with ", otherwise might find: <a href="..">http://this..instead..of..the..href</a>.
    // This:  (?: ...)  is a non-capture group, so the trailing " won't be incl in the match.
    const regexString = '(' + utils.regexEscapeSlashes(url) + '[^"\']*)(?:["\'])';
    const matches = text.match(new RegExp(regexString));
    dieIf(mustMatch && !matches,
        `No link matching /${regexString}/ found in email [EsE5GPYK2], text: ${text}`);
    return matches ? matches[1] : undefined;
  },


  __brokenPreview: '.s_LnPv-Err',
  __intLinkProvider: { name: 'Int', inSandboxedIframe: false } as LinkPreviewProvider,

  // REMOVE use makeLinkPreviewSelector(..) instead.
  makePreviewOkSelector: (provider: LinkPreviewProvider | 'InternalLink',
          opts: { url?: St } = {}) => {
    return utils.makeLinkPreviewSelector(provider, { ...opts, broken: false });
  },

  // REMOVE use makeLinkPreviewSelector(..) instead.
  makePreviewBrokenSelector: (provider: LinkPreviewProvider | 'InternalLink',
          opts: { url?: St } = {}) => {
    return utils.makeLinkPreviewSelector(provider, { ...opts, broken: true });
  },

  makeLinkPreviewSelector: (provider: LinkPreviewProvider | 'InternalLink',
          opts: { url?: St, broken?: Bo } = {}) => {
    if (provider === 'InternalLink') provider = utils.__intLinkProvider;
    const colonNotPara = opts.broken ? '' : ':not(';
    const endPara      = opts.broken ? '' : ')';
    let sel = `.s_LnPv-${provider.lnPvClassSuffix || provider.name}${
          colonNotPara}${
            utils.__brokenPreview}${
          endPara}`;
    if (opts.url) sel += ` a[href="${opts.url}"]`;
    return sel;
  },


  ssoLogin: (ps: { member: Member, ssoId, browser,
        origin: string, server, apiSecret: string, apiRequesterId?: UserId,
        thenGoTo: string }) => {
    const extUser = utils.makeExternalUserFor(ps.member, { ssoId: ps.ssoId });
    logMessage(`SSO: Upserting @${ps.member.username}, getting a one time secret ...`);
    const oneTimeLoginSecret = ps.server.apiV0.upsertUserGetLoginSecret({
        origin: ps.origin,
        apiRequesterId: ps.apiRequesterId || c.SysbotUserId,
        apiSecret: ps.apiSecret,
        externalUser: extUser });
    logMessage(`SSO: Logging in as @${ps.member.username}, using one time secret ...`);
    ps.browser.apiV0.loginWithSecret({
        origin: ps.origin,
        oneTimeSecret: oneTimeLoginSecret,
        thenGoTo: ps.thenGoTo || '/' });
    logMessage(`SSO: Done`);
  },

  makeExternalUserFor: (member: Member, opts: {
    ssoId: string,
    primaryEmailAddress?: string,
    isEmailAddressVerified?: boolean,
    username?: string,
    fullName?: string,
    avatarUrl?: string,
    aboutUser?: string,
    isAdmin?: boolean,
    isModerator?: boolean,
  }): ExternalUser => {
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
  },

  makeEmbeddedCommentsHtml(ps: { pageName: string, discussionId?: string,
      talkyardPageId?: string, categoryRef?: string,
      localHostname?: string, color?: string, bgColor: string, htmlToPaste?: string }): string {
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

    const ieEmpty = !ps.discussionId ? ', i.e. <b>no</b> id' : '';
    let resultHtmlStr = `
<html>
<head><title>Embedded comments E2E test</title></head>
<body style="background: ${ps.bgColor || 'black'}; color: ${ps.color || '#ccc'}; font-family: monospace; font-weight: bold;">
<p>Embedded comments E2E test page "${ps.pageName}".<br>
Discussion id: "${ps.discussionId || ''}"${ieEmpty}.<br>
Talkyard page id: "${ps.talkyardPageId || ''}".<br>
Category ref: "${ps.categoryRef || ''}"${ps.categoryRef ? '' : " (none)"}.<br>
Ok to delete. The comments: (generated by the admin js bundle [2JKWTQ0])</p>
<hr>
${ htmlToPaste ? htmlToPaste : `
<script>talkyardServerUrl='${settings.scheme}://${ps.localHostname}.localhost';</script>
<script async defer src="${settings.scheme}://${ps.localHostname}.localhost/-/talkyard-comments.js"></script>
<div class="talkyard-comments" ${discIdAttr} ${catRefAttr} style="margin-top: 45px;">
`}
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
  },


  createPageInHtmlDirUnlessExists(pageSlug: St, html: St) {
    const fileSysPath = './target/' + pageSlug;
    if (fs.existsSync(fileSysPath)) {
      logMessage(`Page already exists: ${fileSysPath}`);
      return;
    }
    logMessage(`Creating html page: ${fileSysPath}`);
    fs.writeFileSync(fileSysPath, html);
  },


  checkNewPageFields: (page, ps: {
     categoryId: CategoryId,
      authorId?: UserId,
      numPostsTotal?: number,
    }) => {

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
    if (page.pageType === PageRole.PrivateChat || page.pageType === PageRole.OpenChat) {
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
  },


  checkNewPostFields: (post, ps: {
      postNr: PostNr,
      parentNr?: PostNr,
      postType: PostType,
      pageId: PageId,
      authorId?: UserId,
      approvedSource: string,
      approvedHtmlSanitized: string,
    }) => {

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
  },


  tryManyTimes: function<R>(what, maxNumTimes, fn: () => R) {
    for (let retryCount = 0; retryCount < maxNumTimes - 1; ++retryCount) {
      try {
        return fn();
      }
      catch (error) {
        logUnusual(`RETRYING: ${what}  [TyME2ERETRY], because error: ${error.toString()}`);
      }
    }
    return fn();
  },


  tryUntilTrue: function<R>(what: string, maxNumTimes: number | 'ExpBackoff', fn: () => boolean) {
    let delayMs = 300;

    for (let retryCount = 0; true; ++retryCount) {
      if (retryCount === maxNumTimes)
        throw Error(`Tried ${maxNumTimes} times but failed:  ${what}`)

      try {
        const done = fn();
        if (done)
          return;

        logUnusual(`Retrying: ${what}  [TyME2ERETRYA]`);
      }
      catch (error) {
        logUnusual(`Retrying: ${what}  [TyME2ERETRYB], because error: ${error.toString()}`);
      }

      if (maxNumTimes === 'ExpBackoff') {
        oneWdioBrowser.pause(delayMs);
        delayMs = delayMs * 1.3
        delayMs = Math.min(2500, delayMs);
      }
    }
  },
};


export = utils;