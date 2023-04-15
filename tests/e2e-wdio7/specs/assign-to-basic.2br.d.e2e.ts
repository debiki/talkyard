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
let mons_brA: TyE2eTestBrowser;
let trillian: Member;
let trillian_brA: TyE2eTestBrowser;
let maja: Member;
let maria: Member;
let maria_brB: TyE2eTestBrowser;
let memah: Member;
let memah_brB: TyE2eTestBrowser;
let michael: Member;
let stranger_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;

let buyCreamPagePath = '/buy-cream';
let buyMilkPagePath = '/buy-milk';



describe(`assign-to-basic.2br.d.e2e.ts  TyTASSIGN01`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Assign-To E2E Test",
      members: ['owen', 'mons', 'trillian', 'maja', 'maria', 'memah', 'michael']
    });

    builder.addPage({
      id: 'buyCreamPageId',
      folder: '/',
      showId: false,
      slug: buyCreamPagePath.substring(1),
      role: c.TestPageRole.Idea,
      title: "Buy cream",
      body: "We have milk but we need cream too. Can we buy cream or take from our neighbor?",
      categoryId: forum.categories.categoryA.id,
      authorId: forum.members.maja.id,
    });

    builder.addPage({
      id: 'buyMilkPageId',
      folder: '/',
      showId: false,
      slug: buyMilkPagePath.substring(1),
      role: c.TestPageRole.Discussion,
      title: "Buy milk also",
      body: "We have lots of milk and it's always good with more. Hence, buy more milk?",
      categoryId: forum.categories.categoryA.id,
      authorId: forum.members.maja.id,
    });

    // Disable notifications, or notf email counts will be off
    // (since Owen would get emails).
    builder.settings({
      numFirstPostsToApprove: 0,
      //maxPostsPendApprBefore: 0,
      numFirstPostsToReview: 0,
    });
    builder.getSite().pageNotfPrefs = [{
      memberId: forum.members.owen.id,
      notfLevel: c.TestPageNotfLevel.Muted,
      wholeSite: true,
    }];

    allBrowsers = new TyE2eTestBrowser(allWdioBrowsers, 'brAll');
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;
    mons = forum.members.mons;
    mons_brA = brA;
    trillian = forum.members.trillian;
    trillian_brA = brA;

    maja = forum.members.maja;
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


  it(`Owen goes to Maja's milk topic, logs in ... `, async () => {
    await owen_brA.go2(site.origin + buyMilkPagePath);
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });


  it(`Memah goes to the milk topic too, logs in`, async () => {
    await memah_brB.go2(site.origin + buyMilkPagePath);
    await memah_brB.complex.loginWithPasswordViaTopbar(memah);
  });

  it(`Memah doesn't see any Change or Assign buttons`, async () => {
    await memah_brB.assertNotExists(brB.topic.changePageBtnSel);
  });


  it(`... but Owen does. He opens the Assign-To dialog`, async () => {
    await owen_brA.topic.openAssignToDiag();
  });
  it(`... assigns the buy-milk topic to Memah`, async () => {
    await owen_brA.addUsersToPageDialog.addOneUser(memah.username);
    await owen_brA.addUsersToPageDialog.submit();
  });
  it(`... sees Memah now listed as assignee`, async () => {
    assert.deepEq(await owen_brA.topic.getAssigneesUsernamesNoAt(c.BodyNr), [memah.username]);
  });

  it(`Memah gets a notification   UNIMPL  TESTS_MISSING`, async () => {
  });
  it(`Maja also — it's her page, she wants to know   UNIMPL  TESTS_MISSING`, async () => {
  });

  it(`Memah looks at her task list`, async () => {
    await memah_brB.topbar.clickGoToProfile();
    await memah_brB.userProfilePage.tabs.switchToTasks();
  });
  it(`... the topic is listed there`, async () => {
    await memah_brB.userProfilePage.activity.posts.waitForPostTextsVisible();
    await memah_brB.userProfilePage.activity.posts.assertExactly(1);
  });
  it(`... assigned to her (Memah)`, async () => {
    assert.deepEq(await memah_brB.userProfilePage.activity.posts.getAssigneeUsernamesNoAt({
            forPageId: 'buyMilkPageId' }), [memah.username]);
  });

  it(`Memah leaves`, async () => {
    await memah_brB.topbar.clickLogout();
  });

  it(`A stranger cannot see Memah's task list`, async () => {
    await maria_brB.userProfilePage.waitForBadRoute();
  });

  it(`Maria arrives`, async () => {
    await maria_brB.complex.loginWithPasswordViaTopbar(maria);
  });
  it(`Maria can see Memah's task list — by default, members can see others' tasks
                OOOPS NO THEY CANNOT, fix?  Or allow trusted members?`, async () => {
    /*
    await maria_brB.userProfilePage.activity.posts.waitForPostTextsVisible();
    await maria_brB.userProfilePage.activity.posts.assertExactly(1);
    assert.deepEq(await maria_brB.userProfilePage.activity.posts.getAssigneeUsernamesNoAt({
            forPageId: 'buyMilkPageId' }), [memah.username]);
    */
  });

  it(`Maria goes to the buy-milk page`, async () => {
    await maria_brB.go2(buyMilkPagePath);
  });
  it(`... sees it's assigned to Memah`, async () => {
    assert.deepEq(await maria_brB.topic.getAssigneesUsernamesNoAt(c.BodyNr),
            [memah.username]); // fok
  });


  it(`Owen opens the assignees dialog again ...`, async () => {
    await owen_brA.topic.openAssignToDiag();
  });
  it(`... clears current assignees (Memah)`, async () => {
    await owen_brA.addUsersToPageDialog.clear();
  });
  it(`... assigns Maria and Michael instead`, async () => {
    await owen_brA.addUsersToPageDialog.addOneUser(maria.username);
    await owen_brA.addUsersToPageDialog.addOneUser(michael.username);
    await owen_brA.addUsersToPageDialog.submit();
  });
  it(`... sees Maria and Michael now listed as assignees`, async () => {
    assert.deepEq(await owen_brA.topic.getAssigneesUsernamesNoAt(c.BodyNr),
            [maria.username, michael.username]);   // SORT ORDER? else, flaky test
  });

  it(`Memah gets a notification about no longer being assigned   UNIMPL TESTS_MISSING`, async () => {
  });
  it(`Maria gets a notification about having been assigned   UNIMPL TESTS_MISSING`, async () => {
  });
  it(`Michael too   UNIMPL TESTS_MISSING`, async () => {
  });
  it(`Maja also — it's her page   UNIMPL TESTS_MISSING`, async () => {
  });

  it(`Maria reloads the page again ...`, async () => {
    await maria_brB.refresh2();
  });
  it(`... sees it's assigned to her and Michael`, async () => {
    assert.deepEq(await maria_brB.topic.getAssigneesUsernamesNoAt(c.BodyNr),
            [maria.username, michael.username]);   // SORT ORDER? else, flaky test
  });


  it(`Maria looks at her task list`, async () => {
    await maria_brB.topbar.clickGoToProfile();
    await maria_brB.userProfilePage.tabs.switchToTasks();
  });
  it(`... the topic is listed, there`, async () => {
    await maria_brB.userProfilePage.activity.posts.waitForPostTextsVisible();
    await maria_brB.userProfilePage.activity.posts.assertExactly(1);
  });
  it(`... assigned to Maria and Michael`, async () => {
    assert.deepEq(await maria_brB.userProfilePage.activity.posts.getAssigneeUsernamesNoAt({
            forPageId: 'buyMilkPageId' }), [maria.username, michael.username]);  // fok
  });

  it(`Owen looks at Maria's task list too`, async () => {
    await owen_brA.userProfilePage.tasks.goHere(maria.username);
  });
  it(`... sees the topic listed as a task, he too`, async () => {
    await owen_brA.userProfilePage.activity.posts.waitForPostTextsVisible();
    await owen_brA.userProfilePage.activity.posts.assertExactly(1);
  });
  it(`... assigned to Maria and Michael`, async () => {
    assert.deepEq(await owen_brA.userProfilePage.activity.posts.getAssigneeUsernamesNoAt({
            forPageId: 'buyMilkPageId' }), [maria.username, michael.username]);  // fok
  });


  it(`Owen leaves, moderator Mons arrives`, async () => {
    await owen_brA.topbar.clickLogout();
    await mons_brA.complex.loginWithPasswordViaTopbar(mons);
  });
  it(`Mons likes cream. He goes to the buy-cream topic`, async () => {
    await mons_brA.go2(buyCreamPagePath);
  });

  it(`... assigns the buy-cream topic to Maria`, async () => {
    await mons_brA.topic.openAssignToDiag();
    await mons_brA.addUsersToPageDialog.addOneUser(maria.username);
    await mons_brA.addUsersToPageDialog.submit();
  });

  it(`... Maria reloads, sees two tasks in her task list`, async () => {
    await maria_brB.refresh2();
    await maria_brB.userProfilePage.activity.posts.waitForPostTextsVisible();
    await maria_brB.userProfilePage.activity.posts.assertExactly(2);
  });
  it(`... namely buy-cream, assigned to her`, async () => {
    assert.deepEq(await maria_brB.userProfilePage.activity.posts.getAssigneeUsernamesNoAt({
            forPageId: 'buyCreamPageId' }), [maria.username]);
  });
  it(`... and buy-mikl, assigned to her and Michael`, async () => {
    assert.deepEq(await maria_brB.userProfilePage.activity.posts.getAssigneeUsernamesNoAt({
            forPageId: 'buyMilkPageId' }), [maria.username, michael.username]);
  });



  it(`Maria buys cream. Unimplemented`, async () => {
    // How do this? Could websearch for Milk-as-a-Service, but would there be
    // any free price plans?
  });

  it(`Maria ... or no, Mons? marks the buy-cream task (i.e. the page) as done`, async () => {
    await mons_brA.topic.setDoingStatus('Done');
  });

  it(`It disappears from Maria's task list`, async () => {
    await maria_brB.refresh2();
    await maria_brB.userProfilePage.activity.posts.waitForPostTextsVisible();
    await maria_brB.userProfilePage.activity.posts.assertExactly(1);
  });

  it(`... but if she ticks the Include-closed checkbox ...`, async () => {
    await maria_brB.userProfilePage.tasks.setIncludeClosed(true);
  });

  it(`... it is shown again`, async () => {
    await maria_brB.userProfilePage.activity.posts.assertExactly(2);
    assert.deepEq(await maria_brB.userProfilePage.activity.posts.getAssigneeUsernamesNoAt({
            forPageId: 'buyCreamPageId' }), [maria.username]);
  });
  it(`... it's status is Done (and done topics, are implicitly closed)  UNIMPL  TESTS_MISSING`, async () => {
    // Should break out show-title code, and resue in the profile page posts,
    // so titles shown as done/closed/etc,  before can add this test?
  });
  it(`The other task — buy milk — is there too`, async () => {
    assert.deepEq(await maria_brB.userProfilePage.activity.posts.getAssigneeUsernamesNoAt({
            forPageId: 'buyMilkPageId' }), [maria.username, michael.username]);
  });

  it(`... she un-ticks Include-closed — and it get hidden`, async () => {
    await maria_brB.userProfilePage.tasks.setIncludeClosed(false);
    await maria_brB.userProfilePage.activity.posts.assertExactly(1);
  });
  it(`... the buy-milk task is still listed`, async () => {
    assert.deepEq(await maria_brB.userProfilePage.activity.posts.getAssigneeUsernamesNoAt({
            forPageId: 'buyMilkPageId' }), [maria.username, michael.username]);
  });

  it(`Mons says "Cream is better", and closes the milk topic`, async () => {
    await mons_brA.go2(buyMilkPagePath);
    await mons_brA.topic.closeTopic();
  });

  it(`Maria reloads her task list page`, async () => {
    await maria_brB.refresh2();
  });
  it(`... all tasks are gone: done or closed`, async () => {
    await maria_brB.userProfilePage.activity.posts.waitForNoPosts();
  });
});

