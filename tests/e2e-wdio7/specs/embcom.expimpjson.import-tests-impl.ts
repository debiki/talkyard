/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import * as fs from 'fs';
import { execSync } from 'child_process';
import server from '../utils/server';
import * as utils from '../utils/utils';
import * as make from '../utils/make';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import settings from '../utils/settings';
import * as lad from '../utils/log-and-die';
import c from '../test-constants';
import * as embPages from './embcom.expimpjson.test-data';

let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let maria: Member;
let mariasBrowser: TyE2eTestBrowser;
let michael: Member;
let michaelsBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

let siteId: any;

const owensReplyGensNotfToMaria = 'owensReplyGensNotfToMaria';
const owensReplyTwoMentionsMichaelMaria = 'owensReplyTwoMentionsMichaelMaria @michael @maria';


function constructEmbCommentsImportTest(testName: string, variants: {
  // One and only one of these:
  importToNewSite?: true,
  importToExistingEmptyEmbCommentsSiteViaApi?: true,
  importToExistingEmptyEmbCommentsSiteViaAdminButton?: true,
  importToExistingEmptyForumSiteViaApi?: true,
  importToExistingEmptyForumSiteViaAdminButton?: true,
  restoreOverwriteSiteViaAdminButtonToSameDomain?: true,
  restoreOverwriteSiteViaAdminButtonToNewDomain?: true,
}) {
  describe(testName, async () => {

    if (settings.prod) {
      console.log("Skipping this spec — the server needs to have upsert conf vals enabled."); // E2EBUG
      return;
    }

    it(`initialize people`, async () => {
      owensBrowser = new TyE2eTestBrowser(wdioBrowserA, 'brA');
      mariasBrowser = new TyE2eTestBrowser(wdioBrowserB, 'brB');
      strangersBrowser = mariasBrowser;
      owen = make.memberOwenOwner();
      maria = make.memberMaria();
      michael = make.memberMichael();
      michaelsBrowser = mariasBrowser;
    });


    let jsonDumpStr;
    let siteDump: SiteData2;

    it(`There's a Talkyard site json dump file:  ` + c.EmbCommentsJsonExport, async () => {
      try {
        jsonDumpStr = fs.readFileSync(c.EmbCommentsJsonExport).toString();
        siteDump = JSON.parse(jsonDumpStr);
      }
      catch (ex) {
        lad.die(`\nCouldn't read and parse file:  ${c.EmbCommentsJsonExport}\n\n` +
        `You need to create that file, by first running this other e2e test:\n\n` +
        `    s/wdio target/e2e/wdio.2chrome.conf.js  --only embedded-comments-create-site-export-json.2browsers` +
        `\n\n`);
      }
    });

    let embeddingOrigin: string;

    it(`... with an allowEmbeddingFrom setting`, async () => {
      embeddingOrigin = siteDump.settings.allowEmbeddingFrom;
      lad.logMessage(`\nThe embedding origin is:   ${embeddingOrigin}\n`);
      assert.that(!!embeddingOrigin && embeddingOrigin.length);
    });

    // ----- Import and login as Owen


    if (variants.importToNewSite) {
      let newSiteIdAddr: IdAddress;

      it(`Imports the site`, async () => {
        // Avoid unique key errors.
        const testId = utils.generateTestId();
        siteDump.meta.pubId = siteDump.meta.pubId + '_copy_' + testId;
        siteDump.meta.name = siteDump.meta.name + '-copy-' + testId;
        newSiteIdAddr = await server.importRealSiteData(siteDump);
        siteId = newSiteIdAddr.id;
        console.log("Import site response: " + JSON.stringify(newSiteIdAddr));
      });

      it(`Owen goes to the re-imported site`, async () => {
        await owensBrowser.go2(newSiteIdAddr.origin || newSiteIdAddr.siteIdOrigin);
      });

      it(`... logs in`, async () => {
        await owensBrowser.complex.loginWithPasswordViaTopbar(owen);
      });
    }
    else if (variants.importToExistingEmptyEmbCommentsSiteViaApi) {
      lad.die("unimplemented [TyE206MKTT1]");
      /*
      // ----- Imports the site, as a patch, to an already existing embedded comments site

      // Doesn't currently work: No ext imp id.

      it(`Owen creates a 2nd embedded comments site`, async () => {
        const result = await owensBrowser.createSiteAsOwen({ shortName: String, longName });
        data = result.data;
        siteId = result.siteId;
        talkyardSiteOrigin = result.talkyardSiteOrigin;
      });

      // ------ Dupl code [5029gKTHF35]
      it(`Owen creates an API secret: Goes to the admin area, the API tab`, async () => {
        await owensBrowser.adminArea.goToApi();
      });

      it(`... generates the API secret`, async () => {
        await owensBrowser.adminArea.apiTab.generateSecret();
      });

      let apiSecret: string;

      it(`... copies the secret key`, async () => {
        apiSecret = await owensBrowser.adminArea.apiTab.showAndCopyMostRecentSecret();
      });

      function postCommentsToTalkyard(filePath: string) {
        const cmd =
            'node to-talkyard/dist/to-talkyard/src/to-talkyard.js ' +
              `--talkyardJsonPatchFile=${filePath} ` +
              `--sysbotApiSecret=${apiSecret} ` +
              `--sendTo=${talkyardSiteOrigin}`
        lad.logMessage(`Executing this:\n  ${cmd}`)
        execSync(cmd);
      }
      // ------ /Dupl code [5029gKTHF35]


      it(`... and posts to the Talkyard server`, async () => {
        postCommentsToTalkyard(c.EmbCommentsJsonExport);
      }); */
    }
    else if (variants.importToExistingEmptyEmbCommentsSiteViaAdminButton) {
      lad.die("unimplemented [TyE206MKTT2]");
    }
    else if (
        variants.restoreOverwriteSiteViaAdminButtonToSameDomain ||
        variants.restoreOverwriteSiteViaAdminButtonToNewDomain) {
      // [Import] btn somewhere in adm interface, but where??
      // ----- Imports the site, as a patch, to an already existing embedded comments site

      // Doesn't currently work: No ext imp id.

      let site;
      let testId;

      it(`Owen creates a 2nd embedded comments site`, async () => {
        const newSiteData = owensBrowser.makeNewSiteDataForEmbeddedComments({
            shortName: 'emb-rst', longName: "Emb Restore Site" });
        const result: NewSiteResult = await owensBrowser.newSite.createNewSite(newSiteData);
        await owensBrowser.newSite.signUpAsOwner(result);
        siteId = result.siteId;
        testId = result.testId;
      });

      it(`Owen goes to the Backups admin area tab`, async () => {
        await owensBrowser.adminArea.goToBackupsTab();
      });

      it(`... opens a site dump file in an 'editor'`, async () => {
        site = siteDump;
      });

      it(`... edits site dump hostname, name, pubId — to avoid unique key errors`, async () => {
        const hostnameInDump =
            variants.restoreOverwriteSiteViaAdminButtonToNewDomain
              // Pretend we're restoring a site, e.g. a comments-for-ones-blog.talkyard.net,
              // but we restore it to a different domain. So, set the hostname in
              // the dump to something else than the current server's hostname.
              // Also, use a unique name, since won't be deleted here: [DELTSTHOSTS]
              // as of now. (restoreBackupOverwriteSite() is not a test endpoint).
              ? `old-hostname-we-migr-away-from-${utils.generateTestId()}.example.com`
              // Pretend we're restoring a site, and didn't change the url,
              // so use the same hostname:
              : await owensBrowser.host();
        lad.logMessage(`Setting hostname in dump to:  ${hostnameInDump}`);
        site.meta.hostnames[0].hostname = hostnameInDump;
        // Could let these ones be the same too, but oh well, simpler to just append this:
        // (Need the unique testId too, in case re-runs this test, maybe a retry, if flaky.)
        // (This can be an a bit long name, like, 65 chars. [502KHSRG52])
        site.meta.name = site.meta.name + '-e2ecopy-' + testId;
        site.meta.pubId = site.meta.pubId + '_e2ecopy_' + testId;
        fs.writeFileSync(c.EmbCommentsJsonExportCopy, JSON.stringify(site));
      });

      /* it(`We delete the old site's hostname, to avoid unique key error`, async () => {
        await server.deleteHosts([ ])
      }); */

      it(`Owen restores the edited site backup`, async () => {
        await owensBrowser.adminArea.backupsTab.clickRestore();
        await owensBrowser.adminArea.backupsTab.selectFileToRestore(
            c.EmbCommentsJsonExportCopyFileName);
      });

      it(`There's a Done Restoing Backup message`, async () => {
        await owensBrowser.waitForExist('.e_RstrDne');
      });

      it(`Owen reloads the page, as per the instructions ...`, async () => {
        await owensBrowser.refresh();
      });

      it(`... needs to log in again — sessions_t curently not exported`, async () => {
        // This won't work with the old silly sids. But with the new fancy sids. [btr_sid]
        await owensBrowser.loginDialog.loginWithPassword(owen);
      });

      it(`... he's Owen again`, async () => {
        await owensBrowser.topbar.assertMyUsernameMatches(owen.username);
      });
    }
    else if (variants.importToExistingEmptyForumSiteViaApi) {
      lad.die("unimplemented [TyE206MKTT3]");
    }
    else if (variants.importToExistingEmptyForumSiteViaAdminButton) {
      lad.die("unimplemented [TyE206MKTT4]");
    }
    else {
      lad.die('TyE04GKAXCT5');
    }


    let numEmailsToMaria = 0;

    it(`No emails have been sent, this far — or maybe just one old notf, to Maria`, async () => {
      // I think sometimes the json dump includes a notf for which no email has yet
      // been sent — then, that email will get sent, after the dump has gotten imported,
      // and Maria's num-emails-gotten counter starts at 1.
      numEmailsToMaria = await server.countLastEmailsSentTo(siteId, maria.emailAddress);
      assert.that(numEmailsToMaria === 0 || numEmailsToMaria === 1);
      assert.eq(await server.countLastEmailsSentTo(siteId, michael.emailAddress), 0);
      assert.eq(await server.countLastEmailsSentTo(siteId, owen.emailAddress), 0);
    });


    it(`Owen goes to the emb comments settings page`, async () => {
      await owensBrowser.adminArea.settings.embedded.goHere();
      await owensBrowser.waitAndClick('.e_SthElseB');
    });


    it(`... updates the embedding pages with urls to the new Talkyard site`, async () => {
      await embPages.createEmbeddingPages(owensBrowser);
    });


    it(`Owen goes to the Review page`, async () => {
      await owensBrowser.adminArea.review.goHere();
    });


    it(`... sees Michael's post, which he previously flagged, before the export`, async () => {
      await owensBrowser.adminArea.review.waitForTextToReview(
          embPages.texts.michaelsReply, { index: 1 });
    });


    it(`... and Maria's post, because it's by a new member`, async () => {
      await owensBrowser.adminArea.review.waitForTextToReview(
          embPages.texts.mariasReplyOne, { index: 2 });
    });


    it(`... and Michael's, again, why not merged with the other revw task? (0592DW660)`, async () => {
      await owensBrowser.adminArea.review.waitForTextToReview(
          embPages.texts.michaelsReply, { index: 3 });
    });


    it(`... and Garbo Guest's reply`, async () => {
      await owensBrowser.adminArea.review.waitForTextToReview(
          embPages.texts.guestsReply, { index: 4 });
    });


    it(`... nothing more  (but why 4 not 3?  (0592DW660))`, async () => {
      assert.eq(await owensBrowser.adminArea.review.countThingsToReview(), 4);
    });


    it(`Maria goes to ${embPages.slugs.guestReplyPageSlug}`, async () => {
      await mariasBrowser.go2(embeddingOrigin + embPages.slugs.guestReplyPageSlug);
    });


    it(`... sees the guest's reply`, async () => {
      await mariasBrowser.switchToEmbeddedCommentsIrame();
      await mariasBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
      await mariasBrowser.topic.assertNumRepliesVisible(1);
    });


    it(`... with the correct text`, async () => {
      await mariasBrowser.topic.waitForPostAssertTextMatches(
          c.FirstReplyNr, embPages.texts.guestsReply);
    });


    it(`Maria goes to ${embPages.slugs.threeRepliesPageSlug}`, async () => {
      await mariasBrowser.go2(embeddingOrigin + embPages.slugs.threeRepliesPageSlug);
    });


    it(`... sees the three replies`, async () => {
      await mariasBrowser.switchToEmbeddedCommentsIrame();
      await mariasBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
      await mariasBrowser.topic.assertNumRepliesVisible(3);
    });


    it(`... with the correct text`, async () => {
      await mariasBrowser.topic.waitForPostAssertTextMatches(
          c.FirstReplyNr + 0, embPages.texts.michaelsReply);
      await mariasBrowser.topic.waitForPostAssertTextMatches(
          c.FirstReplyNr + 1, embPages.texts.mariasReplyOne);
      await mariasBrowser.topic.waitForPostAssertTextMatches(
          c.FirstReplyNr + 2, embPages.texts.owensReplyMentionsMariaMichael);
    });


    it(`Maria goes to ${embPages.slugs.replyWithImagePageSlug}`, async () => {
      await mariasBrowser.go2(embeddingOrigin + embPages.slugs.replyWithImagePageSlug);
    });


    it(`... sees the reply with the image`, async () => {
      await mariasBrowser.switchToEmbeddedCommentsIrame();
      await mariasBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
      await mariasBrowser.topic.assertNumRepliesVisible(1);
    });


    it(`... with the correct text`, async () => {
        await mariasBrowser.topic.waitForPostAssertTextMatches(
            c.FirstReplyNr, embPages.texts.mariasReplyTwoWithImage);
    });


    it(`Maria goes to ${embPages.slugs.onlyLikeVotePageSlug}`, async () => {
      await mariasBrowser.go2(embeddingOrigin + embPages.slugs.onlyLikeVotePageSlug);
    });


    it(`... sees a Like vote`, async () => {
      await mariasBrowser.switchToEmbeddedCommentsIrame();
      await mariasBrowser.topic.waitForLikeVote(c.BodyNr);
    });


    it(`... she logs in`, async () => {
      await mariasBrowser.complex.loginWithPasswordViaMetabar(maria);
    });


    it(`... it's her like vote`, async () => {
      await mariasBrowser.switchToEmbeddedCommentsIrame();
      await mariasBrowser.topic.waitForLikeVote(c.BodyNr, { byMe: true });
    });


    it(`Owen goes to ${embPages.slugs.onlySubscrNotfsPageSlug}`, async () => {
      await owensBrowser.go2(embeddingOrigin + embPages.slugs.onlySubscrNotfsPageSlug);
    });

    it(`... Owen needs to login?`, async () => {
      await owensBrowser.complex.loginIfNeededViaMetabar(owen);
    });

    it(`... posts the first reply`, async () => {
      await owensBrowser.switchToEmbeddedCommentsIrame();
      await owensBrowser.complex.replyToEmbeddingBlogPost(owensReplyGensNotfToMaria);
    });


    it(`... Maria gets notified (because is subscribed to notfs)`, async () => {
      await server.waitUntilLastEmailMatches(
          siteId, maria.emailAddress, owensReplyGensNotfToMaria, mariasBrowser);
      numEmailsToMaria = await server.countLastEmailsSentTo(siteId, maria.emailAddress);

      // Maybe now an old notf email got sent too — generted before the dump got
      // exported, but not sent until now. Maybe. It's a race condition.
      // However, hereafter, no more races.
      assert.that(numEmailsToMaria === 1 || numEmailsToMaria === 2);
    });


    it(`Owen goes to ${embPages.slugs.threeRepliesPageSlug}`, async () => {
      await owensBrowser.go2(embeddingOrigin + embPages.slugs.threeRepliesPageSlug);
    });


    it(`... posts a 4th reply, @mentions Michael and Maria`, async () => {
      await owensBrowser.complex.replyToEmbeddingBlogPost(owensReplyTwoMentionsMichaelMaria);
      numEmailsToMaria += 1;
    });


    it(`... Maria gets an email notf`, async () => {
      await server.waitUntilLastEmailMatches(
          siteId, maria.emailAddress, owensReplyTwoMentionsMichaelMaria, mariasBrowser);
      assert.eq(
          await server.countLastEmailsSentTo(siteId, maria.emailAddress), numEmailsToMaria);
    });


    it(`... but not Michael — he hasn't verified his email`, async () => {
      assert.eq(
          await server.countLastEmailsSentTo(siteId, michael.emailAddress),  0);
    });


    /*
    it(`Michael click his email verif link`, async () => {
      TESTS_MISSING
      // ??? but this link points to the wrong Talkyard site ???
      // Need re-send all email verif links?

      const link = await server.getLastVerifyEmailAddressLinkEmailedTo(
          siteId, michael.emailAddress, michaelsBrowser);
      await michaelsBrowser.go2(link);
    });


    it(`... now Michael's pending reply notf email gets sent to him`, async () => {
      await server.waitUntilLastEmailMatches(
          siteId, michael.emailAddress, owensReplyTwoMentionsMichaelMaria, michaelsBrowser);
    });


    TESTS_MISSING: Owen approves the review tasks

    */

  });
};


export default constructEmbCommentsImportTest;
