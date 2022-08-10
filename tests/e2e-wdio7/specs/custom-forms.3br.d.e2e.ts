/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import * as make from '../utils/make';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';

//import { TyE2eTestBrowser, TyAllE2eTestBrowsers, MemberBrowser } from '../utils/pages-for';

let everyone: TyAllE2eTestBrowsers;
let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let brC: TyE2eTestBrowser;

var owen; //: MemberBrowser;
var mons; //: MemberBrowser;
var maria; //: MemberBrowser;
var strangerA;
var strangerB;
var guest;

var idAddress;
var forumTitle = "Custom Form Forum";
var formPageUrl;
var formPageTitle = "Custom Form Name";
var formPageIntroText = "Fill in the form please.";

var textInputId = 'textInputId';
var textInputName = 'textInputName';
var emailInputId = 'emailInputId';
var emailInputName = 'emailInputName';
var numberInputId = 'numberInputId';
var numberInputName = 'numberInputName';
var textareaId = 'textareaId';
var textareaName = 'textareaName';


var formPageBody = `
${formPageIntroText}

<form>
  <input name="doWhat" value="SubmitToThisPage">

  <label for="${textInputId}">textInputName:</label>
  <input id="${textInputId}" name="${textInputName}" type="text">

  <input id="submit" type="submit" value="Submit">
</form>
`;


var formPageBody2 = `
${formPageIntroText}

<form>
  <input name="doWhat" value="SubmitToThisPage">

  <label for="${textInputId}">textInputName:</label>
  <input id="${textInputId}" name="${textInputName}" type="text">

  <label for="${emailInputId}">emailInputName:</label>
  <input id="${emailInputId}" name="${emailInputName}" type="email">

  <label for="${numberInputId}">numberInputName:</label>
  <input id="${numberInputId}" name="${numberInputName}" type="number">

  <label for="${textareaId}">textareaName:</label>
  <input id="${textareaId}" name="${textareaName}">

  <input type="button" name="should-be-ignored" value="Dummy button">

  <input id="submit" type="submit" value="Submit">
</form>
`;

let strangerAInputText1 = "Stranger A text input 1";
let strangerBInputText1 = "Stranger B text input 1";
let monsInputText1 = "Mons text input 1";
let mariaInputText1 = "Maria text input 1";

describe(`custom-forms.3br.d  TyTCUSTFORMS`, () => {

  it("initialize people", async () => {
    everyone = new TyE2eTestBrowser(allWdioBrowsers, 'brAll');
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');
    brC = new TyE2eTestBrowser(wdioBrowserC, 'brC');

    owen = _.assign(brA, make.memberOwenOwner());
    mons = _.assign(brB, make.memberModeratorMons());
    maria = _.assign(brC, make.memberMaria());
    // Let's reuse the same browser.
    strangerA = mons;
    strangerB = maria;
    guest = maria;
  });

  it("import a site", async () => {
    var site: SiteData = make.forumOwnedByOwen('custom-forms', { title: forumTitle });
    site.settings.allowGuestLogin = true;
    site.settings.requireVerifiedEmail = false;
    site.settings.mayPostBeforeEmailVerified = true;
    site.members.push(make.memberModeratorMons());
    site.members.push(make.memberMaria());
    idAddress = await server.importSiteData(site);
  });

  it("Owen creates a custom form", async () => {
    await owen.go2(idAddress.origin);
    await owen.assertPageTitleMatches(forumTitle);
    await owen.complex.loginWithPasswordViaTopbar(owen); // as Member);
    await owen.complex.createAndSaveTopic(
        { title: formPageTitle, body: formPageBody, type: c.TestPageRole.Form,
          bodyMatchAfter: false });
    formPageUrl = await owen.getUrl();
  });

  it("Everyone goes to the form page", async () => {
    await everyone.go2(formPageUrl);
    await owen.assertPageTitleMatches(formPageTitle);
    await mons.assertPageTitleMatches(formPageTitle);
    await maria.assertPageTitleMatches(formPageTitle);
    await owen.assertPageBodyMatches(formPageIntroText);
    await mons.assertPageBodyMatches(formPageIntroText);
    await maria.assertPageBodyMatches(formPageIntroText);
    //await everyone.assertPageBodyMatches(formPageIntroText);
  });

  it("Stranger A fills it in and sumbits", async () => {
    await strangerA.waitAndSetValueForId(textInputId, strangerAInputText1);
    await strangerA.customForm.submit();
  });

  it("... doesn't see his/her submitted form data", async () => {
    // Shouldn't have been sent by Websocket:
    await strangerA.customForm.assertNumSubmissionVisible(0);
    // Shouldn't appear after reload:
    await strangerA.refresh2();
    await strangerA.customForm.assertNumSubmissionVisible(0);
  });

  it("Stranger B doesn't see A's submitted data", async () => {
    // Shouldn't have been sent by Websocket:
    await strangerB.customForm.assertNumSubmissionVisible(0);
    // Shouldn't appear after reload:
    await strangerB.refresh2();
    await strangerB.customForm.assertNumSubmissionVisible(0);
  });

  it("Stranger B fills in and submits", async () => {
    await strangerB.waitAndSetValueForId(textInputId, strangerBInputText1);
    await strangerB.customForm.submit();
  });

  it("Stranger A and B doesn't see any submission", async () => {
    await strangerA.refresh2();
    await strangerA.customForm.assertNumSubmissionVisible(0);
    await strangerA.topic.assertNoReplyMatches(strangerAInputText1);
    await strangerA.topic.assertNoReplyMatches(strangerBInputText1);
    await strangerA.assertPageHtmlSourceDoesNotMatch(strangerAInputText1);
    await strangerA.assertPageHtmlSourceDoesNotMatch(strangerBInputText1);
    await strangerB.refresh2();
    await strangerB.customForm.assertNumSubmissionVisible(0);
    await strangerB.topic.assertNoReplyMatches(strangerAInputText1);
    await strangerB.topic.assertNoReplyMatches(strangerBInputText1);
    await strangerB.assertPageHtmlSourceDoesNotMatch(strangerAInputText1);
    await strangerB.assertPageHtmlSourceDoesNotMatch(strangerBInputText1);
  });

  it("Owen (who is admin) sees A and B's submissions", async () => {
    await owen.customForm.assertNumSubmissionVisible(2);
    await owen.topic.assertSomeReplyMatches(strangerAInputText1);
    await owen.topic.assertSomeReplyMatches(strangerBInputText1);
  });

  it("... they were submitted by the Unknown user, not by a missing user", async () => {
    await owen.topic.assertSomeReplyMatches("Unknown");
    await owen.topic.assertNoReplyMatches("missing");
    await owen.topic.assertNoAuthorMissing();
  });

  it("Mons logs in (in stranger A's browser)", async () => {
    assert.refEq(mons, strangerA);
    await mons.complex.loginWithPasswordViaTopbar(mons);
  });

  it("... he is moderator, not admin, so doesn't see any submitted forms", async () => {
    await mons.customForm.assertNumSubmissionVisible(0);
  });

  it("... he submits a form, sees 'Thank you'", async () => {
    await mons.waitAndSetValueForId(textInputId, monsInputText1);
    await mons.customForm.submit();
    await mons.customForm.assertNumSubmissionVisible(0);
  });

  it("Stranger B doesn't see Mons' form", async () => {
    await strangerB.refresh2();
    await strangerB.customForm.assertNumSubmissionVisible(0);
  });

  it("Maria logs in (in stranger B's browser)", async () => {
    assert.refEq(maria, strangerB);
    await maria.complex.loginWithPasswordViaTopbar(maria);
  });

  it("... and sees no submissions", async () => {
    await maria.customForm.assertNumSubmissionVisible(0);
  });

  it("... she submits a form", async () => {
    await maria.waitAndSetValueForId(textInputId, mariaInputText1);
    await maria.customForm.submit();
    await maria.customForm.assertNumSubmissionVisible(0);
  });

  it("Everyone refreshes the page", async () => {
    await everyone.refresh2();
  });

  it("Mons and Maria see no submissions", async () => {
    await mons.customForm.assertNumSubmissionVisible(0);
    await mons.topic.assertNoReplyMatches(strangerAInputText1);
    await mons.topic.assertNoReplyMatches(strangerBInputText1);
    await mons.topic.assertNoReplyMatches(monsInputText1);
    await mons.topic.assertNoReplyMatches(mariaInputText1);
    await maria.customForm.assertNumSubmissionVisible(0);
    await maria.topic.assertNoReplyMatches(strangerAInputText1);
    await maria.topic.assertNoReplyMatches(strangerBInputText1);
    await maria.topic.assertNoReplyMatches(monsInputText1);
    await maria.topic.assertNoReplyMatches(mariaInputText1);
  });

  it("Owen sees all", async () => {
    await owen.customForm.assertNumSubmissionVisible(4);
    await owen.topic.assertSomeReplyMatches(strangerAInputText1);
    await owen.topic.assertSomeReplyMatches(strangerBInputText1);
    await owen.topic.assertSomeReplyMatches(monsInputText1);
    await owen.topic.assertSomeReplyMatches(mariaInputText1);
  });

  it("A guest logs in (in Maria's browser)", async () => {
    assert.refEq(guest, maria);
    await maria.topbar.clickLogout();
    await guest.complex.signUpAsGuestViaTopbar("Guesila")
  });

  it("... and sees no submissions", async () => {
    await guest.refresh2();
    await guest.customForm.assertNumSubmissionVisible(0);
  });

  it("Owen creates a new form on another page", async () => {
    // TESTS_MISSING
  });

  it("... he won't see the submissions from the old form", async () => {
  });

  it("The guest submits something on the new page", async () => {
  });

  it("Owen sees it", async () => {
  });

  it("... but not on the old page (only on the new, where it was submitted)", async () => {
  });

});

