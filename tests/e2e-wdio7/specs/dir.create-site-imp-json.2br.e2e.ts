/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import * as fs from 'fs';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import * as utils from '../utils/utils';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen_brA: TyE2eTestBrowser;
let memah_brB: TyE2eTestBrowser;

let siteData: NewSiteData | U;

let apiSecret: St | U;

const topicOneTitle = 'topicOneTitle';
const topicOneBody = 'topicOneBody';

const dirPath = 'target';
const firstImportFilePath = dirPath + '/talkyard-json01-first.typatch.json';
const extraImportFilePath = dirPath + '/talkyard-json01-extra.typatch.json';
const evenMoreImportFilePath = dirPath + '/talkyard-json01-even-more.typatch.json';
const badPageIdImportFilePath = dirPath + '/talkyard-json01-badpageid.typatch.json';

const importToCatExtId = 'importToCatExtId';

const importedTopicOneTitle = 'importedTopicOneTitle';
const importedTopicOneBody = 'importedTopicOneBody';

const importedTopicTwoTitle = 'importedTopicTwoTitle';
const importedTopicTwoBody = 'importedTopicTwoBody';


describe(`dir.create-site-imp-json.2br  TyTEIMPJSON01`, async () => {

  it(`Init browsers`, async () => {
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');
    owen_brA = brA;
    memah_brB = brB;
  });

  it(`Create site`, async () => {
    // Something timed out in here, twice. [E2EBUG] In Wdio 6. Works in 7 maybe?
    siteData = utils.generateNewSiteData();
    await owen_brA.go2(utils.makeCreateSiteWithFakeIpUrl());
    await owen_brA.disableRateLimits();
    await owen_brA.createSite.fillInFieldsAndSubmit(siteData);
    // New site; disable rate limits here too.
    await owen_brA.disableRateLimits();
  });

  it('Signup as owner with a password account', async () => {
    await owen_brA.createSite.clickOwnerSignupButton();
    await owen_brA.loginDialog.createPasswordAccount(siteData, true);
    const siteId = await owen_brA.getSiteId();
    const email = await server.getLastEmailSenTo(siteId, siteData.email);
    const link = utils.findFirstLinkToUrlIn(
        siteData.origin + '/-/login-password-confirm-email', email.bodyHtmlText);
    await owen_brA.go2(link);
    await owen_brA.waitAndClick('#e2eContinue');
  });

  it('Create forum', async () => {
    await owen_brA.createSomething.createForum("Import JSON Test Forum");
  });

  it(`Owen creates a new page (so there'll be more things for the imported stuff
          to bug-collide with)`, async () => {
    await owen_brA.complex.createAndSaveTopic({ title: topicOneTitle, body: topicOneBody });
  });

  it(`Owen looks at the forum. It includes only sample topics`, async () => {});

  addSiteContentsTests({ firstImportDone: false });


  it(`Create a Talkyard JSON patch file: ${firstImportFilePath}`, async () => {
    createJsonPatchFile({ withExtraPosts: false, saveToFile: firstImportFilePath,
          catExtId: 'wrong_cat_ext_id' });
  });


  it(`The file exists: ${firstImportFilePath}`, async () => {
    assert.ok(fs.existsSync(firstImportFilePath));
  });

  it(`Owen tries to import the file, but hasn't yet enabled the API`, async () => {
    await utils.postJsonPatchToTalkyard({
          filePath: firstImportFilePath, apiSecret: '', talkyardSiteOrigin: siteData.origin,
          fail: true, expectedErrors: ['403 Forbidden', 'TyEAPI0ENB_'] });
  })


  it(`Owen enables the API  TyTENAAPI`, async () => {
    assert.not(await owen_brA.adminArea.tabs.isApiTabDisplayed());
    await owen_brA.adminArea.settings.features.goHere();
    await owen_brA.adminArea.settings.features.setEnableApi(true);
    await owen_brA.adminArea.settings.clickSaveAll();
    // Now the API tab appears, we'll click it just below.
  });
  it(`... creates an API secret: Goes to the admin area, the API tab`, async () => {
    await owen_brA.adminArea.tabs.navToApi();
  });
  it(`... generates the API secret`, async () => {
    await owen_brA.adminArea.apiTab.generateSecret();
  });
  it(`... copies the secret key`, async () => {
    apiSecret = await owen_brA.adminArea.apiTab.showAndCopyMostRecentSecret();
  });


  it(`Owen tries again, specifies no API secret`, async () => {
    await utils.postJsonPatchToTalkyard({
          filePath: firstImportFilePath, apiSecret: '', talkyardSiteOrigin: siteData.origin,
          fail: true, expectedErrors: ['403 Forbidden', 'TyEAPI0SECRET01_'] });
  });


  it(`Owen tries again, specifies the wrong API secret`, async () => {
    await utils.postJsonPatchToTalkyard({
          filePath: firstImportFilePath, apiSecret: 'wrong',
          talkyardSiteOrigin: siteData.origin,
          fail: true, expectedErrors: ['403 Forbidden', 'TyEAPI0SECRET01_'] });
  });

  it(`Owen finally uses the right secret — but the wrong category ext id`, async () => {
    await utils.postJsonPatchToTalkyard({
          filePath: firstImportFilePath, apiSecret, talkyardSiteOrigin: siteData.origin,
          fail: true, expectedErrors: [
              '400 Bad Request', 'wrong_cat_ext_id', 'TYE0CATWEXTID_'] });
  });

  it(`Owen goes to the General category`, async () => {
    await owen_brA.forumCategoryList.goHere();
    await owen_brA.forumCategoryList.openCategory('General');
  });
  it(`... opens the Edit Category dialog`, async () => {
    await owen_brA.forumButtons.clickEditCategory();
  });
  it(`... sets an ext id`, async () => {
    await owen_brA.categoryDialog.fillInFields({ extId: importToCatExtId });
    await owen_brA.categoryDialog.submit();
  });


  it(`The import still fails — wrong ext id`, async () => {
    await utils.postJsonPatchToTalkyard({
          filePath: firstImportFilePath, apiSecret, talkyardSiteOrigin: siteData.origin,
          fail: true, expectedErrors: [
              '400 Bad Request', 'wrong_cat_ext_id', 'TYE0CATWEXTID_'] });
  });


  it(`Owen edits the JSON patch, sets the cat id to '${importToCatExtId}'`, async () => {
    createJsonPatchFile({ saveToFile: firstImportFilePath, catExtId: importToCatExtId });
  });

  it(`Finally, the import works`, async () => {
    await utils.postJsonPatchToTalkyard({
          filePath: firstImportFilePath, apiSecret, talkyardSiteOrigin: siteData.origin,
               });
  });


  it(`... look for stuff`, async () => {});

  addSiteContentsTests({ firstImportDone: true, extraStuffImportDone: false });


  it(`Owen adds more posts to the import — but somehow forgets to add the guests
            who wrote them. A bug in his export software?`, async () => {
    createJsonPatchFile({ saveToFile: extraImportFilePath, catExtId: importToCatExtId,
            withExtraPosts: true, withExtraGuests: false });
  });

  it(`The import fails — missing authors? foreign key`, async () => {
    await utils.postJsonPatchToTalkyard({
          filePath: extraImportFilePath, apiSecret, talkyardSiteOrigin: siteData.origin,
          fail: true, expectedErrors: ['400 Bad Request', 'TyEIMP_PatNf1_'] });
  });

  it(`Owen includse the authors too`, async () => {
    createJsonPatchFile({ saveToFile: extraImportFilePath, catExtId: importToCatExtId,
            withExtraPosts: true, withExtraGuests: true });
  });

  it(`Now he can import the remaining posts`, async () => {
    await utils.postJsonPatchToTalkyard({
          filePath: extraImportFilePath, apiSecret, talkyardSiteOrigin: siteData.origin,
               });
  });


  it(`... look for extra stuff`, async () => { });

  addSiteContentsTests({ firstImportDone: true, extraStuffImportDone: true });


  it(`Owen imports the first patch again — without the extra stuff`, async () => {
    await utils.postJsonPatchToTalkyard({
          filePath: firstImportFilePath, apiSecret, talkyardSiteOrigin: siteData.origin,
               });
  });


  it(`... the extra stuff is still there (didn't somehow disappear
            when whasn't reimported)`, async () => {});

  addSiteContentsTests({ firstImportDone: true, extraStuffImportDone: true });


  it(`Owen adds a post with a bad page id`, async () => {
    createJsonPatchFile({ saveToFile: badPageIdImportFilePath, catExtId: importToCatExtId,
            withExtraPosts: true, withExtraGuests: true, postWithBadPageId: true });
  });
  it(`... the import fails — must be an ok page id`, async () => {
    await utils.postJsonPatchToTalkyard({
          filePath: badPageIdImportFilePath, apiSecret, talkyardSiteOrigin: siteData.origin,
          fail: true, expectedErrors: ['400 Bad Request', 'TyEIMP_PgNf1_'] });
  });



  it(`Owen generates an even bigger import file`, async () => {
    createJsonPatchFile({ saveToFile: evenMoreImportFilePath, catExtId: importToCatExtId,
            withExtraPosts: true, withEvenMoreExtraPosts: true, withExtraGuests: true });
  });
  it(`Owen imports everything plus even more extra stuff.`, async () => {
    await utils.postJsonPatchToTalkyard({
          filePath: evenMoreImportFilePath, apiSecret, talkyardSiteOrigin: siteData.origin });
  });


  it(`... Only the even more stuff got added. The ext ids avoid duplicates.`, async () => {});

  addSiteContentsTests({ firstImportDone: true, extraStuffImportDone: true,
        evenMoreDone: true });


  // ----- Done


  function addSiteContentsTests(ps: { firstImportDone: Bo, extraStuffImportDone?: Bo,
            evenMoreDone?: Bo }) {
    // Welcome topic, + 4 sample topics, + topicOneTitle = 6,
    // + importedTopicOneTitle + importedTopicTwoTitle = 8.
    let numExpected = !ps.firstImportDone ? 6 : 8;

    it(`... Owen reloads the topic list`, async () => {
      await owen_brA.go2('/');
    });

    it(`... sees ${numExpected} topics`, async () => {
      await owen_brA.forumTopicList.waitForTopics();
      await owen_brA.forumTopicList.assertNumVisible(numExpected)
    });

    if (!ps.firstImportDone)
      return;

    it(`... Owen opens the first imported topic`, async () => {
      await owen_brA.forumTopicList.navToTopic(importedTopicOneTitle);
    });

    it(`... the 1st topic's title, body and 1st reply look correct`, async () => {
      await owen_brA.topic.waitForPostAssertTextMatches(c.TitleNr, importedTopicOneTitle);
      await owen_brA.topic.waitForPostAssertTextMatches(c.BodyNr, importedTopicOneBody);
      await owen_brA.topic.waitForPostAssertTextMatches(c.FirstReplyNr, 'diving_gear');
      await owen_brA.topic.assertNumRepliesVisible(1);
    });

    it(`... Owen opens the second imported topic`, async () => {
      await owen_brA.topbar.clickHome();
      await owen_brA.forumTopicList.navToTopic(importedTopicTwoTitle);
    });

    it(`... the 2nd topic's title, body and 1st reply look correct`, async () => {
      await owen_brA.topic.waitForPostAssertTextMatches(c.TitleNr, importedTopicTwoTitle);
      await owen_brA.topic.waitForPostAssertTextMatches(c.BodyNr, importedTopicTwoBody);
      await owen_brA.topic.waitForPostAssertTextMatches(c.FirstReplyNr, 'reply_on_2nd_page');
    });

    const numRepliesPageTwo =
            !ps.extraStuffImportDone ? 1 : (
                !ps.evenMoreDone ? 4 :
                    5);  // 1 deleted, doesn't count. 1 ok and imported

    it(`... there are ${numRepliesPageTwo} replies`, async () => {
      await owen_brA.topic.assertNumRepliesVisible(numRepliesPageTwo);
    });

    if (ps.extraStuffImportDone) {
      it(`... the extra replies are ok too`, async () => {
        await owen_brA.topic.waitForPostAssertTextMatches(c.FirstReplyNr + 1, 'Extra_reply_A');
        await owen_brA.topic.waitForPostAssertTextMatches(c.FirstReplyNr + 2, 'Extra_reply_B');
        await owen_brA.topic.waitForPostAssertTextMatches(c.FirstReplyNr + 3, 'Extra_reply_C');
      });
    }

    if (ps.evenMoreDone) {
      it(`... the even more replies got imported: nr ${c.FirstReplyNr + 5}`, async () => {
        await owen_brA.topic.waitForPostAssertTextMatches(c.FirstReplyNr + 5, 'Extra_reply_E');
      });
      it(`... the deleted reply, nr ${c.FirstReplyNr + 4}, isn't shown
                but it got imported — occupies nr 4  (note: post nr 5 is visible)`, async () => {
        assert.not(await owen_brA.topic.isPostNrVisible(c.FirstReplyNr + 4));
      });
    }

  }


  function createJsonPatchFile(ps: {
        withExtraPosts?: Bo, withEvenMoreExtraPosts?: Bo,
        withExtraGuests?: Bo, postWithBadPageId?: Bo,
        saveToFile: St, catExtId: St }) {
    fs.writeFileSync(ps.saveToFile, `
  {
  "groups": [],
  "members": [],
  "guests": [{
      "id": -2000000001,
      "extId": "e2e-test-sandra.sandell@example.com|a|Sandra:ath:dsq",
      "createdAt": 1551661323000,
      "fullName": "Sandra",
      "emailAddress": "e2e-test-sandra.sandell@example.com"
    }, {
      "id": -2000000002,
      "extId": "sandysantasailer@example.com|a|Sandy:ath:dsq",
      "createdAt": 1557104523000,
      "fullName": "Sandy",
      "emailAddress": "sandysantasailer@example.com"
    }, {
      "id": -2000000003,
      "extId": "zed-the-zailor@example.com|a|Zed Sailoman:ath:dsq",
      "createdAt": 1559880306000,
      "fullName": "Zed Sailoman",
      "emailAddress": "zed-the-zailor@example.com"
    }, {
      "id": -2000000004,
      "extId": "elize-ebbebobe@example.com|a|Elize:ath:dsq",
      "createdAt": 1559981349000,
      "fullName": "Elize",
      "emailAddress": "elize-ebbebobe@example.com"
    }, {
      "id": -2000000005,
      "extId": "h_kittycity:ath:dsq",
      "createdAt": 1562617282000,
      "fullName": "Holger Kittycity",
      "emailAddress": "holger.kittycity@example.com"
    }${

    // ----- Extra guests -------------------------------

    !ps.withExtraGuests ? '' :
    `, {
      "id": -2000000006,
      "extId": "disqus_bWKGs23Rd4:ath:dsq",
      "createdAt": 1565345472000,
      "fullName": "Invo Infohen",
      "emailAddress": "invoinfohen@gmail.com"
    }, {
      "id": -2000000007,
      "extId": "spammer@example.com|a|Spridio Spradio:ath:dsq",
      "createdAt": 1565435533000,
      "fullName": "Spridio Spradio",
      "emailAddress": "spammer@example.com"
    }`

    // ----- /End extra guests --------------------------

    }],
  "pages": [{
      "dbgSrc": "ToTy",
      "id": "2000000001",
      "extId": "1111111111:thr:dsq",
      "pageType": 5,
      "version": 1,
      "createdAt": 1549882800000,
      "updatedAt": 1549882800000,
      "publishedAt": 1549882800000,
      "categoryId": 2000000001,
      "embeddingPageUrl": "https://older.wrong.blog.address.com/2019/a-blog-post-one-reply.html",
      "authorId": 1
    }, {
      "dbgSrc": "ToTy",
      "id": "2000000002",
      "extId": "5555555555:thr:dsq",
      "pageType": 5,
      "version": 1,
      "createdAt": 1546426800000,
      "updatedAt": 1546426800000,
      "publishedAt": 1546426800000,
      "categoryId": 2000000001,
      "embeddingPageUrl": "http://e2e-test--imp-dsq-3840677.localhost:8080/four-replies.html",
      "authorId": 1
    }],
  "pagePaths": [{
      "folder": "/",
      "pageId": "2000000001",
      "showId": true,
      "slug": "imported-page-one",
      "canonical": true
    }, {
      "folder": "/",
      "pageId": "2000000002",
      "showId": true,
      "slug": "imported-page-two",
      "canonical": true
    }],
  "posts": [{${''

      // ----- Page one, importedTopicOneTitle

      }
      "id": 2000000001,
      "extId": "Unique id in your system, for this page title post. Titles = post nr 0.",
      "pageId": "2000000001",
      "nr": 0,
      "postType": 1,
      "createdAt": 1549882800000,
      "createdById": 1,
      "currRevById": 1,
      "currRevStartedAt": 1549882800000,
      "currRevNr": 1,
      "approvedSource": "Imported: Page one, ${importedTopicOneTitle}",
      "approvedAt": 1549882800000,
      "approvedById": 1,
      "approvedRevNr": 1
    }, {
      "id": 2000000002,
      "extId": "Unique id in your system, for page body, a.k.a. orig post, always nr 1",
      "pageId": "2000000001",
      "nr": 1,
      "postType": 1,
      "createdAt": 1549882800000,
      "createdById": 1,
      "currRevById": 1,
      "currRevStartedAt": 1549882800000,
      "currRevNr": 1,
      "approvedSource":
          "And look_at_this_link: <a href=\\"https://example.com/link\\">${
                importedTopicOneBody}</a>.",
      "approvedAt": 1549882800000,
      "approvedById": 1,
      "approvedRevNr": 1
    }, {
      "id": 2000000003,
      "extId": "Unique id for the first reply, starts at 2000000001",
      "pageId": "2000000001",
      "nr": 2000000001,
      "postType": 1,
      "createdAt": 1551661323000,
      "createdById": -2000000001,
      "currRevById": -2000000001,
      "currRevStartedAt": 1551661323000,
      "currRevNr": 1,
      "approvedSource": "<p>Year 2040: Your cat has her own diving_gear, eats one of your goldfishes.</p>",
      "approvedAt": 1551661323000,
      "approvedById": 1,
      "approvedRevNr": 1
    }, {${''

      // ----- Page two, importedTopicTwoTitle

      }
      "id": 2000000004,
      "extId": "Another page title. These unique ext ids prevent duplicates if re-importing",
      "pageId": "2000000002",
      "nr": 0,
      "postType": 1,
      "createdAt": 1546426800000,
      "createdById": 1,
      "currRevById": 1,
      "currRevStartedAt": 1546426800000,
      "currRevNr": 1,
      "approvedSource": "Imported: Page two, ${importedTopicTwoTitle}",
      "approvedAt": 1546426800000,
      "approvedById": 1,
      "approvedRevNr": 1
    }, {
      "id": 2000000005,
      "extId": "5555555555:thr:bdy:dsq",
      "pageId": "2000000002",
      "nr": 1,
      "postType": 1,
      "createdAt": 1546426800000,
      "createdById": 1,
      "currRevById": 1,
      "currRevStartedAt": 1546426800000,
      "currRevNr": 1,
      "approvedSource": "The ${importedTopicTwoBody}, not very important, but <i>almost</i>.",
      "approvedAt": 1546426800000,
      "approvedById": 1,
      "approvedRevNr": 1
    }, {
      "id": 2000000006,
      "extId": "100002:cmt:dsq",
      "pageId": "2000000002",
      "nr": 2000000001,
      "postType": 1,
      "createdAt": 1557104523000,
      "createdById": -2000000002,
      "currRevById": -2000000002,
      "currRevStartedAt": 1557104523000,
      "currRevNr": 1,
      "approvedSource": "<p>A reply_on_2nd_page.</p>",
      "approvedAt": 1557104523000,
      "approvedById": 1,
      "approvedRevNr": 1
    }${

    // ----- Extra posts, page two ----------------------

    !ps.withExtraPosts ? '' : `, {
      "id": 2000000007,
      "extId": "100003:cmt:dsq",
      "pageId": "2000000002",
      "nr": 2000000002,
      "parentNr": 2000000001,
      "postType": 1,
      "createdAt": 1559880306000,
      "createdById": -2000000003,
      "currRevById": -2000000003,
      "currRevStartedAt": 1559880306000,
      "currRevNr": 1,
      "approvedSource": "<p>Extra_reply_A</p>",
      "approvedAt": 1559880306000,
      "approvedById": 1,
      "approvedRevNr": 1
    }, {
      "id": 2000000008,
      "extId": "100004:cmt:dsq",
      "pageId": "2000000002",
      "nr": 2000000003,
      "postType": 1,
      "createdAt": 1559981349000,
      "createdById": -2000000004,
      "currRevById": -2000000004,
      "currRevStartedAt": 1559981349000,
      "currRevNr": 1,
      "approvedSource": "<p>Extra_reply_B</p>",
      "approvedAt": 1559981349000,
      "approvedById": 1,
      "approvedRevNr": 1
    }, {
      "id": 2000000009,
      "extId": "100005:cmt:dsq",
      "pageId": "2000000002",
      "nr": 2000000004,
      "postType": 1,
      "createdAt": 1562617282000,
      "createdById": -2000000005,
      "currRevById": -2000000005,
      "currRevStartedAt": 1562617282000,
      "currRevNr": 1,
      "approvedSource": "<p>Extra_reply_C</p>",
      "approvedAt": 1562617282000,
      "approvedById": 1,
      "approvedRevNr": 1
    }`}${

    // ----- Even more extra posts ---------------------

    // Note: The first one has been deleted.

    !ps.withEvenMoreExtraPosts ? '' : `, {
      "id": 2000000010,
      "extId": "100006:cmt:dsq",
      "pageId": "2000000002",
      "nr": 2000000005,
      "postType": 1,
      "createdAt": 1565345472000,
      "createdById": -2000000006,
      "currRevById": -2000000006,
      "currRevStartedAt": 1565345472000,
      "currRevNr": 1,
      "approvedSource": "<p>Extra_reply_Deleted</p>",
      "approvedAt": 1565345472000,
      "approvedById": 1,
      "approvedRevNr": 1,
      "deletedAt": 1565345472000,
      "deletedById": 1,
      "deletedStatus": 1
    }, {
      "id": 2000000011,
      "extId": "100007:cmt:dsq",
      "pageId": "2000000002",
      "nr": 2000000006,
      "postType": 1,
      "createdAt": 1565435533000,
      "createdById": -2000000007,
      "currRevById": -2000000007,
      "currRevStartedAt": 1565435533000,
      "currRevNr": 1,
      "approvedSource": "<p>Extra_reply_E</p>",
      "approvedAt": 1565435533000,
      "approvedById": 1,
      "approvedRevNr": 1
    }`}${

    // ----- Post w bad page id ------------------------

    !ps.postWithBadPageId ? '' : `, {
      "id": 2000000444,
      "extId": "the page doesn't exist",
      "pageId": "2000004444",
      "nr": 0,
      "postType": 1,
      "createdAt": 1546426800000,
      "createdById": 1,
      "currRevById": 1,
      "currRevStartedAt": 1546426800000,
      "currRevNr": 1,
      "approvedSource": "Won't get imported. No page id 2000004444 in this JSON doc.",
      "approvedAt": 1546426800000,
      "approvedById": 1,
      "approvedRevNr": 1
    },
    {
      "id": 2000000555,
      "extId": "the page doesn't exist 2",
      "pageId": "2000004444",
      "nr": 1,
      "postType": 1,
      "createdAt": 1546426800000,
      "createdById": 1,
      "currRevById": 1,
      "currRevStartedAt": 1546426800000,
      "currRevNr": 1,
      "approvedSource": "The page doesn't exist; this post won't get imported",
      "approvedAt": 1546426800000,
      "approvedById": 1,
      "approvedRevNr": 1
    }`

    // ----- /Post w bad page id -----------------------

    }],
  "categories": [{
      "id": 2000000001,
      "extId": "${ps.catExtId}"
    }],
  "permsOnPages": []
  }`);
  }

});

