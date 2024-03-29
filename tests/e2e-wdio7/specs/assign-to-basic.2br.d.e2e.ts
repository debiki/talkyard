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
let corax: MemberFound;
let corax_brA: TyE2eTestBrowser;
let maja: Member;
let maria: Member;
let maria_brB: TyE2eTestBrowser;
let mei: Member;
let memah: Member;
let memah_brB: TyE2eTestBrowser;
let michael: Member;
let stranger_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;

const buyCreamPagePath = '/buy-cream';
const buyMilkPagePath = '/buy-milk';
const buyMilkPageUrlRegex = /https?:\/\/e2e-test-[^/]+\/-buyMilkPageId#post-1/;



describe(`assign-to-basic.2br.d  TyTASSIGN01`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Assign-To E2E Test",
      members: ['owen', 'mons', 'corax', 'maja', 'maria', 'mei', 'memah', 'michael']
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
    corax = forum.members.corax;
    corax_brA = brA;

    maja = forum.members.maja;
    maria = forum.members.maria;
    maria_brB = brB;
    mei = forum.members.mei;
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
    // There was a bug here: The notification to Memah about having been assigned,
    // got auto-cleared *sometimes* (a race) since she logged in and looked at
    // (read) the page, so this test was flappy.  Now, though, notifications
    // about assignees-changed are no longer auto-cleared.  [0clr_asgd_tagd_notfs]
    await memah_brB.go2(site.origin + buyMilkPagePath);
    await memah_brB.complex.loginWithPasswordViaTopbar(memah);
  });


  // ----- Admins can assign

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
    await owen_brA.topic.waitForAssigneesUsernamesNoAt(c.BodyNr, [memah.username]);
  });


  // ----- Assignees get notified, & others

  let numEmailsTotal = 2;

  it(`Memah gets a notification email (since she got assigned)`, async () => {
    // Incl space ' ' before "assigned", so we know it's not "unassigned".
    await server.waitUntilLastEmailMatches(site.id,
          memah.emailAddress, ['You', ' assigned by ', owen.username, 'Buy milk also',
          buyMilkPageUrlRegex ]);
  });
  it(`Maja also — it's her page, she wants to know`, async () => {
    await server.waitUntilLastEmailMatches(site.id,
          maja.emailAddress, [memah.username, ' assigned by ', owen.username, 'Buy milk also',
          buyMilkPageUrlRegex]);
  });
  it(`No one else gets any email`, async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(site.id);
    assert.eq(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });


  // ----- Task list

  it(`Memah looks at her task list`, async () => {
    await memah_brB.topbar.clickGoToProfile();
    await memah_brB.userProfilePage.tabs.switchToTasks({ wait: false });
  });
  it(`... the topic is listed there`, async () => {
    // (userProfilePage.activity.posts will later be its own page object. [post_list_e2e_obj])
    await memah_brB.userProfilePage.activity.posts.waitForPostTextsVisible(/buy more milk/);
    await memah_brB.userProfilePage.activity.posts.assertExactly(1);
  });
  it(`... assigned to her (Memah)`, async () => {
    assert.deepEq(await memah_brB.userProfilePage.activity.posts.getAssigneeUsernamesNoAt({
            forPageId: 'buyMilkPageId' }), [memah.username]);
  });

  it(`Memah leaves`, async () => {
    await memah_brB.topbar.clickLogout();
  });


  // ----- Strangers can't see one's tasks

  it(`A stranger cannot see Memah's task list  TyTASGNPERMS01`, async () => {
    await stranger_brB.userProfilePage.waitForBadRoute();
  });

  it(`Maria arrives`, async () => {
    await maria_brB.complex.loginWithPasswordViaTopbar(maria);
  });
  it(`Maria can see Memah's task list — by default, members can see others' tasks
                OOOPS NO THEY CANNOT, fix?  Or allow trusted members?`, async () => {
    /*
    await maria_brB.userProfilePage.activity.posts.waitForPostTextsVisible(/buy more milk/);
    await maria_brB.userProfilePage.activity.posts.assertExactly(1);
    assert.deepEq(await maria_brB.userProfilePage.activity.posts.getAssigneeUsernamesNoAt({
            forPageId: 'buyMilkPageId' }), [memah.username]);
    */
  });


  // ----- Change assignees

  it(`Maria goes to the buy-milk page`, async () => {
    await maria_brB.go2(buyMilkPagePath);
  });
  it(`... sees it's assigned to Memah`, async () => {
    await maria_brB.topic.waitForAssigneesUsernamesNoAt(c.BodyNr, [memah.username]);
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
    numEmailsTotal += 4; // Memah removed, Maria & Michael added, Maja author.
  });
  it(`... sees Maria and Michael now listed as assignees`, async () => {
    await owen_brA.topic.waitForAssigneesUsernamesNoAt(c.BodyNr, [maria.username, michael.username]);
  });


  // ----- Notifications about changes

  it(`Memah gets a notification email about no longer being assigned`, async () => {
    await server.waitUntilLastEmailMatches(site.id, memah.emailAddress,
            ['You', 'un-assigned by ', owen.username, ' from ',
            'Buy milk', buyMilkPageUrlRegex]);
  });
  it(`Maria gets a notification about having been assigned`, async () => {
    await server.waitUntilLastEmailMatches(site.id, maria.emailAddress,
            ['You', ' assigned by ', owen.username, ' to ', 'Buy milk', buyMilkPageUrlRegex]);
  });
  it(`Michael too`, async () => {
    await server.waitUntilLastEmailMatches(site.id, michael.emailAddress,
            ['You', ' assigned by ', owen.username, ' to ', 'Buy milk', buyMilkPageUrlRegex]);
  });
  it(`Maja also — it's her page`, async () => {
    await server.waitUntilLastEmailMatches(site.id, maja.emailAddress,
            [maria.username, michael.username,
                    ' assigned by ', owen.username, ' to ', 'Buy milk', buyMilkPageUrlRegex]);
  });

  it(`No one else gets any email`, async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(site.id);
    assert.eq(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });

  it(`Maria reloads the page again ...`, async () => {
    await maria_brB.refresh2();
  });
  it(`... sees it's assigned to her and Michael`, async () => {
    await maria_brB.topic.waitForAssigneesUsernamesNoAt(c.BodyNr, [maria.username, michael.username]);
  });


  // ----- All assignees shown in task list

  // (Not just oneself.)

  it(`Maria looks at her task list`, async () => {
    await maria_brB.topbar.clickGoToProfile();
    await maria_brB.userProfilePage.tabs.switchToTasks({ wait: false });
  });
  it(`... the topic is listed, there`, async () => {
    await maria_brB.userProfilePage.activity.posts.waitForPostTextsVisible(/buy more milk/);
    await maria_brB.userProfilePage.activity.posts.assertExactly(1);
  });
  it(`... assigned to her (Maria) and Michael`, async () => {
    assert.sameElems(await maria_brB.userProfilePage.activity.posts.getAssigneeUsernamesNoAt({
            forPageId: 'buyMilkPageId' }), [maria.username, michael.username]);
  });


  // ----- Admins can se everyone's task lists

  it(`Owen looks at Maria's task list too`, async () => {
    await owen_brA.userProfilePage.tasks.goHere(maria.username);
  });
  it(`... sees the more-milk topic is listed as a task`, async () => {
    await owen_brA.userProfilePage.activity.posts.waitForPostTextsVisible(/buy more milk/);
    await owen_brA.userProfilePage.activity.posts.assertExactly(1);
  });
  it(`... assigned to Maria and Michael`, async () => {
    assert.sameElems(await owen_brA.userProfilePage.activity.posts.getAssigneeUsernamesNoAt({
            forPageId: 'buyMilkPageId' }), [maria.username, michael.username]);
  });


  // ----- Moderators can also see others' task lists

  // And core members & trusted members can too — that's tested in:
  // assign-can-see.2br.d  TyTASSIGNCANSEE

  it(`Owen leaves, moderator Mons arrives`, async () => {
    await owen_brA.topbar.clickLogout();
    await mons_brA.complex.loginWithPasswordViaTopbar(mons);
  });
  it(`Mons too sees the more-milk topic is listed as a task`, async () => {
    await mons_brA.userProfilePage.activity.posts.waitForPostTextsVisible(/buy more milk/);
    await mons_brA.userProfilePage.activity.posts.assertExactly(1);
  });
  it(`... assigned to Maria and Michael`, async () => {
    assert.sameElems(await mons_brA.userProfilePage.activity.posts.getAssigneeUsernamesNoAt({
            forPageId: 'buyMilkPageId' }), [maria.username, michael.username]);
  });


  // ----- Moderators can assign

  it(`Mons likes cream. He goes to the buy-cream topic`, async () => {
    await mons_brA.go2(buyCreamPagePath);
  });

  it(`... assigns the buy-cream topic to himself  TyTASGSELF`, async () => {
    await mons_brA.topic.openAssignToDiag();
    await mons_brA.addUsersToPageDialog.addOneUser(mons.username);
    await mons_brA.addUsersToPageDialog.submit();
    numEmailsTotal += 1; // Maja (page author) not Mons (assigned himself)
  });

  it(`... sees himself listed as assignee`, async () => {
    await mons_brA.topic.waitForAssigneesUsernamesNoAt(c.BodyNr, [mons.username]);
  });


  // ----- No notfs about assigning oneself  TyTASGSELF

  it(`Maja gets notified — it's her page — about Mons assigning himself`, async () => {
    await server.waitUntilLastEmailMatches(site.id, maja.emailAddress,
            [mons.username, ' assigned by ', mons.username, 'Buy cream', 'buyCreamPageId']);
  });

  it(`But Mons got no notf — one isn't notified about assigning oneself`, async () => {
    // (Race — maybe another email was sent just after this. Fine, we
    // check numEmailsTotal again below.)
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(site.id);
    assert.eq(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });


  it(`Mons assigns the buy-cream topic to Maria too`, async () => {
    await mons_brA.topic.openAssignToDiag();
    await mons_brA.addUsersToPageDialog.addOneUser(maria.username);
    await mons_brA.addUsersToPageDialog.submit();
    numEmailsTotal += 2; // Maja (page author) and Maria (assigned)
  });

  it(`... Maria reloads, sees two tasks in her task list`, async () => {
    await maria_brB.refresh2();
    await maria_brB.userProfilePage.activity.posts.waitForPostTextsVisible(/buy cream/);
    await maria_brB.userProfilePage.activity.posts.assertExactly(2);
  });
  it(`... namely buy-cream, assigned to her and Mons`, async () => {
    assert.sameElems(await maria_brB.userProfilePage.activity.posts.getAssigneeUsernamesNoAt({
            forPageId: 'buyCreamPageId' }), [maria.username, mons.username]);
  });
  it(`... and buy-milk, assigned to her and Michael`, async () => {
    assert.sameElems(await maria_brB.userProfilePage.activity.posts.getAssigneeUsernamesNoAt({
            forPageId: 'buyMilkPageId' }), [maria.username, michael.username]);
  });


  // ----- (More notfs tests)

  it(`Maria gets a notf email`, async () => {
    await server.waitUntilLastEmailMatches(site.id, maria.emailAddress,
            ['You', ' assigned by ', mons.username, 'Buy cream', 'buyCreamPageId']);
  });
  it(`Maja also — it's her page`, async () => {
    await server.waitUntilLastEmailMatches(site.id, maja.emailAddress,
            [maria.username, ' assigned by ', mons.username, 'Buy cream', 'buyCreamPageId']);
  });

  it(`But Mons got no notf — one isn't notified if one assigned oneself`, async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(site.id);
    assert.eq(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });


  // ----- Core Members can assign & mark Done

  it(`Mons leaves, Corax arrives`, async () => {
    await mons_brA.topbar.clickLogout();
    await corax_brA.complex.loginWithPasswordViaTopbar(corax);
  });

  it(`Corax, a Core Member, assigns the buy-cream topic to Mei too  TyTCORECAN`, async () => {
    await corax_brA.topic.openAssignToDiag();
    await corax_brA.addUsersToPageDialog.addOneUser(mei.username);
    await corax_brA.addUsersToPageDialog.submit();
    // It's good to be three, when buying cream.
  });

  it(`Corax marks the buy-cream task (i.e. the page) as Done  TyTCORECAN`, async () => {
    await corax_brA.topic.setDoingStatus('Done');
  });

  it(`Assignees can change Doing status: Maria changes back to Doing  UNIMPL TESTS_MISSING`, async () => {
    // And says "I think we should get some more".
  });

  it(`Maria buys even more cream. Unimplemented`, async () => {
    // How do this? Any Milk-as-a-Service?
  });

  it(`... Maria changes to Done  UNIMPL TESTS_MISSING`, async () => {
  });

  it(`The cream task disappears from Maria's task list`, async () => {
    await maria_brB.refresh2();
    await maria_brB.userProfilePage.activity.posts.waitForPostTextsVisible(/buy more milk/);
    await maria_brB.userProfilePage.activity.posts.assertExactly(1);
  });

  it(`... but if she ticks the Include-closed checkbox ...`, async () => {
    await maria_brB.userProfilePage.tasks.setIncludeClosed(true);
  });

  it(`... it appears again, with her as assignee`, async () => {
    await maria_brB.userProfilePage.activity.posts.assertExactly(2);
    assert.sameElems(await maria_brB.userProfilePage.activity.posts.getAssigneeUsernamesNoAt({
            forPageId: 'buyCreamPageId' }), [maria.username, mei.username, mons.username]);
  });
  it(`... it's status is Done (and done topics, are implicitly closed)  UNIMPL  TESTS_MISSING`, async () => {
    // Should break out show-title code, reuse in profile page posts  [same_title_everywhere]
    // so titles shown as done/closed/etc,  before can add this test?
  });
  it(`The other task — buy milk — is there too`, async () => {
    assert.sameElems(await maria_brB.userProfilePage.activity.posts.getAssigneeUsernamesNoAt({
            forPageId: 'buyMilkPageId' }), [maria.username, michael.username]);
  });

  it(`... she un-ticks Include-closed — and buy-cream get hidden`, async () => {
    await maria_brB.userProfilePage.tasks.setIncludeClosed(false);
    await maria_brB.userProfilePage.activity.posts.assertExactly(1);
  });
  it(`... the buy-milk task is still listed`, async () => {
    assert.sameElems(await maria_brB.userProfilePage.activity.posts.getAssigneeUsernamesNoAt({
              forPageId: 'buyMilkPageId' }), [maria.username, michael.username]);
  });

  it(`Corax says "Cream is better", and closes the milk topic  TyTCORECAN`, async () => {
    await corax_brA.go2(buyMilkPagePath);
    await corax_brA.topic.closeTopic();
  });

  it(`Maria reloads her task list page`, async () => {
    await maria_brB.refresh2();
  });
  it(`... all tasks are gone: done or closed`, async () => {
    await maria_brB.userProfilePage.activity.posts.waitForNoPosts();
  });
});

