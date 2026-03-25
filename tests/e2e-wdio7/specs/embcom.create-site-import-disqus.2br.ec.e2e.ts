/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import * as fs from 'fs';
import { execSync} from 'child_process';
import server from '../utils/server';
import * as utils from '../utils/utils';
import * as make from '../utils/make';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import settings from '../utils/settings';
import { logMessage } from '../utils/log-and-die';
import c from '../test-constants';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;

let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let maria: Member;
let mariasBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

let data;
let siteId: Nr;
let talkyardSiteOrigin: St;

const mariasReplyOne = 'mariasReplyOne';
const mariasReplyTwo = 'mariasReplyTwo';
const mariasReplyThreeToImportedComment = 'mariasReplyThreeToImportedComment';
const owensReplyToMaria = 'owensReplyToMaria';
const owensReplyToSandra = 'owensReplyToSandra';


const dirPath = 'target'; //  doesn't work:   target/e2e-emb' — why not.

// Change dir from  [repo-root]/tests/e2e/  to repo root, if needed.
const toTalkyardScript =
        (settings.isInProjBaseDir ? './' : '../../') +
        'to-talkyard/dist/to-talkyard/src/to-talkyard.js';

// dupl code! [5GKWXT20]

describe(`embcom.create-site-import-disqus.2br.ec  TyT5KFG0P75`, () => {

  if (settings.prod) {
    console.log("Skipping this spec — the server needs to have upsert conf vals enabled."); // E2EBUG
    return;
  }

  it("initialize people", async () => {
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');
    owensBrowser = brA;
    mariasBrowser = brB;
    strangersBrowser = brB;
    owen = make.memberOwenOwner();
    maria = make.memberMaria();
  });


  function createPasswordTestData_sync() {
    // Dupl code [502KGAWH0]
    // Need to generate new local hostname, since we're going to create a new site.
    const testId = utils.generateTestId();
    const embeddingHostPort = `e2e-test--imp-dsq-${testId}.localhost:8080`;
    const localHostname     = `e2e-test--imp-dsq-${testId}`;
    //const localHostname = settings.localHostname ||
    //  settings.testLocalHostnamePrefix + 'create-site-' + testId;

    return {
      testId: testId,
      embeddingUrl: `http://${embeddingHostPort}/`,
      origin: `${settings.scheme}://comments-for-${localHostname}.localhost`,
      orgName: "E2E Imp Dsq Test",
      fullName: 'E2E Imp Dsq Test ' + testId,
      email: settings.testEmailAddressPrefix + testId + '@example.com',
      username: 'owen_owner',
      password: 'pub-owe020',
    }
  }

  it('Owen creates an embedded comments site as a Password user  @login @password', async () => {
    // Dupl code [502SKHFSKN53]
    data = createPasswordTestData_sync();
    await owensBrowser.go2(utils.makeCreateEmbeddedSiteWithFakeIpUrl());
    owensBrowser.disableRateLimits(); // 0await
    await owensBrowser.createSite.fillInFieldsAndSubmit(data);
    // New site; disable rate limits here too.
    owensBrowser.disableRateLimits(); // 0await

    await owensBrowser.createSite.clickOwnerSignupButton();
    await owensBrowser.loginDialog.createPasswordAccount(data, true);
    siteId = await owensBrowser.getSiteId();
    server.skipLimits_sync(siteId, { rateLimits: true });
    const email = await server.getLastEmailSenTo(siteId, data.email);
    const link = utils.findFirstLinkToUrlIn(
        data.origin + '/-/login-password-confirm-email', email.bodyHtmlText);
    await owensBrowser.go2(link);
    await owensBrowser.waitAndClick('#e2eContinue');
    talkyardSiteOrigin = await owensBrowser.origin();
  });


  // ----- Prepare: Create embedding pages and API secret

  it("Owen clicks Blog = Something Else, to show the instructions", async () => {
    await owensBrowser.waitAndClick('.e_SthElseB');
  });


  const fourRepliesPageUrlPath = 'four-replies.html';
  const oneReplyPageUrlPath = '2019/a-blog-post-one-reply.html';
  const oneReplyPageDiscussionId = 'node/2 With Spaces.';
  const oneReplyPageViaDiscussionIdPagePath = 'whatever-different-url-path.html';
  const pageCreatedLaterUrlPath = 'page-created-later.html';
  const noDisqusRepliesPageUrlPath = 'no-dsq-comments.html';

  it("He creates four embedding pages", async () => {
    // 2019 is for the oneReplyPageUrlPath.
    if (!fs.existsSync(dirPath + '/2019')) {
      fs.mkdirSync(dirPath + '/2019', { recursive: true, mode: 0o777 });
    }
    await makeEmbeddingPage(fourRepliesPageUrlPath);
    await makeEmbeddingPage(oneReplyPageUrlPath);
    await makeEmbeddingPage(pageCreatedLaterUrlPath);
    await makeEmbeddingPage(noDisqusRepliesPageUrlPath);
    await makeEmbeddingPage(oneReplyPageViaDiscussionIdPagePath, oneReplyPageDiscussionId);
  });


  async function makeEmbeddingPage(urlPath: St, discussionId?: St) {
    // Dupl code [046KWESJJLI3].
    await owensBrowser.waitForVisible('#e_EmbCmtsHtml');
    let htmlToPaste = await owensBrowser.getText('#e_EmbCmtsHtml');
    if (discussionId) {
      htmlToPaste = htmlToPaste.replace(
          ` data-discussion-id=""`, ` data-discussion-id="${discussionId}"`)
    }
    fs.writeFileSync(`${dirPath}/${urlPath}`, `
<html>
<head>
<title>Embedded comments E2E test: Importing Disqus comments</title>
</head>
<!-- #59a3fc is supposedly Diqus' standard color. -->
<body style="background: #59a3fc; color: #000; font-family: monospace; font-weight: bold">
<p>This is an embedded comments E2E test page, for testing Disqus comments import.
  Ok to delete. 6039hKSPJ3.<br>
URL path: ${urlPath}<br>
Discussion id: ${discussionId ? `"${discussionId}"` : '(none)'}<br>
The comments:</p>
<hr>
${htmlToPaste}
<hr>
<p>/End of page.</p>
</body>
</html>`);
  };

  it("Owen enables the API  TyTENAAPI", async () => {
    assert.not(await owensBrowser.adminArea.tabs.isApiTabDisplayed());
    await owensBrowser.adminArea.settings.features.goHere();
    await owensBrowser.adminArea.settings.features.setEnableApi(true);
    await owensBrowser.adminArea.settings.clickSaveAll();
    // Now the API tab appears, we'll click it just below.
  });

  it("... creates an API secret: Goes to the admin area, the API tab", async () => {
    await owensBrowser.adminArea.tabs.navToApi();
  });

  it("... generates the API secret", async () => {
    await owensBrowser.adminArea.apiTab.generateSecret();
  });

  let apiSecret: St;

  it("... copies the secret key", async () => {
    apiSecret = await owensBrowser.adminArea.apiTab.showAndCopyMostRecentSecret();
  });


  // ----- Pre-check: There are no comments

  it("Maria opens the embedding page, not logged in", async () => {
    await mariasBrowser.go2(data.embeddingUrl + oneReplyPageUrlPath);
    await mariasBrowser.switchToEmbeddedCommentsIrame();
  });

  it("... it's empty", async () => {
    await mariasBrowser.topic.waitForReplyButtonAssertNoComments();
  });

  it("... the four-replies page is empty too", async () => {
    await mariasBrowser.go2(data.embeddingUrl + fourRepliesPageUrlPath);
    await mariasBrowser.switchToEmbeddedCommentsIrame();
    await mariasBrowser.topic.waitForReplyButtonAssertNoComments();
  });

  it("Maria posts a comment, and a reply to her comment", async () => {
    await mariasBrowser.complex.replyToEmbeddingBlogPost(
            mariasReplyOne, { signUpWithPaswordAfterAs: maria, needVerifyEmail: false });
    await mariasBrowser.complex.replyToPostNr(
            c.FirstReplyNr, mariasReplyTwo, { isEmbedded: true });
  });



  // ----- Import comments

  const disqusXmlDumpFilePath  = dirPath + '/disqus-export.xml';
  const disqusXmlDumpFilePath2 = dirPath + '/disqus-export-2.xml';
  const talkyardPatchFilePath  = dirPath + '/talkyard-disqus.typatch.json';
  const talkyardPatchFilePath2 = dirPath + '/talkyard-disqus-2.typatch.json';

  const year2030AuthorEmail = 'e2e-test-sandra.sandell@example.com';
  const year2030CommentText =
    "Year 2030: Your cat asks you to wait for her to finish all the milk with dandelions";

  const oatMilkText = "With milk, did you mean Dandelion Milk, right. But not oat milk or soy milk";
  const oatMilkAuthorEmail = "e2e-test-villy-vegan@example.com";

  const commentOnPageCreatedLaterText = 'commentOnPageCreatedLaterText';


  it(`Owen exports Disqus comments to a file: ${disqusXmlDumpFilePath}`, async () => {
    createDisqusXmlDumpFile_sync({ withExtraComments: false, dst: disqusXmlDumpFilePath });
  });


  function createDisqusXmlDumpFile_sync(ps: { withExtraComments: boolean, dst: string }) {
    const embeddingOrigin = data.embeddingUrl;
    const olderWrongOrigin = 'https://older.wrong.blog.address.com/';
    fs.writeFileSync(ps.dst, `
    <?xml version="1.0" encoding="utf-8"?>
    <disqus
        xmlns="http://disqus.com"
        xmlns:dsq="http://disqus.com/disqus-internals"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://disqus.com/api/schemas/1.0/disqus.xsd http://disqus.com/api/schemas/1.0/disqus-internals.xsd">

    <category dsq:id="111">
    <forum>disqus_test_forum</forum>
    <title>General</title>
    <isDefault>true</isDefault>
    </category>

    <thread dsq:id="5555555555">
    <id>${embeddingOrigin + fourRepliesPageUrlPath}</id>
    <forum>disqus_test_forum</forum>
    <category dsq:id="111" />
    <link>${embeddingOrigin + fourRepliesPageUrlPath}</link>
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

    <thread dsq:id="1111111111">
    <id>${
      // Talkyard should map this discussion id to the page, so the comments stay the
      // same, also if they're origially from say WordPress, then Disqus, then Talkyard,
      // with possibly different origins and url paths.
      oneReplyPageDiscussionId}</id>
    <forum>disqus_test_forum</forum>
    <category dsq:id="111" />
    <link>${
      // Talkyard should match via URL paths, so although the origin here is "wrong",
      // the comments should still appear on the right page.  [TyT205AKST35]
      olderWrongOrigin + oneReplyPageUrlPath}</link>
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

    ${ !ps.withExtraComments ? '' : `
    <thread dsq:id="2222222222">
    <id>node/2222</id>
    <forum>disqus_test_forum</forum>
    <category dsq:id="111" />
    <link>${embeddingOrigin + pageCreatedLaterUrlPath}</link>
    <title>Comments posted here later</title>
    <message />
    <createdAt>2019-08-01T00:01:02Z</createdAt>
    <author>
    <email>slow-commenter@example.com</email>
    <name>Slow Commenter</name>
    <isAnonymous>false</isAnonymous>
    <username>slow_commenter</username>
    </author>
    <ipAddress>221.222.223.224</ipAddress>
    <isClosed>false</isClosed>
    <isDeleted>false</isDeleted>
    </thread>
    `}

    <!-- <posts> -->

    <post dsq:id="100001">
    <id>wp_id=528</id>
    <message><![CDATA[<p>${year2030CommentText}</p>]]></message>
    <createdAt>2019-03-04T01:02:03Z</createdAt>
    <isDeleted>false</isDeleted>
    <isSpam>false</isSpam>
    <author>
    <email>${year2030AuthorEmail}</email>
    <name>Sandra</name>
    <isAnonymous>true</isAnonymous>
    </author>
    <ipAddress>110.175.1.2</ipAddress>
    <thread dsq:id="1111111111" />
    </post>

    ${ !ps.withExtraComments ? '' : `
    <post dsq:id="2011110002">
    <id>wp_id=202</id>
    <message><![CDATA[<p>${oatMilkText}</p>]]></message>
    <createdAt>2019-08-04T01:02:03Z</createdAt>
    ${ /* Let's skip the isDeleted and isSpam fields */ ''}
    <author>
    <email>${oatMilkAuthorEmail}</email>
    <name>Villy Vegan</name>
    <isAnonymous>true</isAnonymous>
    </author>
    <ipAddress>110.112.3.4</ipAddress>
    <thread dsq:id="1111111111" />
    </post>

    <post dsq:id="2022220001">
    <id>wp_id=9249358</id>
    <message><![CDATA[<p>${commentOnPageCreatedLaterText}</p>]]></message>
    <createdAt>2019-08-02T01:02:03Z</createdAt>
    <isDeleted>false</isDeleted>
    <isSpam>false</isSpam>
    <author>
    <email>slow-commenter@example.com</email>
    <name>Slow Commenter</name>
    <isAnonymous>true</isAnonymous>
    </author>
    <ipAddress>110.134.124.59</ipAddress>
    <thread dsq:id="2222222222" />
    </post>
    `}

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
    <thread dsq:id="5555555555" />
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
    <thread dsq:id="5555555555" />
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
    <thread dsq:id="5555555555" />
    </post>

    <post dsq:id="100005">
    <id />
    <message><![CDATA[<p>Has anyone tried using the pets? The smaller, the less heavy, the higher we can reach.</p>]]></message>
    <createdAt>2019-07-08T20:21:22Z</createdAt>
    <isDeleted>false</isDeleted>
    <isSpam>false</isSpam>
    <author>
    <email>holger.kittycity@example.com</email>
    <name>Holger Kittycity</name>
    <isAnonymous>false</isAnonymous>
    <username>h_kittycity</username>
    </author>
    <ipAddress>184.11.12.13</ipAddress>
    <thread dsq:id="5555555555" />
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
    <thread dsq:id="5555555555" />
    </post>

    <post dsq:id="100007">
    <id />
    <message><![CDATA[<p>Buy vi  gr  a</p>]]></message>
    <createdAt>2019-08-10T11:12:13Z</createdAt>
    <isDeleted>false</isDeleted>
    <isSpam>true</isSpam>
    <author>
    <email>spammer@example.com</email>
    <name>Spridio Spradio</name>
    <isAnonymous>true</isAnonymous>
    </author>
    <ipAddress>111.112.113.444</ipAddress>
    <thread dsq:id="5555555555" />
    </post>

    </disqus>
    `);
  }

  it(`... removes any old Talkyard patch file`, async () => {
    if (fs.existsSync(talkyardPatchFilePath)) {
      logMessage(`Renaming: ${talkyardPatchFilePath}  to:  ...old-test`)
      fs.renameSync(talkyardPatchFilePath, talkyardPatchFilePath + '.old-test');
    }
    assert.not(fs.existsSync(talkyardPatchFilePath));
  });

  it(`... and converts to Talkyard format: ${talkyardPatchFilePath}`, async () => {
    convertDisqusFileToTalkyardFile_sync(disqusXmlDumpFilePath, talkyardPatchFilePath);
  });

  function convertDisqusFileToTalkyardFile_sync(src: string, dst: string) {
    execSync(
        `node ${toTalkyardScript} ` +
          `--disqusXmlExportFile=${src} ` +
          `--writeTo=${dst}`);
  }

  it(`... a Talkyard patch json file appears: ${talkyardPatchFilePath}`, async () => {
    assert.that(fs.existsSync(talkyardPatchFilePath));
  });

  it("... and posts to the Talkyard server", async () => {
    await utils.postJsonPatchToTalkyard({
            filePath: talkyardPatchFilePath, apiSecret, talkyardSiteOrigin });
  });


  // ----- Comments appear?

  it("Maria goes to the one-imported-reply page", async () => {
    await mariasBrowser.go2('/' + oneReplyPageUrlPath)
  });

  it("... there's no discussion id on this page", async () => {
    const source = await mariasBrowser.getPageSource();
    assert.eq(source.indexOf(oneReplyPageDiscussionId), -1);
    assert.that(source.indexOf('data-discussion-id=""') >= 0);
  });

  it("... and sees a comment, imported from Disqus " +
        "— matched by url path, althoug origins differ", async () => {
    await mariasBrowser.switchToEmbeddedCommentsIrame();
    await mariasBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
    await mariasBrowser.topic.assertNumRepliesVisible(1);
  });

  it("... with the correct text", async () => {
    await mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr, year2030CommentText);
  });

  it("Works also via discussion id, from the <id> tag: Maria goes to the page " +
      `with disc id "${oneReplyPageDiscussionId}", but the "wrong" url path`, async () => {
    await mariasBrowser.go2('/' + oneReplyPageViaDiscussionIdPagePath)
  });

  it("... the discussion id is indeed here", async () => {
    const source = await mariasBrowser.getPageSource();
    assert.that(source.indexOf(`data-discussion-id="${oneReplyPageDiscussionId}"`) >= 0);
  });

  it("... Maria sees the same comment, the one imported from Disqus", async () => {
    await mariasBrowser.switchToEmbeddedCommentsIrame();
    await mariasBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
    await mariasBrowser.topic.assertNumRepliesVisible(1);
  });

  it("... with the correct text", async () => {
    await mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr, year2030CommentText);
  });

  it("She can post a reply, to the Disqus improted comment", async () => {
    await mariasBrowser.complex.replyToPostNr(
        c.FirstReplyNr, mariasReplyThreeToImportedComment, { isEmbedded: true });
    await mariasBrowser.topic.waitForPostAssertTextMatches(
        c.FirstReplyNr + 1, mariasReplyThreeToImportedComment);
  });

  it("... the reply is there after page reload", async () => {
    await mariasBrowser.refresh2();
    await mariasBrowser.switchToEmbeddedCommentsIrame();
    await mariasBrowser.topic.waitForPostAssertTextMatches(
        c.FirstReplyNr + 1, mariasReplyThreeToImportedComment);
  });

  it("... the comment author (a guest user) gets a reply notf email", async () => {
    await server.waitUntilLastEmailMatches(
        siteId, year2030AuthorEmail, [mariasReplyThreeToImportedComment]);
  });

  it("Owen goes to the blog", async () => {
    await owensBrowser.go2(data.embeddingUrl + oneReplyPageUrlPath)
  });

  it("... needs to log in?", async () => {
    await owensBrowser.complex.loginIfNeededViaMetabar(owen);
  });

  it("Owen replies to Maria", async () => {
    await owensBrowser.complex.replyToPostNr(
        c.FirstReplyNr + 1, owensReplyToMaria, { isEmbedded: true });
  });

  it("... and to Sandra the guest", async () => {
    await owensBrowser.complex.replyToPostNr(
        c.FirstReplyNr, owensReplyToSandra, { isEmbedded: true });
  });

  it("... Sandra gets a nof email", async () => {
    await server.waitUntilLastEmailMatches(
        siteId, year2030AuthorEmail, [owensReplyToSandra]);
  });

  let verifyEmailAddrLink: string;

  it("... but Maria didn't get one yet — instead, the server waits for her to " +
      "verify her email address", async () => {
    verifyEmailAddrLink = await server.waitAndGetLastVerifyEmailAddressLinkEmailedTo(
        siteId, maria.emailAddress);
  });

  it("... she clicks the link", async () => {
    await mariasBrowser.go2(verifyEmailAddrLink);
  });

  it("... *Thereafter* she gets the nof email about Owen's reply  TyT305RKTH4", async () => {
    await server.waitUntilLastEmailMatches(
        siteId, maria.emailAddress, [owensReplyToMaria]);
  });


  it("Maria goes to the page with many replies", async () => {
    await mariasBrowser.go2(data.embeddingUrl + fourRepliesPageUrlPath)
    await mariasBrowser.switchToEmbeddedCommentsIrame();
  });

  it("... and sees her two comments, plus 4 imported", async () => {
    await checkSantaSailingPageAfterDisqusImportNr(1);
  });

  async function checkSantaSailingPageAfterDisqusImportNr(importNr: number) {
    await mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr, mariasReplyOne);
    await mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr + 1, mariasReplyTwo);
    await mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr + 2, "a Santa Sailing Ship");
    await mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr + 3, "reach the escape velocity");
    await mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr + 4, "in a way surprising");
    await mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr + 5, "tried using the pets");
  }

  it("... but only those — not the isDeleted and the isSpam comments", async () => {
    await mariasBrowser.topic.assertNumRepliesVisible(2 + 4   + 0  + 0);
  });

  it("Maria goes to a 3rd page", async () => {
    await mariasBrowser.go2('/' + noDisqusRepliesPageUrlPath)
    await mariasBrowser.switchToEmbeddedCommentsIrame();
  });

  it("... it's empty (it should be)", async () => {
    await mariasBrowser.topic.waitForReplyButtonAssertNoComments();
  });

  it("... returns to page w the previously just one reply, imported from Disqus", async () => {
    await mariasBrowser.go2('/' + oneReplyPageUrlPath)
    await mariasBrowser.switchToEmbeddedCommentsIrame();
  });

  it("... and sees 4 comments: 1 imported from Disqus, 1 is hers, and Owen's 2", async () => {
    await checkCatsAndMilkPageAfterDisqusImportNr(1);
  });

  async function checkCatsAndMilkPageAfterDisqusImportNr(importNr: Nr) {
    await mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr, year2030CommentText);
    await mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr + 1, mariasReplyThreeToImportedComment);
    await mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr + 2, owensReplyToMaria);
    await mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr + 3, owensReplyToSandra);
    let numTotal = 4;
    if (importNr === 3) {
      // Now we have re-run the import, and imported one more comment.
      await mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr + 4, oatMilkText);
      numTotal += 1;
    }
    await mariasBrowser.topic.assertNumRepliesVisible(numTotal);
  }


  // ----- Importing the same thing many times

  it("Owen re-imports the same Disqus comments, again", async () => {
    await utils.postJsonPatchToTalkyard({
            filePath: talkyardPatchFilePath, apiSecret, talkyardSiteOrigin });
  });

  it("Maria refreshes the page", async () => {
    await mariasBrowser.refresh2();
    await mariasBrowser.switchToEmbeddedCommentsIrame();
  });

  it("... nothing has changed — there are no duplicated Disqus comments", async () => {
    await checkCatsAndMilkPageAfterDisqusImportNr(2);
  });

  it("She goes to the santa sailing page", async () => {
    await mariasBrowser.go2(data.embeddingUrl + fourRepliesPageUrlPath)
    await mariasBrowser.switchToEmbeddedCommentsIrame();
  });

  it("... it also didn't change after the re-import", async () => {
    await checkSantaSailingPageAfterDisqusImportNr(2);
  });


  // ----- Importing the same thing plus **more** things

  it(`Owen generates a new Disqus export file, with even more contents`, async () => {
    createDisqusXmlDumpFile_sync({ withExtraComments: true, dst: disqusXmlDumpFilePath2 });
  });

  it(`... and converts to Talkyard format: ${talkyardPatchFilePath2}`, async () => {
    convertDisqusFileToTalkyardFile_sync(disqusXmlDumpFilePath2, talkyardPatchFilePath2);
  });

  it("Owen re-imports the Disqus comments. But! With an extra comment & a new page", async () => {
    await utils.postJsonPatchToTalkyard({
            filePath: talkyardPatchFilePath2, apiSecret, talkyardSiteOrigin });
  });

  it("Maria returns to the cat and milk page", async () => {
    await mariasBrowser.go2('/' + oneReplyPageUrlPath)
    await mariasBrowser.switchToEmbeddedCommentsIrame();
  });

  it("... and sees 5 comments: 1 + 1 new, from Disqus, her 1, and Owen's 2", async () => {
    await checkCatsAndMilkPageAfterDisqusImportNr(3);
  });

  it("But on the santa sailing page ...", async () => {
    await mariasBrowser.go2(data.embeddingUrl + fourRepliesPageUrlPath);
    await mariasBrowser.switchToEmbeddedCommentsIrame();
  });

  it("... nothing has changed", async () => {
    await checkSantaSailingPageAfterDisqusImportNr(3);
  });

  it("Maria goes to a page created later", async () => {
    await mariasBrowser.go2('/' + pageCreatedLaterUrlPath)
    await mariasBrowser.switchToEmbeddedCommentsIrame();
  });

  it("... and sees one comment, impored from Disqus, in the 3rd import run", async () => {
    await mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr, commentOnPageCreatedLaterText);
    await mariasBrowser.topic.assertNumRepliesVisible(1);
  });

  it("The empty page is still empty. And will be, til the end of time", async () => {
    //server.playTi meMillis(EndOfUniverseMillis - nowMillis() - 1);
    await mariasBrowser.go2('/' + noDisqusRepliesPageUrlPath)
    await mariasBrowser.switchToEmbeddedCommentsIrame();
    await mariasBrowser.topic.waitForReplyButtonAssertNoComments();
  });

});

