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
let mons: Member;
let mons_brB: TyE2eTestBrowser;
let corax: Member;
let corax_brB: TyE2eTestBrowser;
let trillian: Member;
let trillian_brB: TyE2eTestBrowser;
let maja: Member;
let maja_brB: TyE2eTestBrowser;
let stranger_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;

let coraxPubPrivPagePath = '/corax-pub-priv-page';
let alicesPubPrivPagePath = '/alices-pub-priv-page';
let privatePagePath = '/priv-page';



describe(`assign-can-see.2br.d  TyTASSIGNCANSEE`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Assign-To Can See or Not E2E Test",
      members: ['owen', 'alice', 'mons', 'corax', 'trillian', 'maja']
    });

    builder.addPage({
      id: 'coraxPubThenPrivPageId',
      folder: '/',
      showId: false,
      slug: coraxPubPrivPagePath.substring(1),
      role: c.TestPageRole.Idea,
      title: "Corax Public then Private Task",
      body: "This is Corax_task, starts public, but is moved to the Staff-Only category.",
      categoryId: forum.categories.catA.id,
      authorId: forum.members.maja.id,
    });

    builder.addPage({
      id: 'alicesPubThenPrivPageId',
      folder: '/',
      showId: false,
      slug: alicesPubPrivPagePath.substring(1),
      role: c.TestPageRole.Idea,
      title: "Alice's Public then Private Task",
      body: "This is Alices_task, also starts public, but is moved to the Staff-Only category.",
      categoryId: forum.categories.catA.id,
      authorId: forum.members.maja.id,
    });

    builder.addPage({
      id: 'privatePageId',
      folder: '/',
      showId: false,
      slug: privatePagePath.substring(1),
      role: c.TestPageRole.Discussion,
      title: "Private Task",
      body: "This is the Starts_Private task.",
      categoryId: forum.categories.staffCat.id,
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

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    alice = forum.members.alice;
    mons = forum.members.mons;
    mons_brB = brB;
    corax = forum.members.corax;
    corax_brB = brB;
    trillian = forum.members.trillian;
    trillian_brB = brB;
    maja = forum.members.maja;
    maja_brB = brB;
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

  // ----- Owen assigns tasks

  it(`Owen goes to Corax topic, logs in ... `, async () => {
    await owen_brA.go2(site.origin + coraxPubPrivPagePath);
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });
  it(`... assigns it to Croax`, async () => {
    await owen_brA.topic.openAssignToDiag();
    await owen_brA.addUsersToPageDialog.addOneUser(corax.username);
    await owen_brA.addUsersToPageDialog.submit();
  });
  it(`... sees Corax listed as assignee`, async () => {
    assert.deepEq(await owen_brA.topic.getAssigneesUsernamesNoAt(c.BodyNr), [corax.username]);
  });


  it(`Owen goes to Admin Alice's topic`, async () => {
    await owen_brA.go2(alicesPubPrivPagePath);
  });
  it(`... assigns it to Alice`, async () => {
    await owen_brA.topic.openAssignToDiag();
    await owen_brA.addUsersToPageDialog.addOneUser(alice.username);
    await owen_brA.addUsersToPageDialog.submit();
  });
  it(`... sees Alice listed as assignee`, async () => {
    assert.deepEq(await owen_brA.topic.getAssigneesUsernamesNoAt(c.BodyNr), [alice.username]);
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

  // Trusted members can too, tested further below.

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


  // ----- Move tasks to Staff-Only

  it(`Owen moves Alice's task to the Staff-Only cat  (Corax then won't see it)`, async () => {
    assert.eq(await owen_brA.urlPath(), alicesPubPrivPagePath);
    await owen_brA.topic.movePageToOtherCategory(forum.categories.staffCat.name);
  });
  it(`... and moves Corax' task too  (Corax won't see it, althoug it's his)`, async () => {
    await owen_brA.go2(coraxPubPrivPagePath);
    await owen_brA.topic.movePageToOtherCategory(forum.categories.staffCat.name);
  });


  // ----- Corax now can't see assignees

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


  // ----- Can't assign someone who can't see the task

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
  });
  it(`... there's an error — Corax cannot see this page. So cannot assign him`, async () => {
    await owen_brA.serverErrorDialog.waitAndAssertTextMatches(
            /@Corax cannot access .+TyERELPAT0SEEPOST_/);
    await owen_brA.serverErrorDialog.close();
  });

  it(`Owen assigns Alice instead, and Mons — they're staff, can see the page`, async () => {
    // The Change dialog is already open, so only need to click the assign button.
    await owen_brA.waitAndClick('.e_AsgB');
    await owen_brA.addUsersToPageDialog.addOneUser(alice.username);
    await owen_brA.addUsersToPageDialog.addOneUser(mons.username);
  });
  it(`... submits, now works fine`, async () => {
    await owen_brA.addUsersToPageDialog.submit();
  });
  it(`... Owen sees Alice and Mons listed as assignees`, async () => {
    assert.deepEq(await owen_brA.topic.getAssigneesUsernamesNoAt(c.BodyNr),
            [alice.username, mons.username]);
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
    await mons_brB.userProfilePage.activity.posts.waitForPostTextsVisible(/Starts_Private/);
    await mons_brB.userProfilePage.activity.posts.assertExactly(2);
  });
  it(`... they're assigned to Alice`, async () => {
    assert.deepEq(await mons_brB.userProfilePage.activity.posts.getAssigneeUsernamesNoAt({
            forPageId: 'alicesPubThenPrivPageId' }), [alice.username]);
  });
  it(`... and to Alice and him (Mons)`, async () => {
    assert.deepEq(await mons_brB.userProfilePage.activity.posts.getAssigneeUsernamesNoAt({
            forPageId: 'privatePageId' }), [alice.username, mons.username]);
  });


  // ----- Others can't see tasks, if can't see cat

  it(`Trillian arrives`, async () => {
    await mons_brB.topbar.clickLogout();
    await trillian_brB.complex.loginWithPasswordViaTopbar(trillian);
  });
  it(`... she can't see any of Alices' tasks — they're in the Staff-Only cat`, async () => {
    await trillian_brB.userProfilePage.activity.posts.waitForNoPosts();
  });


  // ----- Can't see own tasks, if can't see cat
  /*
  TESTS_MISSING, can impl right now, only trusted members can see others tasks, for now.
  it(`Maja arrives — she created the tasks`, async () => {
    await mons_brB.topbar.clickLogout();
    await maja_brB.complex.loginWithPasswordViaTopbar(maja);
  });
  */

  // ----- Tasks become visible, if moved to publ cat.  &  Trusted can see tasks

  it(`Owen moves the private task to a public category`, async () => {
    assert.eq(await owen_brA.urlPath(), privatePagePath);
    await owen_brA.topic.movePageToOtherCategory(forum.categories.catA.name);
  });

  it(`Trillian can now see that task (but not Alice's other task, still private)`, async () => {
    await trillian_brB.refresh2();
    await trillian_brB.userProfilePage.activity.posts.waitForPostTextsVisible(/Starts_Private/);
    await trillian_brB.userProfilePage.activity.posts.assertExactly(1);
  });

  // Maybe good to test moving sth to private cat, and moving it back to a publ cat:
  it(`Owen moves Alice's other task back to the publ cat, too`, async () => {
    await owen_brA.go2(alicesPubPrivPagePath);
    await owen_brA.topic.movePageToOtherCategory(forum.categories.catA.name);
  });

  it(`Trillian now sees both tasks`, async () => {
    await trillian_brB.refresh2();
    await trillian_brB.userProfilePage.activity.posts.waitForPostTextsVisible(/Starts_Private/);

    // TESTS_MISSING: This won't work, finds the text in the first post instead (and fails).
    // Need to [match_specific_post]?
    // await trillian_brB.userProfilePage.activity.posts.waitForPostTextsVisible(/Alices_task/);

    // But at least this works:
    await trillian_brB.userProfilePage.activity.posts.assertExactly(2);
  });

});

