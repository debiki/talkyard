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
let mons: Member;
let mons_brB: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;
let memah: Member;
let memah_brB: TyE2eTestBrowser;
let michael: Member;
let stranger_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;

const mariasTopicTitle = 'mallorysTopicTitle';
let mariasTopicPath: St;
const owensOpReply = 'owensOpReply';
const mallorysReplyToOwen = 'mallorysReplyToOwen';
const monsReply = 'owensReplyToMallorysReply';
const monsReplyTwo = 'monsReplyTwo';
const memahsReply = 'memahsReply';
const mariasReplyVeryLast = 'mariasReplyVeryLast';


describe(`topic-prominent-pats-basic.2br.d  TyTPROMPATS_BSC`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Frequent Posters List E2E Test",
      members: ['mons', 'maria', 'memah', 'michael']
    });

    allBrowsers = new TyE2eTestBrowser(allWdioBrowsers, 'brAll');
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    mons = forum.members.mons;
    mons_brB = brB;
    maria = forum.members.maria;
    maria_brB = brB;
    memah = forum.members.memah;
    memah_brB = brB;
    michael = forum.members.michael;
    stranger_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    await server.skipRateLimits(site.id);
  });



  it(`Maria logs in`, async () => {
    await maria_brB.go2(site.origin);
    await maria_brB.complex.loginWithPasswordViaTopbar(maria);
  });

  it(`... posts a new topic`, async () => {
    await maria_brB.complex.createAndSaveTopic({ title: mariasTopicTitle, body: 'Bla bla.' })
    mariasTopicPath = await maria_brB.urlPath();
  });

  it(`Owen logs in`, async () => {
    await owen_brA.go2(site.origin);
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });
  it(`... sees Maria's post`, async () => {
    await owen_brA.forumTopicList.waitForTopicVisible(mariasTopicTitle);
  });
  it(`... Maria is listed as the topic poster`, async () => {
    const usernames = await owen_brA.forumTopicList.getTopicProminentUsernames({
            topicUrlPath: mariasTopicPath, howMany: 1 });
    assert.deepEq(usernames, [
            maria.username]);
  });
  it(`Owen goes to Maria's page`, async () => {
    await owen_brA.forumTopicList.navToTopic(mariasTopicTitle);
  });
  it(`... replies`, async () => {
    await owen_brA.complex.replyToOrigPost(owensOpReply)
  });

  it(`Owen returns to the topic list`, async () => {
    await owen_brA.topbar.clickHome();
  });
  it(`Now Maria is listed as the original-poster, Owen as last replier`, async () => {
    const usernames = await owen_brA.forumTopicList.getTopicProminentUsernames({
            topicUrlPath: mariasTopicPath, howMany: 2 });
    assert.deepEq(usernames, [
            maria.username, owen.username]);
  });

  it(`Mons goes to Maria's page`, async () => {
    await maria_brB.topbar.clickLogout();
    await mons_brB.go2(mariasTopicPath)
    await mons_brB.complex.loginWithPasswordViaTopbar(mons);
  });
  it(`... replies`, async () => {
    await mons_brB.complex.replyToPostNr(c.FirstReplyNr, monsReply);
  });
  it(`... twice! Now Mons is the most frequent replyer, and last replyer`, async () => {
    await mons_brB.complex.replyToPostNr(c.FirstReplyNr, monsReplyTwo);
  });

  it(`Owen reloads the topic list`, async () => {
    await owen_brA.refresh2();
  });
  it(`... he's a Frequent Poster, and Mons is the last replyer — has
              precedence over being the most frequent poster`, async () => {
    const usernames = await owen_brA.forumTopicList.getTopicProminentUsernames({
            topicUrlPath: mariasTopicPath, howMany: 3 });
    assert.deepEq(usernames, [
            maria.username, owen.username, mons.username]);
  });

  it(`Mons assigns the page to Michael`, async () => {
    await mons_brB.topic.openAssignToDiag();
    await mons_brB.addUsersToPageDialog.addOneUser(michael.username);
    await mons_brB.addUsersToPageDialog.submit();
  });

  it(`Owen reloads the topic list`, async () => {
    await owen_brA.refresh2();
  });
  it(`... now Michael appears as Assigned  TyTSEETOPICASGS`, async () => {
    const usernames = await owen_brA.forumTopicList.getTopicProminentUsernames({
            topicUrlPath: mariasTopicPath, howMany: 4 });
    assert.deepEq(usernames, [
            maria.username, owen.username, mons.username, michael.username]);
  });

  it(`Memah arrives`, async () => {
    await mons_brB.topbar.clickLogout();
    await memah_brB.complex.loginWithPasswordViaTopbar(memah);
  });
  it(`... replies`, async () => {
    await memah_brB.complex.replyToOrigPost(memahsReply);
  });

  it(`Owen reloads the topic list`, async () => {
    await owen_brA.refresh2();
  });
  it(`... now Mons is listed before Owen, because he has posted more.
              Memah appears as last replyer`, async () => {
    const usernames = await owen_brA.forumTopicList.getTopicProminentUsernames({
            topicUrlPath: mariasTopicPath, howMany: 5 });
    assert.deepEq(usernames, [
            maria.username, mons.username, owen.username, memah.username, michael.username]);
  });

  it(`Maria is back`, async () => {
    await memah_brB.topbar.clickLogout();
    await maria_brB.complex.loginWithPasswordViaTopbar(maria);
  });
  it(`... replies — makes her both the orig poster, and last replyer`, async () => {
    await maria_brB.complex.replyToOrigPost(mariasReplyVeryLast);
  });

  it(`Owen reloads the topic list`, async () => {
    await owen_brA.refresh2();
  });
  it(`... Maria is both orig poster, and last replyer`, async () => {
    const usernames = await owen_brA.forumTopicList.getTopicProminentUsernames({
            topicUrlPath: mariasTopicPath, howMany: 6 });
    assert.deepEq(usernames, [
            // Orig poster
            maria.username,
            // Most comments
            mons.username,
            // One comment, but posted before ...
            owen.username,
            // Memah's comment, also just one.
            memah.username,
            // Last replyer
            maria.username,
            // Assigned
            michael.username]);
  });

});

