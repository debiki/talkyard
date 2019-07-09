/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import fs = require('fs');
import server = require('../utils/server');
import utils = require('../utils/utils');
import pages = require('../utils/pages');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

declare let browser: any;
declare let browserA: any;
declare let browserB: any;

let everyonesBrowsers;
let owen;
let owensBrowser;
let maria;
let mariasBrowser;
let strangersBrowser;

let data;
let idAddress: IdAddress;
let siteId: any;

const mariasCommentText = 'mariasCommentText';
const owensCommentText = 'owensCommentText';

const dirPath = 'target'; //  doesn't work:   target/e2e-emb' — why not.

// dupl code! [5GKWXT20]

describe("embedded comments, new site, import Disqus comments  TyT5KFG0P75", () => {

  it("initialize people", () => {
    everyonesBrowsers = _.assign(browser, pagesFor(browser));
    owensBrowser = _.assign(browserA, pagesFor(browserA));
    mariasBrowser = _.assign(browserB, pagesFor(browserB));
    strangersBrowser = mariasBrowser;
    owen = make.memberOwenOwner();
    maria = make.memberMaria();
  });


  function createPasswordTestData() {
    const testId = utils.generateTestId();
    const embeddingHostPort = `test--ec-${testId}.localhost:8080`;
    const localHostname     = `test--ec-${testId}-localhost-8080`;
    //const localHostname = settings.localHostname ||
    //  settings.testLocalHostnamePrefix + 'create-site-' + testId;
    return {
      testId: testId,
      embeddingUrl: `http://${embeddingHostPort}/`,
      origin: `http://comments-for-${localHostname}.localhost`,
      orgName: "E2E Org Name",
      fullName: 'E2E Test ' + testId,
      email: settings.testEmailAddressPrefix + testId + '@example.com',
      username: 'owen_owner',
      password: 'publ-ow020',
    }
  }

  it('Owen creates an embedded comments site as a Password user  @login @password', () => {
    data = createPasswordTestData();
    owensBrowser.go(utils.makeCreateEmbeddedSiteWithFakeIpUrl());
    owensBrowser.disableRateLimits();
    owensBrowser.createSite.fillInFieldsAndSubmit(data);
    // New site; disable rate limits here too.
    owensBrowser.disableRateLimits();

    owensBrowser.createSite.clickOwnerSignupButton();
    owensBrowser.loginDialog.createPasswordAccount(data, true);
    const siteId = owensBrowser.getSiteId();
    const email = server.getLastEmailSenTo(siteId, data.email, owensBrowser);
    const link = utils.findFirstLinkToUrlIn(
        data.origin + '/-/login-password-confirm-email', email.bodyHtmlText);
    owensBrowser.go(link);
    owensBrowser.waitAndClick('#e2eContinue');
  });


  it("Owen clicks Blog = Something Else, to show the instructions", () => {
    owensBrowser.waitAndClick('.e_SthElseB');
  });


  it("He creates an embedding page", () => {
    owensBrowser.waitForVisible('#e_EmbCmtsHtml');
    const htmlToPaste = owensBrowser.getText('#e_EmbCmtsHtml');
    console.log('htmlToPaste: ' + htmlToPaste);
    if (!fs.existsSync(dirPath)) {  // —>  "FAIL: Error \n unknown error line"
      fs.mkdirSync(dirPath, '0777');
    }
    fs.writeFileSync(`${dirPath}/index.html`, `
<html>
<head>
<title>Embedded comments E2E test: Importing Disqus comments</title>
</head>
<!-- #59a3fc is supposedly Diqus' standard color. -->
<body style="background: #59a3fc; color: #000; font-family: monospace; font-weight: bold">
<p>This is an embedded comments E2E test page, for testing Disqus comments import.
  Ok to delete. 6039hKSPJ3. The comments:</p>
${htmlToPaste}
<p>/End of page.</p>
</body>
</html>`);
  });


  it("Maria opens the embedding page, not logged in", () => {
    mariasBrowser.go(data.embeddingUrl);
    mariasBrowser.switchToEmbeddedCommentsIrame();
  });

  it("... it's empty", () => {
  });

  it("Owen exports Disqus comments to a file: ./target/disqus-export.xml", () => {
    const embeddingOrigin = data.embeddingUrl;
    fs.writeFileSync(`${dirPath}/disqus-export.xml`, `
    <?xml version="1.0" encoding="utf-8"?>
    <disqus xmlns="http://disqus.com" xmlns:dsq="http://disqus.com/disqus-internals" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://disqus.com/api/schemas/1.0/disqus.xsd http://disqus.com/api/schemas/1.0/disqus-internals.xsd">
    
    
    <category dsq:id="111">
    <forum>disqus_test_forum</forum>
    <title>General</title>
    <isDefault>true</isDefault>
    </category>
    
    
    <thread dsq:id="1111111111">
    <id>${embeddingOrigin}/if</id>
    <forum>disqus_test_forum</forum>
    <category dsq:id="111" />
    <link>${embeddingOrigin}/if</link>
    <title>A Simple Title</title>
    <message />
    <createdAt>2019-01-02T11:00:00Z</createdAt>
    <author>
    <email>blog.owner.name@example.com</email>
    <name>Blog Owner Name</name>
    <isAnonymous>false</isAnonymous>
    <username>blog_owner</username>
    </author>
    <ipAddress>127.0.0.1</ipAddress>
    <isClosed>false</isClosed>
    <isDeleted>false</isDeleted>
    </thread>
    
    <thread dsq:id="2222222222">
    <id>node/2</id>
    <forum>disqus_test_forum</forum>
    <category dsq:id="111" />
    <link>${embeddingOrigin}/2019/a-blog-post</link>
    <title>A Blog Post</title>
    <message />
    <createdAt>2019-02-11T11:00:00Z</createdAt>
    <author>
    <email>blog.owner.name@example.com</email>
    <name>Blog Owner Name</name>
    <isAnonymous>false</isAnonymous>
    <username>blog_owner</username>
    </author>
    <ipAddress>127.0.0.1</ipAddress>
    <isClosed>false</isClosed>
    <isDeleted>false</isDeleted>
    </thread>
    
    
    <!-- <posts> -->
    
    
    <post dsq:id="100001">
    <id>wp_id=528</id>
    <message><![CDATA[<p>Year 2022 — Your cat asks you to wait for her to finish all the milk</p>]]></message>
    <createdAt>2019-03-04T01:02:03Z</createdAt>
    <isDeleted>false</isDeleted>
    <isSpam>false</isSpam>
    <author>
    <email>sandra.sandell@example.com</email>
    <name>Sandra</name>
    <isAnonymous>true</isAnonymous>
    </author>
    <ipAddress>110.175.1.2</ipAddress>
    <thread dsq:id="2222222222" />
    </post>
    
    
    
    <post dsq:id="100002">
    <id>wp_id=101223</id>
    <message><![CDATA[<p>Sir,<br>I constructed a Santa Sailing Ship and was surprised when it took me to the middle of the local lake here, instead of into Outer Space, the Santa Section.<br>See you in the Santa Section</p>]]></message>
    <createdAt>2019-05-06T01:02:03Z</createdAt>
    <isDeleted>false</isDeleted>
    <isSpam>false</isSpam>
    <author>
    <email>sandysantasailer@example.com</email>
    <name>Sandy</name>
    <isAnonymous>true</isAnonymous>
    </author>
    <ipAddress>144.98.22.33</ipAddress>
    <thread dsq:id="1111111111" />
    </post>
    
    <post dsq:id="100003">
    <id>wp_id=101389</id>
    <message><![CDATA[<p>Sir,<br>My santa ship was likewise unable to reach the escape velocity and take me away from here into Outer Space. This is because the sum stopped increasing without limits, and instead multiplied with the divisors, to the power of seventy-seven, a bizarre phenomenon. This requires research.<br>Regards,<br>and see you in Santa Space</p>]]></message>
    <createdAt>2019-06-07T04:05:06Z</createdAt>
    <isDeleted>false</isDeleted>
    <isSpam>false</isSpam>
    <author>
    <email>zed-the-zailor@example.com</email>
    <name>Zed Sailoman</name>
    <isAnonymous>true</isAnonymous>
    </author>
    <ipAddress>108.162.33.22</ipAddress>
    <thread dsq:id="1111111111" />
    <parent dsq:id="100002" />
    </post>
    
    <post dsq:id="100004">
    <id>wp_id=101428</id>
    <message><![CDATA[<p>This is amazing, and in a way surprising, and in another way, should have been expected. Without actually having build the machine, and not having read these instructions on building the machine, how could we then expect us to reach the escape velocity, before the squared spin of Earth is faster than Pi?  I'm convinced if we only carefully study The Instructions, and you and I do the math. It will work, like a ship in the lake, faster, faster, up, up, up.</p>]]></message>
    <createdAt>2019-06-08T08:09:09Z</createdAt>
    <isDeleted>false</isDeleted>
    <isSpam>false</isSpam>
    <author>
    <email>elize-ebbebobe@example.com</email>
    <name>Elize</name>
    <isAnonymous>true</isAnonymous>
    </author>
    <ipAddress>162.156.1.23</ipAddress>
    <thread dsq:id="1111111111" />
    </post>
    
    <post dsq:id="100005">
    <id />
    <message><![CDATA[<p>Has anyone tried using the pets? The smaller, the less heavy, the higher we can reach.</p>]]></message>
    <createdAt>2019-07-08T20:21;22Z</createdAt>
    <isDeleted>false</isDeleted>
    <isSpam>false</isSpam>
    <author>
    <email>holger.kittycity@example.com</email>
    <name>Holger Kittycity</name>
    <isAnonymous>false</isAnonymous>
    <username>h_kittycity</username>
    </author>
    <ipAddress>184.11.12.13</ipAddress>
    <thread dsq:id="1111111111" />
    </post>
    
    <post dsq:id="100006">
    <id />
    <message><![CDATA[<p>Instructions not clear, might my long hair get caugth in the fan?</p>]]></message>
    <createdAt>2019-08-09T10:11:12Z</createdAt>
    <isDeleted>true</isDeleted>
    <isSpam>false</isSpam>
    <author>
    <email>invoinfohen@gmail.com</email>
    <name>Invo Infohen</name>
    <isAnonymous>false</isAnonymous>
    <username>disqus_bWKGs23Rd4</username>
    </author>
    <ipAddress>111.112.113.114</ipAddress>
    <thread dsq:id="1111111111" />
    </post>
    
    </disqus>
    `);
  });

  it("... and converts to Talkyard format: ./target/talkyard-disqus.typatch.json", () => {
  });

  it("... and posts to the Talkyard server", () => {
  });

  it("Maria refreshes the page", () => {
  });

  it("... and sees a comment", () => {
  });

  it("Maria goes to another page", () => {
  });

  it("... and sees three comments", () => {
  });

  it("Maria replies to a comment", () => {
  });

  it("... the comment author (a guest user) gets a reply notf email", () => {
  });

  it("owen replies to Maria", () => {
  });

  it("... Maria gets a nof email", () => {
  });

  it("Maria goes to a 3rd page", () => {
  });

  it("... it's empt (it should be)", () => {
  });

  it("Maria returns to the previous page, with new comments", () => {
  });

  it("... and sees 5 comments (3 old, from Disqus, and 2 new)", () => {
  });


  function isCommentsVisible(browser) {
    return browser.isVisible('.dw-p');
  }

  function isReplyButtonVisible(browser) {
    return browser.isVisible('.dw-a-reply');
  }

});

