/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';

let allBrowsers: TyAllE2eTestBrowsers;
let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let mallory: Member;
let mallory_brB: TyE2eTestBrowser;
let memah: Member;
let memah_brB: TyE2eTestBrowser;
let stranger_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;

const mallorysTopicTitle = 'mallorysTopicTitle';
let mallorysTopicPath: St;
const owensOpReply = 'owensOpReply';
const mallorysReplyToOwen = 'mallorysReplyToOwen';
const owensReplyToMallorysReply = 'owensReplyToMallorysReply';


describe(`topic-prominent-pats-reply-approve.2br.d  TyTPROMPATS_REAPR`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Frequent Posters List E2E Test",
      members: ['memah', 'mallory', 'maria', 'michael']
    });

    allBrowsers = new TyE2eTestBrowser(allWdioBrowsers, 'brAll');
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    mallory = forum.members.mallory;
    mallory_brB = brB;
    mallory.threatLevel = c.TestThreatLevel.ModerateThreat;

    memah = forum.members.memah;
    memah_brB = brB;
    stranger_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    await server.skipRateLimits(site.id);
  });



  it(`Mallory logs in. He's been teasing the others, has ThreatLevel.Moderate`, async () => {
    await mallory_brB.go2(site.origin);
    await mallory_brB.complex.loginWithPasswordViaTopbar(mallory);
  });

  it(`Mallory posts a new topic, becomes hidden, pending approval  TyTAPRTHRT`, async () => {
    await mallory_brB.complex.createAndSaveTopic({
            title: mallorysTopicTitle, body: 'Bla bla.', willBePendingApproval: true })
    mallorysTopicPath = await mallory_brB.urlPath();
  });

  it(`Owen logs in`, async () => {
    await owen_brA.go2(site.origin);
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });
  it(`... sees Mallory's post, hidden for others since not yet approved`, async () => {
    await owen_brA.forumTopicList.waitForTopicVisible(mallorysTopicTitle, { andHidden: true });
  });
  it(`... Mallory is shown as the topic poster`, async () => {
    const usernames = await owen_brA.forumTopicList.getTopicProminentUsernames({
            topicUrlPath: mallorysTopicPath, howMany: 1 });
    assert.deepEq(usernames, [
            mallory.username]);
  });
  it(`Owen goes to Mallory's page`, async () => {
    await owen_brA.forumTopicList.navToTopic(mallorysTopicTitle);
  });
  it(`... replies to the not-yet-approved page (Owen can, because is admin)  TyTREBEFAPR`,
        async () => {
    await owen_brA.complex.replyToOrigPost(owensOpReply)
  });
  it(`... and approves the page (*after* having replied)  TyTAPRTHRPG01`, async () => {
    await owen_brA.topic.approvePostNr(c.BodyNr);
  });

  it(`Owen returns to the topic list`, async () => {
    await owen_brA.topbar.clickHome();
  });
  it(`... sees Mallory's post, now approved`, async () => {
    await owen_brA.forumTopicList.waitForTopicVisible(mallorysTopicTitle);
  });
  it(`... Mallory is listed as the original-poster, Owen as last replier`, async () => {
    const usernames = await owen_brA.forumTopicList.getTopicProminentUsernames({
            topicUrlPath: mallorysTopicPath, howMany: 2 });
    assert.deepEq(usernames, [mallory.username, owen.username]);
  });

  it(`Mallory replies to Owen, becomes pending approval  TyTAPRTHRT`, async () => {
    await mallory_brB.complex.replyToPostNr(c.FirstReplyNr, mallorysReplyToOwen);
  });
  it(`Owen goes to Mallory's page again`, async () => {
    await owen_brA.forumTopicList.navToTopic(mallorysTopicTitle);
  });
  it(`... replies to Mallory's not-yet-approved reply (Owen can, he's admin)  TyTREBEFAPR`,
      async () => {
    await owen_brA.complex.replyToPostNr(c.SecondReplyNr, owensReplyToMallorysReply);
  });
  it(`... approves Mallory's reply  (after having replied already)`, async () => {
    await owen_brA.topic.approvePostNr(c.SecondReplyNr);
  });

  it(`Owen goes to the topic list`, async () => {
    await owen_brA.go2('/');
  });
  it(`... sees Mallory's post`, async () => {
    await owen_brA.forumTopicList.assertTopicVisible(mallorysTopicTitle);
  });
  it(`... Mallory and Owen are still listed as original-poster and last-replyer`, async () => {
    const usernames = await owen_brA.forumTopicList.getTopicProminentUsernames({
            topicUrlPath: mallorysTopicPath, howMany: 2 });
    assert.deepEq(usernames, [mallory.username, owen.username]);
  });
});

