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


let everyonesBrowsers: TyAllE2eTestBrowsers;
let richBrowserA: TyE2eTestBrowser;
let richBrowserB: TyE2eTestBrowser;
let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let regina: Member;
let reginasBrowser: TyE2eTestBrowser;
let maria: Member;
let mariasBrowser: TyE2eTestBrowser;
let memah: Member;
let memahsBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

const GroupOneFullName = 'GroupOneFullName';
const GroupOneUsername = 'GroupOneUsername';

let siteIdAddress: IdAddress;
let siteId: SiteId;

let forum: TwoPagesTestForum;  // or: LargeTestForum

let owensTopicUrl: string;


const OwTpTtl = 'OwTpTtl';
const OwTpBdy = 'OwTpBdy';


describe("permissions-edit-wiki-posts  TyT603RKDEJ46", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      categoryPerms: 'FullMembersMayEditWiki',
      title: "Some E2E Test",
      members: ['maria', 'memah', 'michael', 'trillian', 'owen']
    });

    // Full members may edit wiki posts by default.
    forum.members.maria.trustLevel = c.TestTrustLevel.FullMember;
    // But Basic members may not.
    forum.members.michael.trustLevel = c.TestTrustLevel.Basic;

    // Disable notifications, not testing these notfs now.
    builder.settings({ numFirstPostsToReview: 0, numFirstPostsToApprove: 0 });
    builder.getSite().pageNotfPrefs = [{
      memberId: forum.members.owen.id,
      notfLevel: c.TestPageNotfLevel.Muted,
      wholeSite: true,
    }];

    assert.refEq(builder.getSite(), forum.siteData);
    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
    server.skipRateLimits(siteId);
  });

  it("initialize people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(allWdioBrowsers);
    richBrowserA = new TyE2eTestBrowser(wdioBrowserA);
    richBrowserB = new TyE2eTestBrowser(wdioBrowserB);

    owen = forum.members.owen;
    owensBrowser = richBrowserA;

    regina = forum.members.regina;
    reginasBrowser = richBrowserB;
    maria = forum.members.maria;
    mariasBrowser = richBrowserB;
    memah = forum.members.memah;
    memahsBrowser = richBrowserB;
    strangersBrowser = richBrowserB;
  });

  it("Owen logs in", () => {
    owensBrowser.go2(siteIdAddress.origin);
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
  });

  it("... posts a topic", () => {
    owensBrowser.complex.createAndSaveTopic({ title: OwTpTtl, body: OwTpBdy });
    owensTopicUrl = owensBrowser.getUrl();
  });

  it("Maria logs in", () => {
    mariasBrowser.go2(owensTopicUrl);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  it("Maria can Like Owen's topic", () => {
    mariasBrowser.topic.toggleLikeVote(c.BodyNr);
  });

  it("... but cannot edit it", () => {
    assert.not(mariasBrowser.topic.canEditOrigPost());
    assert.ok(owensBrowser.topic.canEditOrigPost());  // ttt: owen can edit
  });

  it("Owen wikifies his topic", () => {
    owensBrowser.topic.wikifyPostNr(c.BodyNr, true);
  });

  it("Now Maria can edit it", () => {
    mariasBrowser.refresh2();
    mariasBrowser.waitForMyDataAdded();
    assert.ok(mariasBrowser.topic.canEditOrigPost());
  });

  it("... and so she does", () => {
    mariasBrowser.complex.editPageBody(`I am the Maria from Dangerland,\n` +
          `All your power chargers are belong to me.`);
  });

  it("Owen quickly Un-wikifies the post", () => {
    owensBrowser.topic.wikifyPostNr(c.BodyNr, false);
  });

  it("Maria tries to edit more, without refreshing the page", () => {
    mariasBrowser.topic.clickEditoPostNr(c.BodyNr);
  });

  it("... but there's an error (because no longer wiki, cannot edit)", () => {
    mariasBrowser.serverErrorDialog.waitAndAssertTextMatches('EdEM0ED0YOURORIGP_');
  });

  it("Maria refreshes the page", () => {
    mariasBrowser.refresh2();
    mariasBrowser.waitForMyDataAdded();
  });

  it("... now she sees she cannot edit the post any more", () => {
    assert.not(mariasBrowser.topic.canEditOrigPost());
  });


  it("Maria leaves, Memah arrives", () => {
    mariasBrowser.topbar.clickLogout();
    memahsBrowser.complex.loginWithPasswordViaTopbar(memah);
  });

  it("Owen wikifies the post again", () => {
    owensBrowser.topic.wikifyPostNr(c.BodyNr, true);
  });

  it("... but Memah cannot edit it — she's a Basic Member only", () => {
    memahsBrowser.refresh2();
    memahsBrowser.waitForMyDataAdded();
    assert.not(memahsBrowser.topic.canEditOrigPost());
  });

  it("Owen goes to the groups page", () => {
    owensBrowser.groupListPage.goHere();
  });

  it("... creates Group One", () => {
    owensBrowser.groupListPage.createGroup({
          username: GroupOneUsername, fullName: GroupOneFullName });
  });

  it("... adds Memah", () => {
    owensBrowser.userProfilePage.groupMembers.addOneMember(memah.username);
  });

  it("Owen goes to Category A", () => {
    owensBrowser.go2('/latest/category-a');
  });

  it("... edits the categoy", () => {
    owensBrowser.forumButtons.clickEditCategory();
    owensBrowser.categoryDialog.openSecurityTab();
  });

  it("... adds Group One", () => {
    owensBrowser.categoryDialog.securityTab.addGroup(GroupOneFullName);
  });

  it("... lets Group One edit Wiki posts  TyTWIKIPRMS", () => {
    owensBrowser.categoryDialog.securityTab.setMayEditWiki('FIX_LATER' as any, true);
  });

  it("... saves", () => {
    owensBrowser.categoryDialog.submit();
  });

  it("Now Memah can edit the wiki post", () => {
    memahsBrowser.refresh2();
    memahsBrowser.waitForMyDataAdded();
    assert.ok(memahsBrowser.topic.canEditOrigPost());
  });

  it("... and so she does", () => {
    memahsBrowser.complex.editPageBody(
          `_ I edit Wikis from Wikiland _`, { append: true });
  });

  it("In the edits history, there're now 3 authors  TESTS_MISSING  TyTEDREVS02", () => {
  });

});

