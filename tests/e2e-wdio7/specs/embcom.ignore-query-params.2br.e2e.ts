/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import * as fs from 'fs';
import server from '../utils/server';
import * as utils from '../utils/utils';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;

const localHostname = 'comments-for-e2e-test-embdftpv';
const embeddingOrigin = 'http://e2e-test-embdftpv.localhost:8080';

const considerQueryPageUrlPath = '/page-consider-query.html';
const ignoreQueryPageUrlPath   = '/page-ignore-query.html';
const whatBlogPostQueryParam = '?whatBlogPost=blogPostId';
const otherBlogPostQueryParam = '?whatBlogPost=otherPostId';
const whateverQueryParam = '?what=ever';

let site: IdAddress;
let forum: TwoCatsTestForum;



describe(`embcom.ignore-query-params.2br  TyTEEMCIGQPRMS`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Emb Cmts Ign Query Params E2E Test",
      members: ['owen_owner', 'maria'],
    });

    builder.getSite().meta.localHostname = localHostname;
    builder.getSite().settings.allowEmbeddingFrom = embeddingOrigin;

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    maria = forum.members.maria;
    maria_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });


  it(`Create embedding pages`, () => {
    const dir = 'target';
    fs.writeFileSync(dir + considerQueryPageUrlPath, makeHtml('aaa', '#500', {
          talkyardConsiderQueryParams: ['whatBlogPost'] }));
    fs.writeFileSync(dir + ignoreQueryPageUrlPath, makeHtml('bbb', '#040'));
    function makeHtml(pageName: St, bgColor: St, ps?: {
            talkyardConsiderQueryParams?: St[]}): St {
      return utils.makeEmbeddedCommentsHtml({ ...ps,
              pageName, discussionId: '', localHostname, bgColor});
    }
  });


  // ----- Post comments

  it(`Owen goes to emb page a, no query param`, async () => {
    await owen_brA.go2(embeddingOrigin + considerQueryPageUrlPath);
  });
  it(`... logs in`, async () => {
    await owen_brA.complex.loginIfNeededViaMetabar(owen);
  });

  it(`Maria goes there too, but with a query param: ${whatBlogPostQueryParam}`, async () => {
    await maria_brB.go2(embeddingOrigin + considerQueryPageUrlPath + whatBlogPostQueryParam);
  });
  it(`... logs in`, async () => {
    await maria_brB.complex.loginIfNeededViaMetabar(maria);
  });

  it(`They post one comment each`, async () => {
    await owen_brA.complex.replyToEmbeddingBlogPost('Owen-consider_query_1');
    await maria_brB.complex.replyToEmbeddingBlogPost('Maria-consider_query_1');
  });


  it(`Next, they go to the ignore-query-string page`, async () => {
    await owen_brA.go2(ignoreQueryPageUrlPath);
  });

  it(`... Maria with the same query string in the URL: ${whatBlogPostQueryParam}`, async () => {
    await maria_brB.go2(ignoreQueryPageUrlPath + whatBlogPostQueryParam);
  });

  it(`Here too, they post one comment each`, async () => {
    await owen_brA.complex.replyToEmbeddingBlogPost('Owen-ignore_query');
    await maria_brB.complex.replyToEmbeddingBlogPost('Maria-ignore_query');
  });


  // ----- Look at comments, query param matters

  it(`Back on the consider-query-string page ...`, async () => {
    await owen_brA.go2(considerQueryPageUrlPath);
    await maria_brB.go2(considerQueryPageUrlPath + whatBlogPostQueryParam);
  });

  it(`... Owen doesn't see Maria's comment; he sees his own only`, async () => {
    await owen_brA.topic.waitForNumReplies({ numNormal: 1 });
    await owen_brA.topic.waitForPostAssertTextMatches(c.FirstReplyNr, 'Owen-consider_query_1');
  });

  it(`... and Maria also sees her own, only  —  Owen's and Maria's URLs are
            two different blog posts, show different comments`, async () => {
    await maria_brB.topic.waitForNumReplies({ numNormal: 1 });
    await maria_brB.topic.waitForPostAssertTextMatches(c.FirstReplyNr, 'Maria-consider_query_1');
  });


  // ----- The wrong query param

  it(`If Maria sets the query parm name to else ...`, async () => {
    await maria_brB.go2(considerQueryPageUrlPath + whateverQueryParam)
  });
  it(`... Owen's comment appears, because unknown query params are ignored,
            and Owen posted his comment on a page w/o any query param`, async () => {
    await maria_brB.topic.waitForNumReplies({ numNormal: 1 });
    await maria_brB.topic.waitForPostAssertTextMatches(c.FirstReplyNr, 'Owen-consider_query_1');
  });


  // ----- Another blog post, via other query param

  it(`But if setting the query string to another blog post id ...`, async () => {
    await maria_brB.go2(considerQueryPageUrlPath + otherBlogPostQueryParam)
  });
  it(`... then no comments are there`, async () => {
    await maria_brB.topic.waitForNumReplies({ numNormal: 0 });
  });


  // ----- Another comment, the other blog post

  it(`Maria posts a comment on this same-path but different-query-param blog post`, async () => {
    await maria_brB.complex.replyToEmbeddingBlogPost('Maria-consider_query_2');
  });

  it(`URL paths ${considerQueryPageUrlPath + whatBlogPostQueryParam
          } and ${considerQueryPageUrlPath + otherBlogPostQueryParam}
          show different comments  (are for different blog posts)`, async () => {
    await maria_brB.go2(considerQueryPageUrlPath + whatBlogPostQueryParam);
    await maria_brB.topic.waitForNumReplies({ numNormal: 1 });
    await maria_brB.topic.waitForPostAssertTextMatches(c.FirstReplyNr, 'Maria-consider_query_1');
  });
  it(`... different`, async () => {
    await maria_brB.go2(considerQueryPageUrlPath + otherBlogPostQueryParam);
    await maria_brB.topic.waitForNumReplies({ numNormal: 1 });
    await maria_brB.topic.waitForPostAssertTextMatches(c.FirstReplyNr, 'Maria-consider_query_2');
  });


  // ----- Look at comments, query string ignored

  it(`But on the ignore-query-string page ...`, async () => {
    await owen_brA.go2(ignoreQueryPageUrlPath);
    await maria_brB.go2(ignoreQueryPageUrlPath + whatBlogPostQueryParam);
  });

  it(`... Owen does see Maria's comment`, async () => {
    await owen_brA.topic.waitForNumReplies({ numNormal: 2 });
    await owen_brA.topic.waitForPostAssertTextMatches(c.FirstReplyNr, 'Owen-ignore_query');
    await owen_brA.topic.waitForPostAssertTextMatches(c.SecondReplyNr, 'Maria-ignore_query');
  });

  it(`... and Maria sees Owen's comment`, async () => {
    await maria_brB.topic.waitForNumReplies({ numNormal: 2 });
    await maria_brB.topic.waitForPostAssertTextMatches(c.FirstReplyNr, 'Owen-ignore_query');
    await maria_brB.topic.waitForPostAssertTextMatches(c.SecondReplyNr, 'Maria-ignore_query');
  });

  it(`The query string can be set to whatever`, async () => {
    await maria_brB.go2(ignoreQueryPageUrlPath + whateverQueryParam)
  });

  it(`... since it's ignored, all comments still appear`, async () => {
    await maria_brB.topic.waitForNumReplies({ numNormal: 2 });
    await maria_brB.topic.waitForPostAssertTextMatches(c.FirstReplyNr, 'Owen-ignore_query');
    await maria_brB.topic.waitForPostAssertTextMatches(c.SecondReplyNr, 'Maria-ignore_query');
  });

});
