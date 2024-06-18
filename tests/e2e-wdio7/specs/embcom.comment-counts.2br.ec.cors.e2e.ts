/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
import fs = require('fs');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/pages-for';
import settings = require('../utils/settings');
import lad = require('../utils/log-and-die');
import c = require('../test-constants');


let everyonesBrowsers: TyAllE2eTestBrowsers;
let richBrowserA: TyE2eTestBrowser;
let richBrowserB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;

let site: IdAddress;

const localHostname = 'comments-for-e2e-test-comcount';
const embeddingOrigin = 'http://e2e-test-comcount.localhost:8080';
let forum: TwoPagesTestForum;

const indexPageSlug = 'blog-post-list-with-num-comments.html';


const pubPageTitle = 'pubPageTitle';
const pubPageText = 'pubPageText';
const pubPageId = 'pubPageId';
const pubPagePathAtBlog = '/embeds-pub-page.html';

const staffPageTitle = 'staffPageTitle';
const staffPageText = 'staffPageText';
const staffPageId = 'staffPageId';
const staffPagePathAtBlog = '/embeds-staff-page.html';



describe(`embcom.comment-counts.2br.cors  TyTE2ECOMCOUNTS`, () => {

  it(`construct site`, () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Emb Comments Show Num Comments",
      members: undefined,
    });

    builder.getSite().meta.localHostname = localHostname;
    builder.getSite().settings.allowEmbeddingFrom = embeddingOrigin;

    const embComsPageCatA: PageJustAdded = builder.addPage({
      id: pubPageId,
      folder: '/',
      showId: false,
      slug: 'emb-coms-page-cat-a',
      role: c.TestPageRole.EmbeddedComments,
      title: pubPageTitle,
      body: pubPageText,
      categoryId: forum.categories.categoryA.id,
      authorId: forum.members.owen.id,
    });

    forum.siteData.pageIdsByAltIds = {};
    forum.siteData.pageIdsByAltIds[pubPagePathAtBlog] = pubPageId;

    builder.addPost({
      page: embComsPageCatA,
      nr: c.FirstReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.owen.id,
      approvedSource: pubPageId + " reply 1/1",
    });

    const embComsPageStaffCat: PageJustAdded = builder.addPage({
      ...embComsPageCatA,
      id: staffPageId,
      slug: 'emb-coms-page-staff-cat',
      role: c.TestPageRole.EmbeddedComments,
      title: staffPageTitle,
      body: staffPageText,
      categoryId: forum.categories.staffOnlyCategory.id,
      authorId: forum.members.owen.id,
    });

    builder.addPost({
      page: embComsPageStaffCat,
      nr: c.FirstReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.owen.id,
      approvedSource: staffPageId + " reply 1/1",
    });

    forum.siteData.pageIdsByAltIds[staffPagePathAtBlog] = staffPageId;


    everyonesBrowsers = new TyE2eTestBrowser(allWdioBrowsers);
    richBrowserA = new TyE2eTestBrowser(wdioBrowserA);
    richBrowserB = new TyE2eTestBrowser(wdioBrowserB);

    owen = forum.members.owen;
    owen_brA = richBrowserA;
    maria = forum.members.maria;
    maria_brB = richBrowserB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`import site`, () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });


  it(`Owen logs in to the Admin Area`, () => {
    owen_brA.adminArea.settings.features.goHere(site.origin);
    owen_brA.loginDialog.loginWithPassword(owen);
  });


  it(`Owen creates embedding pages`, () => {
    const dir = 'target';
    fs.writeFileSync(`${dir}/page-zero-comments.html`, makeHtml('zerocoms', '#404'));
    fs.writeFileSync(`${dir}/page-one-like.html`, makeHtml('onelike', '#444'));
    fs.writeFileSync(`${dir}/page-one-comment.html`, makeHtml('onecom', '#044'));
    fs.writeFileSync(`${dir}/page-two-comments.html`, makeHtml('twocoms', '#440'));
    fs.writeFileSync(`${dir}${pubPagePathAtBlog}`, makeHtml('pubpg', '#252', pubPageId));
    fs.writeFileSync(`${dir}${staffPagePathAtBlog}`, makeHtml('staffpg', '#500', staffPageId));
    function makeHtml(pageName: St, bgColor: St, talkyardPageId?: St): St {
      return utils.makeEmbeddedCommentsHtml({
            pageName, discussionId: '', talkyardPageId, localHostname, bgColor });
    }
  });


  const numBlogPostLinks = 7;       // A ... G = 7
  const numBlogPostLinksValid = 4;  // B ... E = 4

  it(`... and a blog post index page`, () => {
    const dir = 'target';
    fs.writeFileSync(`${dir}/${indexPageSlug}`, makeHtml());
    function makeHtml(): St {
      return utils.makeBlogPostIndexPageHtml({ localHostname,
        urlA: embeddingOrigin + '/page-zero-comments.html', // not found, not created
        urlB: embeddingOrigin + '/page-one-like.html',      // found, but 0 comments
        urlC: embeddingOrigin + '/page-one-comment.html',   // found, 1 comment
        urlD: '/page-two-comments.html',   // only URL path, origin excluded
        urlE: pubPagePathAtBlog,           // everyone can see num comments
        urlF: staffPagePathAtBlog,         // only staff can see num comments
        urlG: 'https://not-blog-post.example.com',          // not found, wrong origin
        urlH: 'NoHref',     // will be ignored, won't incr numBlogPostLinks
        urlI: 'NoLinkTag',  // –""–
      });
    }
  });


  it(`Maria opens embedding page one-like`, () => {
    maria_brB.go2(embeddingOrigin + '/page-one-like.html');
  });
  it(`... logs in`, () => {
    maria_brB.complex.loginIfNeededViaMetabar(maria);
  });
  it(`... clicks Like`, () => {
    maria_brB.topic.clickLikeVoteForBlogPost();
  });


  it(`Maria goes to embedding page one-comment`, () => {
    maria_brB.go2('/page-one-comment.html');
  });
  it(`... posts a comment`, () => {
    maria_brB.complex.replyToEmbeddingBlogPost("Maria's only comment here");
  });


  it(`Maria goes to two-comments`, () => {
    maria_brB.go2('/page-two-comments.html');
  });
  it(`... posts two comments`, () => {
    maria_brB.complex.replyToEmbeddingBlogPost("Maria's comment 1/2")
    maria_brB.complex.replyToEmbeddingBlogPost("Maria's comment 2/2")
  });



  it(`Maria goes to the blog post index page`, () => {
    maria_brB.go2('/' + indexPageSlug, { willBeWhere: IsWhere.EmbeddedPagesListPage });
  });
  it(`... The comments count CORS fetch request finishes`, () => {
    maria_brB.waitForExist('.ty_NumCmts-Err, .ty_NumCmts-Ok');
  });
  it(`... but all comments counts failed — CORS not yet allowed`, () => {
    maria_brB.waitForExactly(numBlogPostLinks, '.ty_NumCmts-Err-TyEFET0RSP');
  });
  it(`... no ok count appears`, () => {
    const numOk = maria_brB.count('.ty_NumCmts-Ok, .ty_NumCmts-PgNF');
    assert.eq(numOk, 0);
  });



  it(`Owen goes to admin area`, () => {
    owen_brA.adminArea.settings.features.goHere(site.origin);
  });
  it(`... enables AIP`, () => {
    owen_brA.adminArea.settings.features.setEnableApi(true);
  });
  it(`... and CORS`, () => {
    owen_brA.adminArea.settings.features.setEnableCors(true);
  });
  it(`... for the blog`, () => {
    owen_brA.adminArea.settings.features.setCorsOrigins(embeddingOrigin);
  });
  it(`... saves`, () => {
    owen_brA.adminArea.settings.clickSaveAll();
  });


  it(`Maria refreshes`, () => {
    maria_brB.refresh2({ isWhere: IsWhere.EmbeddedPagesListPage });
  });
  it(`... the Talkyard script loads comment counts`, () => {
    maria_brB.waitForExist('.ty_NumCmts-Err, .ty_NumCmts-Ok');
  });
  it(`... now it worked`, () => {
    maria_brB.waitForExactly(numBlogPostLinksValid, '.ty_NumCmts-Ok');
  });
  it(`... just some intentionally incorrect links failed`, () => {
    const numNotFound = maria_brB.count('.ty_NumCmts-PgNF');
    assert.eq(numNotFound, numBlogPostLinks - numBlogPostLinksValid);
  });



  it(`Owen goes to the staff only emb comments page`, () => {
    owen_brA.go2('/emb-coms-page-staff-cat');
  });
  it(`... moves it to Cat A — it'll be pulic  TyTMVPG2CAT`, () => {
    owen_brA.go2('/emb-coms-page-staff-cat');
    owen_brA.topic.movePageToOtherCategory(forum.categories.categoryA.name);
  });


  it(`Maria refreshes`, () => {
    maria_brB.refresh2({ isWhere: IsWhere.EmbeddedPagesListPage });
  });
  it(`... the Talkyard script loads comment counts`, () => {
    maria_brB.waitForExist('.ty_NumCmts-Err, .ty_NumCmts-Ok');
  });
  it(`... now she sees comments for the previously staff-only discussion too`, () => {
    maria_brB.waitForExactly(numBlogPostLinksValid + 1, '.ty_NumCmts-Ok');
  });
  it(`... and one less link failed`, () => {
    const numNotFound = maria_brB.count('.ty_NumCmts-PgNF');
    assert.eq(numNotFound, numBlogPostLinks - numBlogPostLinksValid - 1);
  });



  it(`But Owen messes up the allowed CORS origin`, () => {
    owen_brA.adminArea.settings.features.goHere();
    owen_brA.adminArea.settings.features.setCorsOrigins('https://wrong.example.com');
    owen_brA.adminArea.settings.clickSaveAll();
  });


  it(`Maria refreshes`, () => {
    maria_brB.refresh2({ isWhere: IsWhere.EmbeddedPagesListPage });
  });
  it(`... the Talkyard script loads comment counts`, () => {
    maria_brB.waitForExist('.ty_NumCmts-Err, .ty_NumCmts-Ok');
  });
  it(`... now all are broken again: the fetch failed`, () => {
    maria_brB.waitForExactly(numBlogPostLinks, '.ty_NumCmts-Err-TyEFET0RSP');
  });
  it(`... zero ok counts`, () => {
    const numOk = maria_brB.count('.ty_NumCmts-Ok, .ty_NumCmts-PgNF');
    assert.eq(numOk, 0);
  });
});
