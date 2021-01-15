/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
// import fs = require('fs');  EMBCMTS
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/pages-for';
import settings = require('../utils/settings');
import lad = require('../utils/log-and-die');
import c = require('../test-constants');


///
/// Tests that a Ty server changes a http://link-preview.ex.co url to https:
/// iff the server uses https.
///


let everyonesBrowsers: TyAllE2eTestBrowsers;
let richBrowserA: TyE2eTestBrowser;
let owen: Member;
let maria: Member;
let maria_brA: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;

const mariasTopicTitle = "HTTPS and CDN link previews test";

let owensTopicUrl: St;

const owensTopicTitle =
        'Title with http://not.title.link.com and ' +
        '<a href="http://not.title.link2.co">http://not.title.link.co</a> ' +
        'and https://https-link.ex.co';

// These link looking things in the title were handled as plain text
// — because the whole title itself is a link to the preview-linked topic.
// So didn't get changed to https:.
const expectedTopicLinkPreviewTitleHtml = (postNr: Nr): St =>
        '>Title with http://not.title.link.com and ' +
        '&lt;a href="http://not.title.link2.co"&gt;' +
        'http://not.title.link.co&lt;/a&gt; and ' +
        'https://https-link.ex.co' +
        (postNr === c.BodyNr ? '' : ` #post-${postNr}`) +
        '</a>';

const owensTopicBody = `
Body with http://real.body.link.com and
<a href="http://real.body.link2.com">http://not.body.link.co</a>
and https://https-link.ex.co
and a script? <script>alert(1)</script> gone?`;   // [e2e_xss]

// This is the post excerpt, just plain text (in a quote tag) — any
// link <a> tags gone, but the text content (inside the <a>) is here.
const expectedTopicLinkPreviewBlockquoteHtml =
        '<blockquote>Body with http://real.body.link.com and ' +
        'http://not.body.link.co and https://https-link.ex.co ' +
        'and a script? gone?</blockquote>';


const owensReplyUrl = () => `${owensTopicUrl}#post-${c.FirstReplyNr}`;

const linkMaybeInCode = '<a href="http://linkone.ex.co">ln_txt</a>';
const owensReply = `owensReply
http://not-link-1.ex.co

${linkMaybeInCode}
<code>${linkMaybeInCode}</code>
<pre><code>${linkMaybeInCode}
</code></pre>

http: http:// not links.

&lt;a href="http://teeext.ex.co"&gt;http://not.link.ex.co&lt;/a&gt;

<a href="http://real-link-2.ex.co">http://not.link.ex.co</a>
<a href="#" name="http://not.link.ex.co">http://not.ex.co</a>

<img src="http://real-link.example.com/img.jpg">
<img src="" alt="http://not-link.example.com/img.jpg">
another script: <script>alert(1)</script> banished?`;   // [e2e_xss]

const expectedReplyLinkPreviewBlockquoteHtml =
        '<blockquote>owensReply http://not-link-1.ex.co ' +
        'ln_txt ln_txt ln_txt' +
        '\n ' + // there's a newline in the <pre>
        'http: http:// not links. ' +
        '&lt;a href="http://teeext.ex.co"&gt;http://not.link.ex.co&lt;/a&gt; ' +
        'http://not.link.ex.co http://not.ex.co another script: banished?' +
        '</blockquote>';



describe(`link-previews-http-to-https.1br.test.ts  TyTE2ELNPVHTTPS`, () => {

  it(`construct site`, () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Internal Link Previews E2E Test",
      members: ['owen', 'maria']
    });

    const newPage: PageJustAdded = builder.addPage({
      id: 'owens_http_text_page',
      folder: '/',
      showId: false,
      slug: 'owens-http-text-page',
      role: c.TestPageRole.Discussion,
      title: owensTopicTitle,
      body: owensTopicBody,
      categoryId: forum.categories.categoryA.id,
      authorId: forum.members.owen.id,
    });

    builder.addPost({
      page: newPage,
      nr: c.FirstReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.owen.id,
      approvedSource: owensReply,
    });

    everyonesBrowsers = new TyE2eTestBrowser(allWdioBrowsers);
    richBrowserA = new TyE2eTestBrowser(wdioBrowserA);

    owen = forum.members.owen;

    maria = forum.members.maria;
    maria_brA = richBrowserA;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`import site`, () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
    owensTopicUrl = site.origin + '/owens-http-text-page';
  });


  it(`Maria logs in to the topic index page`, () => {
    maria_brA.go2(site.origin);
    maria_brA.complex.loginWithPasswordViaTopbar(maria);
  });


  it(`Maria starts composing a new topic`, () => {
    maria_brA.forumButtons.clickCreateTopic();
    maria_brA.editor.editTitle(mariasTopicTitle);
  });



  // ----- Test http —> https in preview


  it(`She adds a link to Owen's topic — but http not https;
          the server will change to https iff it uses https`, () => {
    const owensTopicUrlButHttp = owensTopicUrl.replace('https:', 'http:'); // (to_http)
    assert.ok(owensTopicUrlButHttp.startsWith('http:')); // ttt
    maria_brA.editor.editText(owensTopicUrlButHttp);
  });


  it(`... a link preview appears, in the new topic preview`, () => {
    const previewOkSelector = utils.makeLinkPreviewSelector('InternalLink');
    maria_brA.preview.waitForExist(previewOkSelector, { where: 'InEditor' });
  });

  let linkPreviewHtml: St;

  it(`... the http: plain text in the preview wasn't changed to https:`, () => {
    linkPreviewHtml = maria_brA.waitAndGetVisibleHtml(
          utils.makePreviewOkSelector('InternalLink'));

    assert.includes(linkPreviewHtml, expectedTopicLinkPreviewTitleHtml(c.BodyNr));
    assert.includes(linkPreviewHtml, expectedTopicLinkPreviewBlockquoteHtml);
  });


  it(`... but the link to the topic got changed to https: — iff https in use`, () => {
    // owensTopicUrl is https already, if the server runs https
    // — although we saved it as http see: (to_http).
    assert.ok(owensTopicUrl.startsWith('https:') === !!settings.secure, // ttt
          `Wrong scheme: ${owensTopicUrl}`);
    assert.includes(linkPreviewHtml, `<a href="${owensTopicUrl}"`);
  });



  // ----- Test http —> https in new topic


  it(`Maria submits the new topic`, () => {
    maria_brA.complex.saveTopic({ title: mariasTopicTitle });
  });


  it(`In the new topic, there're 1 ok internal link previews`, () => {
    const previewOkSelector = utils.makeLinkPreviewSelector('InternalLink');
    maria_brA.topic.waitForExistsInPost(c.BodyNr, previewOkSelector, { howMany: 1 });
  });


  it(`... and there's the previewed topic's title and body — with any http: inside
        unchanged, since that's plain text, not links`, () => {
    linkPreviewHtml = maria_brA.topic.getPostHtml(c.BodyNr);
    assert.includes(linkPreviewHtml, expectedTopicLinkPreviewTitleHtml(c.BodyNr));
    assert.includes(linkPreviewHtml, expectedTopicLinkPreviewBlockquoteHtml);
  });


  it(`... the actual link to the topic got changed to https (if server https)`, () => {
    assert.includes(linkPreviewHtml, `<a href="${owensTopicUrl}"`);
  });



  // ----- Test http —> https in new reply


  it(`Maria posts a http (not https) link to Owen's reply`, () => {
    const replyUrlHttp = owensReplyUrl().replace('https:', 'http:'); // (to_http)
    assert.ok(replyUrlHttp.startsWith('http:')); // ttt
    maria_brA.complex.replyToOrigPost(replyUrlHttp);
  });


  it(`In Maria's reply, there's a preview of the linked page title and Owen's reply
        — with any http: inside unchanged, since is plain text`, () => {
    const html = maria_brA.topic.getPostHtml(c.FirstReplyNr);
    assert.includes(html, expectedTopicLinkPreviewTitleHtml(c.FirstReplyNr));
    assert.includes(html, expectedReplyLinkPreviewBlockquoteHtml);

    // Is https if the server runs https.
    assert.ok(owensReplyUrl().startsWith('https:') === !!settings.secure, // ttt
          `Wrong scheme: ${owensReplyUrl()}`);
    assert.includes(html, `<a href="${owensReplyUrl()}"`);
  });


  const owensReplyHttps = (): St => owensReplyUrl().replace('http:', 'https:');

  it(`Maria posts a https link to Owen's reply`, () => {
    assert.ok(owensReplyHttps().startsWith('https:'), owensReplyHttps()); // ttt
    maria_brA.complex.replyToOrigPost(owensReplyHttps());
  });


  it(`... the resulting reply html uses https: (not changed to http:
            even if the server uses http not https)`, () => {
    const html = maria_brA.topic.getPostHtml(c.FirstReplyNr + 1);
    // (Owen's reply is FirstReplyNr — but Maria's, on this different page, is +1).
    assert.includes(html, expectedTopicLinkPreviewTitleHtml(c.FirstReplyNr));
    assert.includes(html, expectedReplyLinkPreviewBlockquoteHtml);
    assert.includes(html, `<a href="${owensReplyHttps()}"`);
  });

});
