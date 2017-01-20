/// <reference path="../../../modules/definitely-typed/lodash/lodash.d.ts"/>
/// <reference path="../../../modules/definitely-typed/mocha/mocha.d.ts"/>
/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import server = require('../utils/server');
import utils = require('../utils/utils');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import make = require('../utils/make');
import assert = require('assert');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

declare var browser: any;
declare var browserA: any;
declare var browserB: any;
declare var browserC: any;

var everyone;
var owen;
var mons;
var maria;
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
  <label for="${textInputId}">textInputName:</label>
  <input id="${textInputId}" name="${textInputName}" type="text">

  <input id="submit" type="submit" value="Submit">
</form>
`;


var formPageBody2 = `
${formPageIntroText}

<form>
  <label for="${textInputId}">textInputName:</label>
  <input id="${textInputId}" name="${textInputName}" type="text">

  <label for="${emailInputId}">emailInputName:</label>
  <input id="${emailInputId}" name="${emailInputName}" type="email">

  <label for="${numberInputId}">numberInputName:</label>
  <input id="${numberInputId}" name="${numberInputName}" type="number">

  <label for="${textareaId}">textareaName:</label>
  <input id="${textareaId}" name="${textareaName}">

  <input id="submit" type="submit" value="Submit">
</form>
`;

let strangerAInputText1 = "Stranger A text input 1";
let strangerBInputText1 = "Stranger B text input 1";
let monsInputText1 = "Mons text input 1";
let mariaInputText1 = "Maria text input 1";

describe("private chat", function() {

  it("initialize people", function() {
    browser.perhapsDebugBefore();
    everyone = _.assign(browser, pagesFor(browser));
    owen = _.assign(browserA, pagesFor(browserA), make.memberOwenOwner());
    mons = _.assign(browserB, pagesFor(browserB), make.memberModeratorMons());
    maria = _.assign(browserC, pagesFor(browserC), make.memberMaria());
    // Let's reuse the same browser.
    strangerA = mons;
    strangerB = maria;
    guest = maria;
  });

  it("import a site", function() {
    var site: SiteData = make.forumOwnedByOwen('custom-forms', { title: forumTitle });
    site.settings.allowGuestLogin = true;
    site.members.push(make.memberModeratorMons());
    site.members.push(make.memberMaria());
    idAddress = server.importSiteData(site);
  });

  it("Owen creates a custom form", function() {
    owen.go(idAddress.origin);
    owen.assertPageTitleMatches(forumTitle);
    owen.complex.loginWithPasswordViaTopbar(owen);
    owen.complex.createAndSaveTopic(
        { title: formPageTitle, body: formPageBody, type: c.TestPageRole.Form,
          bodyMatchAfter: false });
    formPageUrl = owen.url().value;
  });

  it("Everyone goes to the form page", function() {
    everyone.go(formPageUrl);
    everyone.assertPageTitleMatches(formPageTitle);
    everyone.assertPageBodyMatches(formPageIntroText);
  });

  it("Stranger A fills it in and sumbits", function() {
    strangerA.waitAndSetValueForId(textInputId, strangerAInputText1);
    strangerA.customForm.submit();
  });

  it("... doesn't see his/her submitted form data", function() {
    // Shouldn't have been sent by Websocket:
    strangerA.customForm.assertNumSubmissionVisible(0);
    // Shouldn't appear after reload:
    strangerA.refresh();
    strangerA.customForm.assertNumSubmissionVisible(0);
  });

  it("Stranger B doesn't see A's submitted data", function() {
    // Shouldn't have been sent by Websocket:
    strangerB.customForm.assertNumSubmissionVisible(0);
    // Shouldn't appear after reload:
    strangerB.refresh();
    strangerB.customForm.assertNumSubmissionVisible(0);
  });

  it("Stranger B fills in and submits", function() {
    // BUG Hangs here forever, test fails. Was working fine, until new Chrome version released.
    strangerB.waitAndSetValueForId(textInputId, strangerBInputText1);
    strangerB.customForm.submit();
  });

  it("Stranger A and B doesn't see any submission", function() {
    strangerA.refresh();
    strangerA.customForm.assertNumSubmissionVisible(0);
    strangerA.replies.assertNoReplyMatches(strangerAInputText1);
    strangerA.replies.assertNoReplyMatches(strangerBInputText1);
    strangerA.assertPageHtmlSourceDoesNotMatch(strangerAInputText1);
    strangerA.assertPageHtmlSourceDoesNotMatch(strangerBInputText1);
    strangerB.refresh();
    strangerB.customForm.assertNumSubmissionVisible(0);
    strangerB.replies.assertNoReplyMatches(strangerAInputText1);
    strangerB.replies.assertNoReplyMatches(strangerBInputText1);
    strangerB.assertPageHtmlSourceDoesNotMatch(strangerAInputText1);
    strangerB.assertPageHtmlSourceDoesNotMatch(strangerBInputText1);
  });

  it("Owen (who is admin) sees A and B's submissions", function() {
    owen.customForm.assertNumSubmissionVisible(2);
    owen.replies.assertSomeReplyMatches(strangerAInputText1);
    owen.replies.assertSomeReplyMatches(strangerBInputText1);
  });

  it("... they were submitted by the Unknown user, not by a missing user", function() {
    owen.replies.assertSomeReplyMatches("Unknown");
    owen.replies.assertNoReplyMatches("missing");
    owen.replies.assertNoAuthorMissing();
  });

  it("Mons logs in (in stranger A's browser)", function() {
    assert(mons === strangerA);
    mons.complex.loginWithPasswordViaTopbar(mons);
  });

  it("... he is moderator, not admin, so doesn't see any submitted forms", function() {
    mons.customForm.assertNumSubmissionVisible(0);
  });

  it("... he submits a form, sees 'Thank you'", function() {
    mons.waitAndSetValueForId(textInputId, monsInputText1);
    mons.customForm.submit();
    mons.customForm.assertNumSubmissionVisible(0);
  });

  it("Stranger B doesn't see Mons' form", function() {
    strangerB.refresh();
    strangerB.customForm.assertNumSubmissionVisible(0);
  });

  it("Maria logs in (in stranger B's browser)", function() {
    assert(maria === strangerB);
    maria.complex.loginWithPasswordViaTopbar(maria);
  });

  it("... and sees no submissions", function() {
    maria.customForm.assertNumSubmissionVisible(0);
  });

  it("... she submits a form", function() {
    maria.waitAndSetValueForId(textInputId, mariaInputText1);
    maria.customForm.submit();
    maria.customForm.assertNumSubmissionVisible(0);
  });

  it("Everyone refreshes the page", function() {
    everyone.refresh();
  });

  it("Mons and Maria see no submissions", function() {
    mons.customForm.assertNumSubmissionVisible(0);
    mons.replies.assertNoReplyMatches(strangerAInputText1);
    mons.replies.assertNoReplyMatches(strangerBInputText1);
    mons.replies.assertNoReplyMatches(monsInputText1);
    mons.replies.assertNoReplyMatches(mariaInputText1);
    maria.customForm.assertNumSubmissionVisible(0);
    maria.replies.assertNoReplyMatches(strangerAInputText1);
    maria.replies.assertNoReplyMatches(strangerBInputText1);
    maria.replies.assertNoReplyMatches(monsInputText1);
    maria.replies.assertNoReplyMatches(mariaInputText1);
  });

  it("Owen sees all", function() {
    owen.customForm.assertNumSubmissionVisible(4);
    owen.replies.assertSomeReplyMatches(strangerAInputText1);
    owen.replies.assertSomeReplyMatches(strangerBInputText1);
    owen.replies.assertSomeReplyMatches(monsInputText1);
    owen.replies.assertSomeReplyMatches(mariaInputText1);
  });

  it("A guest logs in (in Maria's browser)", function() {
    assert(guest === maria);
    maria.topbar.clickLogout();
    guest.complex.loginAsGuestViaTopbar("Guesila")
  });

  it("... and sees no submissions", function() {
    guest.refresh();
    guest.customForm.assertNumSubmissionVisible(0);
  });

  it("Owen creates a new form on another page", function() {
    // TESTS_MISSING
  });

  it("... he won't see the submissions from the old form", function() {
  });

  it("The guest submits something on the new page", function() {
  });

  it("Owen sees it", function() {
  });

  it("... but not on the old page (only on the new, where it was submitted)", function() {
  });

  it("Done", function() {
    everyone.perhapsDebug();
  });

});

