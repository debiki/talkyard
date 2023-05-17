/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let alice: Member;
let modya: Member;
let mons: Member;
let mons_brB: TyE2eTestBrowser;
let corax: Member;
let corax_brB: TyE2eTestBrowser;
let trillian: Member;
let trillian_brB: TyE2eTestBrowser;
let maja: Member;
let mei: Member;
let memah: Member;
let stranger_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;

let numEmailsTotal = 0;

let coraxPubPrivPagePath = '/corax-pub-priv-page';
let alicesPubPrivPagePath = '/alices-pub-priv-page';
let privatePagePath = '/priv-page';



describe(`assign-can-see.2br.d  TyTASSIGNCANSEE`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Assign-To Can See or Not E2E Test",
      members: ['owen', 'alice', 'mons', 'modya', 'corax', 'trillian', 'maja', 'mei', 'memah']
    });

    builder.addPage({
      id: 'coraxPubThenPrivPageId',
      folder: '/',
      showId: false,
      slug: coraxPubPrivPagePath.substring(1),
      role: c.TestPageRole.Idea,
      title: "Corax_Task_Title Public then Private",
      body: "This is Corax_task, starts public, but is moved to the Staff-Only category.",
      categoryId: forum.categories.catA.id,
      authorId: forum.members.corax.id,
    });

    builder.addPage({
      id: 'alicesPubThenPrivPageId',
      folder: '/',
      showId: false,
      slug: alicesPubPrivPagePath.substring(1),
      role: c.TestPageRole.Idea,
      title: "Alices_Task_Title Public then Private",
      body: "This is Alices_task, also starts public, but is moved to the Staff-Only category.",
      categoryId: forum.categories.catA.id,
      authorId: forum.members.alice.id,
    });

    builder.addPage({
      id: 'privatePageId',
      folder: '/',
      showId: false,
      slug: privatePagePath.substring(1),
      role: c.TestPageRole.Discussion,
      title: "Starts_Private_Title",
      body: "This task starts_private.",
      categoryId: forum.categories.staffCat.id,
      authorId: forum.members.maja.id,
    });

    // Disable notifications, or notf email counts will be off
    // (since Owen would get emails).
    builder.settings({
      numFirstPostsToApprove: 0,
      numFirstPostsToReview: 0,
    });
    builder.getSite().pageNotfPrefs = [{
      memberId: forum.members.owen.id,
      notfLevel: c.TestPageNotfLevel.Muted,
      wholeSite: true,
    }, {
      // Corax never wants emails, he checks the forum directly, regularly, instead.
      memberId: forum.members.corax.id,
      notfLevel: c.TestPageNotfLevel.Muted,
      wholeSite: true,
    }, {
      // But Mei wants notifications about the whole site.
      // (So we can test notifications about others getting assigned.)
      memberId: forum.members.mei.id,
      notfLevel: c.TestPageNotfLevel.EveryPost,
      wholeSite: true,
    }, {
      // Moderator Modya and ordinary member Memah subscribe to Alice's page. 
      memberId: forum.members.modya.id,
      notfLevel: c.TestPageNotfLevel.EveryPost,
      pageId: 'alicesPubThenPrivPageId',
    }, {
      memberId: forum.members.memah.id,
      notfLevel: c.TestPageNotfLevel.EveryPost,
      pageId: 'alicesPubThenPrivPageId',
    }];

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    alice = forum.members.alice;
    modya = forum.members.modya;
    mons = forum.members.mons;
    mons_brB = brB;
    corax = forum.members.corax;
    corax_brB = brB;
    trillian = forum.members.trillian;
    trillian_brB = brB;
    maja = forum.members.maja;
    mei = forum.members.mei;
    memah = forum.members.memah;
    stranger_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    await server.skipRateLimits(site.id);
  });


  it(`Corax logs in to see his task list`, async () => {
    await corax_brB.userProfilePage.tasks.goHere(corax.username, { origin: site.origin });
    await corax_brB.complex.loginWithPasswordViaTopbar(corax);
  });
  it(`... it's empty`, async () => {
    await corax_brB.userProfilePage.activity.posts.waitForNoPosts();
  });


  // ----- (Assign Corax)

  it(`Owen goes to Corax topic, logs in ... `, async () => {
    await owen_brA.go2(site.origin + coraxPubPrivPagePath);
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });
  it(`... assigns it to Croax`, async () => {
    await owen_brA.topic.openAssignToDiag();
    await owen_brA.addUsersToPageDialog.addOneUser(corax.username);
    await owen_brA.addUsersToPageDialog.submit();
    numEmailsTotal += 1;  // to Mei (subscribed to the whole site. Corax has muted notfs)
  });
  it(`... sees Corax listed as assignee`, async () => {
    await owen_brA.topic.waitForAssigneesUsernamesNoAt(c.BodyNr, [corax.username]);
  });


  // ----- Can mute notfs

  it(`Mei gets notified — she has subscribed to everything`, async () => {
    await server.waitUntilLastEmailMatches(site.id,
          mei.emailAddress, [corax.username, ' assigned by ', owen.username,
          'Corax_Task_Title', '/-coraxPubThenPrivPageId' ]);
  });
  it(`But not Corax — he has muted notifications  TyTMUTEASGNOTFS`, async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(site.id);
    assert.eq(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });


  // ----- (Assign Alice)

  it(`Owen goes to Admin Alice's topic`, async () => {
    await owen_brA.go2(alicesPubPrivPagePath);
  });
  it(`... assigns it to Alice`, async () => {
    await owen_brA.topic.openAssignToDiag();
    await owen_brA.addUsersToPageDialog.addOneUser(alice.username);
    await owen_brA.addUsersToPageDialog.submit();
    // Here .Mei_gets_notified about Alices page, but not later, when it's private.
    numEmailsTotal += 4; // to Alice, Mei (subscribed to site), Modya & Memah (subscr topic)
  });
  it(`... sees Alice listed as assignee`, async () => {
    await owen_brA.topic.waitForAssigneesUsernamesNoAt(c.BodyNr, [alice.username]);
  });


  // ----- Subscribers notified

  it(`Alice gets a notification email (since she got assigned)`, async () => {
    await server.waitUntilLastEmailMatches(site.id,
          alice.emailAddress, ['You', ' assigned by ', owen.username,
          'Alices_Task_Title', 'alicesPubThenPrivPageId' ]);
  });

  it(`Mei gets notified too — she has subscribed to everything`, async () => {
    await server.waitUntilLastEmailMatches(site.id,
          mei.emailAddress, [alice.username, ' assigned by ', owen.username,
          'Alices_Task_Title', 'alicesPubThenPrivPageId' ]);
  });
  it(`Modya and Memah too — they've subscribed to Alice's page`, async () => {
    await server.waitUntilLastEmailMatches(site.id,
          modya.emailAddress, [alice.username, ' assigned by ', owen.username,
          'Alices_Task_Title', 'alicesPubThenPrivPageId' ]);
    await server.waitUntilLastEmailMatches(site.id,
          memah.emailAddress, [alice.username, ' assigned by ', owen.username,
          'Alices_Task_Title', 'alicesPubThenPrivPageId' ]);
  });

  it(`No other emails (Alice gets just one, although is also page auhtor)`, async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(site.id);
    assert.eq(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });



  // ----- ttt: Corax sees his task

  // Verify that Corax sees the task he's been assigned — so, when later he can't
  // see it, we know that he could, before (that there's no bug making it never show).

  it(`Corax reloads his task list`, async () => {
    await corax_brB.refresh2();
  });
  it(`... sees the task Owen just gave him`, async () => {
    // (userProfilePage.activity.posts will later be its own page object. [post_list_e2e_obj])
    await corax_brB.userProfilePage.activity.posts.waitForPostTextsVisible(/Corax_task/);
    await corax_brB.userProfilePage.activity.posts.assertExactly(1);
  });
  it(`... it's assigned to him (Corax)`, async () => {
    assert.deepEq(await corax_brB.userProfilePage.activity.posts.getAssigneeUsernamesNoAt({
            forPageId: 'coraxPubThenPrivPageId' }), [corax.username]);
  });


  // ----- Core members can see others' tasks

  // .Trusted_can_see too, tested further below.

  it(`Corax looks at Alice's task list`, async () => {
    await corax_brB.userProfilePage.tasks.goHere(alice.username);
  });
  it(`... sees Alice's task`, async () => {
    await corax_brB.userProfilePage.activity.posts.waitForPostTextsVisible(/Alices_task/);
    await corax_brB.userProfilePage.activity.posts.assertExactly(1);
  });
  it(`... it's assigned to Alice`, async () => {
    assert.deepEq(await corax_brB.userProfilePage.activity.posts.getAssigneeUsernamesNoAt({
            forPageId: 'alicesPubThenPrivPageId' }), [alice.username]);
  });


  // ----- (Move tasks to Staff-Only)

  it(`Owen moves Alice's task to the Staff-Only cat  (Corax then won't see it)`, async () => {
    assert.eq(await owen_brA.urlPath(), alicesPubPrivPagePath);
    await owen_brA.topic.movePageToOtherCategory(forum.categories.staffCat.name);
  });
  it(`... and moves Corax' task too  (Corax won't see it, althoug it's his)`, async () => {
    await owen_brA.go2(coraxPubPrivPagePath);
    await owen_brA.topic.movePageToOtherCategory(forum.categories.staffCat.name);
  });


  // ----- Can't see task, if can't see page  (Corax)

  it(`Corax reloads Alice's task list`, async () => {
    await corax_brB.refresh2();
  });
  it(`... it's empty — the task got moved to Staff-Only, but Corax isn't staff`, async () => {
    await corax_brB.userProfilePage.activity.posts.waitForNoPosts();
  });

  it(`Corax goes to his own task list`, async () => {
    await corax_brB.userProfilePage.tasks.goHere(corax.username);
  });
  it(`... it's empty too — his own task got moved to a category he can't see`, async () => {
    await corax_brB.userProfilePage.activity.posts.waitForNoPosts();
  });


  // ----- Can't assign someone who can't see the task  (Corax can't)

  it(`Owen goes to the already staff-only page`, async () => {
    await owen_brA.go2(site.origin + privatePagePath);
  });
  it(`... opens the Assign-To dialog`, async () => {
    await owen_brA.topic.openAssignToDiag();
  });
  it(`... adds Corax`, async () => {
    await owen_brA.addUsersToPageDialog.addOneUser(corax.username);
  });
  it(`... submits`, async () => {
    await owen_brA.addUsersToPageDialog.submit();
    numEmailsTotal += 0;
  });
  it(`... there's an error — Corax cannot see this page. So cannot assign him`, async () => {
    await owen_brA.serverErrorDialog.waitAndAssertTextMatches(
            /@Corax cannot access .+TyERELPAT0SEEPOST_/);
    await owen_brA.serverErrorDialog.close();
  });


  // ----- But can assign sbd who can see  (Mons, is moderator)

  it(`Owen assigns Alice instead — she is staff, can see the page`, async () => {
    // The Change dialog is already open, so only need to click the assign button.
    await owen_brA.waitAndClick('.e_AsgB');
    await owen_brA.addUsersToPageDialog.addOneUser(alice.username);
  });
  it(`... submits, now works fine`, async () => {
    await owen_brA.addUsersToPageDialog.submit();
    numEmailsTotal += 1; // to Alice
  });
  it(`... Owen sees Alice listed as assignee`, async () => {
    await owen_brA.topic.waitForAssigneesUsernamesNoAt(c.BodyNr, [alice.username]);
  });


  // ----- No un/assigned notfs if can't see task

  it(`Alice gets a notification email (since she got assigned)`, async () => {
    await server.waitUntilLastEmailMatches(site.id,
          alice.emailAddress, ['You', ' assigned by ', owen.username, 'Starts_Private_Title',
          'privatePageId' ]);
  });
  it(`... but not Mei and Maja, although subscribed & author — they cannot see the page`,
        async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(site.id);
    assert.eq(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });


  // ----- No un/assigned notfs if can't see task  (more tests)

  it(`Owen assigns Mons to Alice's page. Goes to the page`, async () => {
    await owen_brA.go2(site.origin + alicesPubPrivPagePath);
  });
  it(`... opens the Assign-To dialog`, async () => {
    await owen_brA.topic.openAssignToDiag();
  });
  it(`... adds Mons`, async () => {
    await owen_brA.addUsersToPageDialog.addOneUser(mons.username);
  });
  it(`... submits`, async () => {
    await owen_brA.addUsersToPageDialog.submit();
    numEmailsTotal += 3;  // Alice, Mons, Modya.
    // But not Mei & Memah. They're subscribed to the whole site, and Alice's page
    // — but they can't see that page (it's private, now).
  });

  it(`Mons gets notified — he got assigned`, async () => {
    await server.waitUntilLastEmailMatches(site.id,
          mons.emailAddress, ['You', ' assigned by ', owen.username,
          'Alices_Task_Title', 'alicesPubThenPrivPageId' ]);
  });
  it(`Alice gets notified — she's the page author`, async () => {
    // Both Alice and Mons are assigned — Alice was already.
    await server.waitUntilLastEmailMatches(site.id,
          alice.emailAddress, [mons.username, alice.username, ' assigned by ', owen.username,
          'Alices_Task_Title', 'alicesPubThenPrivPageId' ]);
  });
  it(`Modya notified too — she has subscribed to Alice's page`, async () => {
    await server.waitUntilLastEmailMatches(site.id,
          modya.emailAddress, [mons.username, alice.username, ' assigned by ', owen.username,
          'Alices_Task_Title', 'alicesPubThenPrivPageId' ]);
  });

  it(`Alice gets just one notf, although is both page author and assigned.
          Mei and Memah gets none; they can't see the page (staff-only)`, async () => {
    // Above .Mei_gets_notified about Alices page, but not here — now it's private.
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(site.id);
    assert.eq(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });


  // ----- Corax still can't see (bit redundant test)

  it(`Corax goes to Alice's task list`, async () => {
    await corax_brB.userProfilePage.tasks.goHere(alice.username);
  });
  it(`... he still can't see Alice's tasks — the list is empty`, async () => {
    await corax_brB.userProfilePage.activity.posts.waitForNoPosts();
  });

  it(`Corax leaves`, async () => {
    await corax_brB.topbar.clickLogout();
  });

  it(`Strangers can't see Alice's tasks list at all`, async () => {
    await stranger_brB.userProfilePage.waitForBadRoute();
  });


  // ----- Moderators can see Staff-Only tasks

  it(`Moderator Mons arrives`, async () => {
    await mons_brB.complex.loginWithPasswordViaTopbar(mons);
  });
  it(`Mons sees Alice's tasks — he can access the Staff-Only category`, async () => {
    await mons_brB.userProfilePage.activity.posts.waitForPostTextsVisible(/starts_private/);
    await mons_brB.userProfilePage.activity.posts.assertExactly(2);
  });
  it(`... they're assigned to Alice and him`, async () => {
    assert.deepEq(await mons_brB.userProfilePage.activity.posts.getAssigneeUsernamesNoAt({
            forPageId: 'alicesPubThenPrivPageId' }), [alice.username, mons.username]);
  });
  it(`... and to Alice only`, async () => {
    assert.deepEq(await mons_brB.userProfilePage.activity.posts.getAssigneeUsernamesNoAt({
            forPageId: 'privatePageId' }), [alice.username]);
  });


  // ----- Others can't see tasks, if can't see cat

  it(`Trillian arrives`, async () => {
    await mons_brB.topbar.clickLogout();
    await trillian_brB.complex.loginWithPasswordViaTopbar(trillian);
  });
  it(`... she can't see any of Alices' tasks — they're in the Staff-Only cat`, async () => {
    await trillian_brB.userProfilePage.activity.posts.waitForNoPosts();
  });


  // ----- Tasks become visible, if moved to publ cat.  &  .Trusted_can_see tasks

  it(`Owen moves the private task to a public category`, async () => {
    await owen_brA.go2(privatePagePath);
    await owen_brA.topic.movePageToOtherCategory(forum.categories.catA.name);
  });

  it(`Trillian can now see that task (but not Alice's other task, still private)`, async () => {
    await trillian_brB.refresh2();
    await trillian_brB.userProfilePage.activity.posts.waitForPostTextsVisible(/starts_private/);
    await trillian_brB.userProfilePage.activity.posts.assertExactly(1);
  });

  // Maybe good to test moving sth to private cat, and moving it back to a publ cat:
  it(`Owen moves Alice's other task back to the publ cat, too`, async () => {
    await owen_brA.go2(alicesPubPrivPagePath);
    await owen_brA.topic.movePageToOtherCategory(forum.categories.catA.name);
  });

  it(`Trillian now sees both tasks`, async () => {
    await trillian_brB.refresh2();
    await trillian_brB.userProfilePage.activity.posts.waitForPostTextsVisible(/starts_private/);

    // TESTS_MISSING: This won't work, finds the text in the first post instead (and fails).
    // Need to [match_specific_post]?
    // await trillian_brB.userProfilePage.activity.posts.waitForPostTextsVisible(/Alices_task/);

    // But at least this works:
    await trillian_brB.userProfilePage.activity.posts.assertExactly(2);
  });


  // ----- Everyone gets emails as usual

  // Now when the page is public again.

  it(`Owen assigns Corax to Alice's page (in addition to Alice and Mons). Opens the dialog ...`,
        async () => {
    assert.eq(await owen_brA.urlPath(), alicesPubPrivPagePath);
    await owen_brA.topic.openAssignToDiag();
  });
  it(`... adds Corax`, async () => {
    await owen_brA.addUsersToPageDialog.addOneUser(corax.username);
  });
  it(`... submits`, async () => {
    await owen_brA.addUsersToPageDialog.submit();
    numEmailsTotal += 4;  // Alice (her page), Corax (assigned), Mei & Mema (subscribed)

    // UX COULD: Hmm, should Mons get a notf too? He's assigned to the page,
    // and would want to know that now another person too is assigned?
    // So rare, can wait. Usually just 1 assignee. [notf_assignees_about_another]
  });
  it(`... now there are 3 assignees: Alice, Mons, Corax`, async () => {
    await owen_brA.topic.waitForAssigneesUsernamesNoAt(c.BodyNr,
            [alice.username, mons.username, corax.username]);
  });

  it(`Alice gets a notification email — she's the author`, async () => {
    await server.waitUntilLastEmailMatches(site.id,
          alice.emailAddress, [corax.username, ' assigned by ', owen.username,
          'Alices_Task_Title', 'alicesPubThenPrivPageId' ]);
  });

  it(`Mei gets notified too, about Corax — she's subscribed to everything`, async () => {
    await server.waitUntilLastEmailMatches(site.id,
          mei.emailAddress, [corax.username, ' assigned by ', owen.username,
          'Alices_Task_Title', 'alicesPubThenPrivPageId' ]);
  });
  it(`Modya and Memah too, about Corax — they're subscribed to Alice's page`, async () => {
    await server.waitUntilLastEmailMatches(site.id,
          modya.emailAddress, [corax.username, ' assigned by ', owen.username,
          'Alices_Task_Title', 'alicesPubThenPrivPageId' ]);
    await server.waitUntilLastEmailMatches(site.id,
          memah.emailAddress, [corax.username, ' assigned by ', owen.username,
          'Alices_Task_Title', 'alicesPubThenPrivPageId' ]);
  });

  it(`No other emails got sent`, async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(site.id);
    assert.eq(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });

});

