/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/pages-for';
import settings = require('../utils/settings');
import lad = require('../utils/log-and-die');
import c = require('../test-constants');


let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maria: Member;
let maria_brA: TyE2eTestBrowser;
let maria_brB: TyE2eTestBrowser;
let memah: Member;
let memah_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;

const mariasTopicTitle = 'mariasTopicTitle';
const mariasTopicBody = 'mariasTopicBody';
let mariasTopicUrl = '';

const memahsTopicTitle = 'memahsTopicTitle';
const memahsTopicBody = 'memahsTopicBody';
let memahsTopicUrl = '';

let lastPostNr = 0;
let nextPostNr = c.FirstReplyNr;



describe(`delete-pages.2br  TyTE2EDELPG602`, () => {

  it(`construct site`, () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Some E2E Test",
      members: ['memah', 'maria'],
    });

    brA = new TyE2eTestBrowser(wdioBrowserA);
    brB = new TyE2eTestBrowser(wdioBrowserB);

    owen = forum.members.owen;
    owen_brA = brA;
    maria = forum.members.maria;
    maria_brA = brA;

    memah = forum.members.memah;
    memah_brB = brB;

    maria_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`import site`, () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });



  it(`Maria and Memah arrives`, () => {
    maria_brA.go2(site.origin);
    maria_brA.complex.loginWithPasswordViaTopbar(maria);
    memah_brB.go2(site.origin);
    memah_brB.complex.loginWithPasswordViaTopbar(memah);
  });


  it(`Maria creates a page`, () => {
    maria_brA.complex.createAndSaveTopic({
            title: mariasTopicTitle, body: mariasTopicBody });
    mariasTopicUrl = maria_brA.getUrl();
  });
  it(`.. Memah too`, () => {
    memah_brB.complex.createAndSaveTopic({
            title: memahsTopicTitle, body: memahsTopicBody });
    memahsTopicUrl = memah_brB.getUrl();
  });


  // ----- Can delete own page

  it(`Memah deletes her page`, () => {
    memah_brB.topic.deletePage();
  });


  // ----- Cannot delete other's pages

  it(`Memah can see Maria's page`, () => {
    memah_brB.go2(mariasTopicUrl);
    memah_brB.topic.assertPostTextIs(c.TitleNr, mariasTopicTitle, { wait : true });
  });

  it(`... but cannot delete it`, () => {
    assert.not(memah_brB.topic.canDeleteOrUndeletePage());
  });


  // ----- Cannot see other's deleted pages

  it(`Maria can delete it — she created it`, () => {
    assert.that(maria_brA.topic.canDeleteOrUndeletePage());   // ttt
  });
  it(`... she does,  quickly`, () => {
    maria_brA.topic.deletePage();
    nextPostNr += 1; // meta post about page deleted
  });

  it(`Memah can no longer sees Maria's page`, () => {
    memah_brB.refresh2();
    memah_brB.assertNotFoundError({ whyNot: 'PageDeleted' });
  });

  it(`... but Maria can still see it — her page, deleted by her`, () => {
    maria_brA.topic.assertPostTextIs(c.TitleNr, mariasTopicTitle, { wait : true });
  });
  it(`... also after page reload`, () => {
    maria_brA.refresh2();
    maria_brA.topic.assertPostTextIs(c.TitleNr, mariasTopicTitle, { wait : true });
  });


  // ----- Can undelete own page

  it(`Maria undeletes the page`, () => {
    maria_brA.topic.undeletePage();
    nextPostNr += 1; // meta post about page undeleted
  });
  it(`... now Memah sees it again`, () => {
    memah_brB.refresh2();
    memah_brB.topic.assertPostTextIs(c.TitleNr, mariasTopicTitle, { wait : true });
  });


  // ----- Can delete pages with other's replies

  it(`Memah replies — and tries to sound calm`, () => {
    memah_brB.complex.replyToOrigPost(`Why delete this nice page?`);
    lastPostNr = nextPostNr;
    nextPostNr += 1;
  });

  it(`... Maria's page live updates: shows Memah's reply  [TyTWS702MEGR5]`, () => {
    maria_brA.topic.waitForPostNrVisible(lastPostNr);
  });

  it(`Maria can no longer delete the page — because now someone has replied`, () => {
    assert.not(maria_brA.topic.canDeleteOrUndeletePage());
  });

  it(`... also after page reload, she cannot`, () => {
    maria_brA.refresh2();
    assert.not(maria_brA.topic.canDeleteOrUndeletePage());
  });


  it(`Memah deletes her reply  TyT602MREJ5`, () => {
    memah_brB.topic.deletePost(lastPostNr);
  });

  it(`... now Maria can delete the page again`, () => {
    maria_brA.refresh2();
    assert.that(maria_brA.topic.canDeleteOrUndeletePage());
  });
  it(`... she does, again`, () => {
    maria_brA.topic.deletePage();
    nextPostNr += 1; // meta post about page deleted
  });
  it(`Memah can no longer see it, again`, () => {
    memah_brB.refresh2();
    memah_brB.assertNotFoundError({ whyNot: 'PageDeleted' });
  });

  it(`Maria undeletes it`, () => {
    maria_brA.topic.undeletePage();
    nextPostNr += 1; // meta post about page undeleted
  });


  // ----- Staff can delete pages with other's replies


  it(`Mema posts another reply`, () => {
    memah_brB.refresh2();
    memah_brB.complex.replyToOrigPost(`Nice page, keep, yes please!`);
    lastPostNr = nextPostNr;
    nextPostNr += 1;
  });

  it(`Owen arrives`, () => {
    maria_brA.topbar.clickLogout();
    owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });
  it(`... sees Memah's reply`, () => {
    owen_brA.topic.waitForPostNrVisible(c.FirstReplyNr + 1);
  });
  it(`Owen is admin, can delete pages with replies`, () => {
    owen_brA.topbar.pageTools.deletePage();
  });

  it(`Memah cannot see it`, () => {
    memah_brB.refresh2();
    memah_brB.assertNotFoundError({ whyNot: 'PageDeleted' });
  });

  it(`Maria wants to try, takes Memahs laptop (they're in the same café)`, () => {
    memah_brB.go2('/');  // so topbar visible
    memah_brB.topbar.clickLogout();
    maria_brB.complex.loginWithPasswordViaTopbar(maria);
  });

  it(`Maria also cannot see the page — it got deleted by staff, not by her`, () => {
    maria_brB.go2(mariasTopicUrl);
    maria_brB.assertNotFoundError({ whyNot: 'PageDeleted' });
  });

  it(`Owen undeletes the page`, () => {
    owen_brA.topbar.pageTools.restorePage();
  });
  it(`... now Maria sees it again`, () => {
    maria_brB.refresh2();
    maria_brB.topbar.assertMyUsernameMatches(maria.username); // ttt
    maria_brB.topic.assertPostTextIs(c.TitleNr, mariasTopicTitle, { wait : true });
  });

  it(`Memah takes her laptop back, and looks upset`, () => {
    maria_brB.topbar.clickLogout();
    memah_brB.complex.loginWithPasswordViaTopbar(memah);
  });
  it(`... Memah too can see the page`, () => {
    memah_brB.refresh2();
    memah_brB.topic.assertPostTextIs(c.TitleNr, mariasTopicTitle, { wait : true });
  });



  // ----- Staff can undelete pages deleted by ordinary members


  it(`Owen goes to Memah's already deleted page`, () => {
    owen_brA.go2(memahsTopicUrl);
  });
  it(`... undeletes the page — he can, he's admin`, () => {
    owen_brA.topbar.pageTools.restorePage();
  });



  // ----- Can delete own page with one's own replies only  [del_own_pg]

  // TESTS_MISSING  TyT7MEWQ3SF

  // Memah posts a reply on her own page, thereafter deletes the page
  //   — fine, since is her own reply.

});

