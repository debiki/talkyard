/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import { execSync } from 'child_process';
import fs = require('fs');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import make = require('../utils/make');
import lad = require('../utils/log-and-die');
import c = require('../test-constants');
import * as embPages from './embedded-comments-create-site-export-json.2browsers.pages';

let browser: TyE2eTestBrowser;
declare let browserA: any;
declare let browserB: any;

let everyonesBrowsers;
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
  describe(testName, () => {

    if (settings.prod) {
      console.log("Skipping this spec — the server needs to have upsert conf vals enabled."); // E2EBUG
      return;
    }

    it("initialize people", () => {
      everyonesBrowsers = new TyE2eTestBrowser(wdioBrowser);
      owensBrowser = new TyE2eTestBrowser(browserA);
      mariasBrowser = new TyE2eTestBrowser(browserB);
      strangersBrowser = mariasBrowser;
      owen = make.memberOwenOwner();
      maria = make.memberMaria();
      michael = make.memberMichael();
      michaelsBrowser = mariasBrowser;
    });


    let jsonDumpStr;
    let siteDump: SiteData2;

    it("There's a Talkyard site json dump file:  " + c.EmbCommentsJsonExport, () => {
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

    it("... with an allowEmbeddingFrom setting", () => {
      embeddingOrigin = siteDump.settings.allowEmbeddingFrom;
      lad.logMessage(`\nThe embedding origin is:   ${embeddingOrigin}\n`);
      assert(!!embeddingOrigin && embeddingOrigin.length);
    });

    // ----- Import and login as Owen


    if (variants.importToNewSite) {
      let newSiteIdAddr: IdAddress;

      it("Imports the site", () => {
        // Avoid unique key errors.
        const testId = utils.generateTestId();
        siteDump.meta.pubId = siteDump.meta.pubId + '_copy_' + testId;
        siteDump.meta.name = siteDump.meta.name + '-copy-' + testId;
        newSiteIdAddr = server.importRealSiteData(siteDump);
        siteId = newSiteIdAddr.id;
        console.log("Import site response: " + JSON.stringify(newSiteIdAddr));
      });

      it("Owen goes to the re-imported site", () => {
        owensBrowser.go2(newSiteIdAddr.origin || newSiteIdAddr.siteIdOrigin);
      });

      it("... logs in", () => {
        owensBrowser.complex.loginWithPasswordViaTopbar(owen);
      });
    }
    else if (variants.importToExistingEmptyEmbCommentsSiteViaApi) {
      lad.die("unimplemented [TyE206MKTT1]");
      /*
      // ----- Imports the site, as a patch, to an already existing embedded comments site

      // Doesn't currently work: No ext imp id.

      it("Owen creates a 2nd embedded comments site", () => {
        const result = owensBrowser.createSiteAsOwen({ shortName: String, longName });
        data = result.data;
        siteId = result.siteId;
        talkyardSiteOrigin = result.talkyardSiteOrigin;
      });

      // ------ Dupl code [5029gKTHF35]
      it("Owen creates an API secret: Goes to the admin area, the API tab", () => {
        owensBrowser.adminArea.goToApi();
      });

      it("... generates the API secret", () => {
        owensBrowser.adminArea.apiTab.generateSecret();
      });

      let apiSecret: string;

      it("... copies the secret key", () => {
        apiSecret = owensBrowser.adminArea.apiTab.showAndCopyMostRecentSecret();
      });

      function postCommentsToTalkyard(filePath: string) {
        const cmd =
            'nodejs to-talkyard/dist/to-talkyard/src/to-talkyard.js ' +
              `--talkyardJsonPatchFile=${filePath} ` +
              `--sysbotApiSecret=${apiSecret} ` +
              `--sendTo=${talkyardSiteOrigin}`
        lad.logMessage(`Executing this:\n  ${cmd}`)
        execSync(cmd);
      }
      // ------ /Dupl code [5029gKTHF35]


      it("... and posts to the Talkyard server", () => {
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

      it("Owen creates a 2nd embedded comments site", () => {
        const newSiteData = owensBrowser.makeNewSiteDataForEmbeddedComments({
            shortName: 'emb-rst', longName: "Emb Restore Site" });
        const result: NewSiteResult = owensBrowser.createNewSite(newSiteData);
        siteId = result.siteId;
        testId = result.testId;
      });

      it("Owen goes to the Backups admin area tab", () => {
        owensBrowser.adminArea.goToBackupsTab();
      });

      it("... opens a site dump file in an 'editor'", () => {
        site = siteDump;
      });

      it("... edits site dump hostname, name, pubId — to avoid unique key errors", () => {
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
              : owensBrowser.host();
        lad.logMessage(`Setting hostname in dump to:  ${hostnameInDump}`);
        site.meta.hostnames[0].hostname = hostnameInDump;
        // Could let these ones be the same too, but oh well, simpler to just append this:
        // (Need the unique testId too, in case re-runs this test, maybe a retry, if flaky.)
        // (This can be an a bit long name, like, 65 chars. [502KHSRG52])
        site.meta.name = site.meta.name + '-e2ecopy-' + testId;
        site.meta.pubId = site.meta.pubId + '_e2ecopy_' + testId;
        fs.writeFileSync(c.EmbCommentsJsonExportCopy, JSON.stringify(site));
      });

      /* it("We delete the old site's hostname, to avoid unique key error", () => {
        server.deleteHosts([ ])
      }); */

      it("Owen restores the edited site backup", () => {
        owensBrowser.adminArea.backupsTab.clickRestore();
        owensBrowser.adminArea.backupsTab.selectFileToRestore(
            c.EmbCommentsJsonExportCopyFileName);
      });

      it("There's a Done Restoing Backup message", () => {
        owensBrowser.waitForExist('.e_RstrDne');
      });

      it("Owen remains logged in?  Or needs to login again?", () => {
        owensBrowser.refresh();
        // Hmm, currently:
        owensBrowser.topbar.assertMyUsernameMatches(owen.username);
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

    it("No emails have been sent, this far — or maybe just one old notf, to Maria", () => {
      // I think sometimes the json dump includes a notf for which no email has yet
      // been sent — then, that email will get sent, after the dump has gotten imported,
      // and Maria's num-emails-gotten counter starts at 1.
      numEmailsToMaria = server.countLastEmailsSentTo(siteId, maria.emailAddress);
      assert(numEmailsToMaria === 0 || numEmailsToMaria === 1);
      assert.equal(server.countLastEmailsSentTo(siteId, michael.emailAddress), 0);
      assert.equal(server.countLastEmailsSentTo(siteId, owen.emailAddress), 0);
    });


    it("Owen goes to the emb comments settings page", () => {
      owensBrowser.adminArea.settings.embedded.goHere();
      owensBrowser.waitAndClick('.e_SthElseB');
    });


    it("... updates the embedding pages with urls to the new Talkyard site", () => {
      embPages.createEmbeddingPages(owensBrowser);
    });


    it("Owen goes to the Review page", () => {
      owensBrowser.adminArea.review.goHere();
    });


    it("... sees Michael's post, which he previously flagged, before the export", () => {
      owensBrowser.adminArea.review.waitForTextToReview(
          embPages.texts.michaelsReply, { index: 1 });
    });


    it("... and Maria's post, because it's by a new member", () => {
      owensBrowser.adminArea.review.waitForTextToReview(
          embPages.texts.mariasReplyOne, { index: 2 });
    });


    it("... and Michael's, again, why not merged with the other revw task? (0592DW660)", () => {
      owensBrowser.adminArea.review.waitForTextToReview(
          embPages.texts.michaelsReply, { index: 3 });
    });


    it("... and Garbo Guest's reply", () => {
      owensBrowser.adminArea.review.waitForTextToReview(
          embPages.texts.guestsReply, { index: 4 });
    });


    it("... nothing more  (but why 4 not 3?  (0592DW660))", () => {
      assert.equal(owensBrowser.adminArea.review.countThingsToReview(), 4);
    });


    it(`Maria goes to ${embPages.slugs.guestReplyPageSlug}`, () => {
      mariasBrowser.go2(embeddingOrigin + embPages.slugs.guestReplyPageSlug);
    });


    it(`... sees the guest's reply`, () => {
      mariasBrowser.switchToEmbeddedCommentsIrame();
      mariasBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
      mariasBrowser.topic.assertNumRepliesVisible(1);
    });


    it(`... with the correct text`, () => {
      mariasBrowser.topic.waitForPostAssertTextMatches(
          c.FirstReplyNr, embPages.texts.guestsReply);
    });


    it(`Maria goes to ${embPages.slugs.threeRepliesPageSlug}`, () => {
      mariasBrowser.go2(embeddingOrigin + embPages.slugs.threeRepliesPageSlug);
    });


    it(`... sees the three replies`, () => {
      mariasBrowser.switchToEmbeddedCommentsIrame();
      mariasBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
      mariasBrowser.topic.assertNumRepliesVisible(3);
    });


    it(`... with the correct text`, () => {
      mariasBrowser.topic.waitForPostAssertTextMatches(
          c.FirstReplyNr + 0, embPages.texts.michaelsReply);
      mariasBrowser.topic.waitForPostAssertTextMatches(
          c.FirstReplyNr + 1, embPages.texts.mariasReplyOne);
      mariasBrowser.topic.waitForPostAssertTextMatches(
          c.FirstReplyNr + 2, embPages.texts.owensReplyMentionsMariaMichael);
    });


    it(`Maria goes to ${embPages.slugs.replyWithImagePageSlug}`, () => {
      mariasBrowser.go2(embeddingOrigin + embPages.slugs.replyWithImagePageSlug);
    });


    it(`... sees the reply with the image`, () => {
      mariasBrowser.switchToEmbeddedCommentsIrame();
      mariasBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
      mariasBrowser.topic.assertNumRepliesVisible(1);
    });


    it(`... with the correct text`, () => {
        mariasBrowser.topic.waitForPostAssertTextMatches(
            c.FirstReplyNr, embPages.texts.mariasReplyTwoWithImage);
    });


    it(`Maria goes to ${embPages.slugs.onlyLikeVotePageSlug}`, () => {
      mariasBrowser.go2(embeddingOrigin + embPages.slugs.onlyLikeVotePageSlug);
    });


    it(`... sees a Like vote`, () => {
      mariasBrowser.switchToEmbeddedCommentsIrame();
      mariasBrowser.topic.waitForLikeVote(c.BodyNr);
    });


    it(`... she logs in`, () => {
      mariasBrowser.complex.loginWithPasswordViaMetabar(maria);
    });


    it(`... it's her like vote`, () => {
      mariasBrowser.switchToEmbeddedCommentsIrame();
      mariasBrowser.topic.waitForLikeVote(c.BodyNr, { byMe: true });
    });


    it(`Owen goes to ${embPages.slugs.onlySubscrNotfsPageSlug}`, () => {
      owensBrowser.go2(embeddingOrigin + embPages.slugs.onlySubscrNotfsPageSlug);
    });

    it("... Owen needs to login?", () => {
      owensBrowser.complex.loginIfNeededViaMetabar(owen);
    });

    it(`... posts the first reply`, () => {
      owensBrowser.switchToEmbeddedCommentsIrame();
      owensBrowser.complex.replyToEmbeddingBlogPost(owensReplyGensNotfToMaria);
    });


    it(`... Maria gets notified (because is subscribed to notfs)`, () => {
      server.waitUntilLastEmailMatches(
          siteId, maria.emailAddress, owensReplyGensNotfToMaria, mariasBrowser);
      numEmailsToMaria = server.countLastEmailsSentTo(siteId, maria.emailAddress);

      // Maybe now an old notf email got sent too — generted before the dump got
      // exported, but not sent until now. Maybe. It's a race condition.
      // However, hereafter, no more races.
      assert(numEmailsToMaria === 1 || numEmailsToMaria === 2);
    });


    it(`Owen goes to ${embPages.slugs.threeRepliesPageSlug}`, () => {
      owensBrowser.go2(embeddingOrigin + embPages.slugs.threeRepliesPageSlug);
    });


    it(`... posts a 4th reply, @mentions Michael and Maria`, () => {
      owensBrowser.complex.replyToEmbeddingBlogPost(owensReplyTwoMentionsMichaelMaria);
      numEmailsToMaria += 1;
    });


    it(`... Maria gets an email notf`, () => {
      server.waitUntilLastEmailMatches(
          siteId, maria.emailAddress, owensReplyTwoMentionsMichaelMaria, mariasBrowser);
      assert.equal(
          server.countLastEmailsSentTo(siteId, maria.emailAddress), numEmailsToMaria);
    });


    it(`... but not Michael — he hasn't verified his email`, () => {
      assert.equal(
          server.countLastEmailsSentTo(siteId, michael.emailAddress),  0);
    });


    /*
    it(`Michael click his email verif link`, () => {
      TESTS_MISSING
      // ??? but this link points to the wrong Talkyard site ???
      // Need re-send all email verif links?

      const link = server.getLastVerifyEmailAddressLinkEmailedTo(
          siteId, michael.emailAddress, michaelsBrowser);
      michaelsBrowser.go2(link);
    });


    it(`... now Michael's pending reply notf email gets sent to him`, () => {
      server.waitUntilLastEmailMatches(
          siteId, michael.emailAddress, owensReplyTwoMentionsMichaelMaria, michaelsBrowser);
    });


    TESTS_MISSING: Owen approves the review tasks

    */

  });
};


export default constructEmbCommentsImportTest;
