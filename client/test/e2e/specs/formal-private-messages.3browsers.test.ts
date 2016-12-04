/// <reference path="../test-types.ts"/>
/// <reference path="../../../../modules/definitely-typed/lodash/lodash.d.ts"/>
/// <reference path="../../../../modules/definitely-typed/mocha/mocha.d.ts"/>

import * as _ from 'lodash';
import server = require('../utils/server');
import utils = require('../utils/utils');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import make = require('../utils/make');
import assert = require('assert');
import logAndDie = require('../utils/log-and-die');

declare let browser: any;
declare let browserA: any;
declare let browserB: any;
declare let browserC: any;

let everyone;
let owen;
let michael;
let maria;
let guest;
let stranger;

let idAddress;
let forumTitle = "Forum with Private Chat";
let messageUrl;
let messageTitle = "Message title";
let messageText = "Hi I have a question";
let owensAnswer = "Yes what is it?";
let mariasQuestion = "Can I ask questions?";


describe("private chat", function() {

  it("initialize people", function() {
    browser.perhapsDebugBefore();
    everyone = _.assign(browser, pagesFor(browser));
    owen = _.assign(browserA, pagesFor(browserA), make.memberOwenOwner());
    michael = _.assign(browserB, pagesFor(browserB), make.memberMichael());
    maria = _.assign(browserC, pagesFor(browserC), make.memberMaria());
    // Let's reuse the same browser.
    guest = michael;
    stranger = michael;
  });

  it("import a site", function() {
    let site: SiteData = make.forumOwnedByOwen('formal-priv-msg', { title: forumTitle });
    site.settings.allowGuestLogin = true;
    site.members.push(make.memberMichael());
    site.members.push(make.memberMaria());
    idAddress = server.importSiteData(site);
  });

  it("Maria opens Owen's user page", function() {
    maria.userProfilePage.openActivityFor(owen.username, idAddress.origin);
    //maria.assertPageTitleMatches(forumTitle);
    maria.complex.loginWithPasswordViaTopbar(maria);
  });

  it("... sends a formal private message", function() {
    maria.userProfilePage.clickSendMessage();
    maria.editor.editTitle(messageTitle);
    maria.editor.editText(messageText);
    maria.editor.saveWaitForNewPage();
    maria.assertPageTitleMatches(messageTitle);
    maria.assertPageBodyMatches(messageText);
    messageUrl = maria.url().value;
  });

  it("Owen logs in", function() {
    owen.go(idAddress.origin);
    owen.complex.loginWithPasswordViaTopbar(owen);
  });

  it("... he doesn't see the message in the topic list", function() {
    owen.forumTopicList.waitUntilKnowsIsEmpty();
  });

  it("... but sees a notification", function() {
    owen.topbar.assertNotfToMe();
  });

  it("... opens the message via the notf icon", function() {
    owen.topbar.openNotfToMe();
  });

  it("... and replies", function() {
    owen.complex.replyToOrigPost(owensAnswer);
    owen.topic.waitForPostNrVisible(2);
  });

  it("Maria sees the reply, replies", function() {
    maria.topic.waitForPostNrVisible(2);
    maria.topic.assertPostTextMatches(2, owensAnswer);
    maria.complex.replyToPostNr(2, mariasQuestion);
    maria.topic.waitForPostNrVisible(3);
    maria.topic.assertPostTextMatches(3, mariasQuestion);
  });

  it("Owen sees Maria reply", function() {
    owen.topic.waitForPostNrVisible(3);
    owen.topic.assertPostTextMatches(3, mariasQuestion);
  });

  it("A stranger doesn't see the topic in the forum topic list", function() {
    stranger.go(idAddress.origin);
    stranger.forumTopicList.waitUntilKnowsIsEmpty();
  });

  it("... and cannot accesss it via a direct link", function() {
    stranger.go(messageUrl);
    stranger.assertNotFoundError();
  });

  it("Michael logs in", function() {
    assert(michael === stranger);
    michael.go(idAddress.origin);
    michael.complex.loginWithPasswordViaTopbar(michael);
  });

  it("... doesn't see the topic in the forum topic list", function() {
    michael.forumTopicList.waitUntilKnowsIsEmpty();
  });

  it("... even not after a refresh", function() {
    michael.refresh();
    michael.forumTopicList.waitUntilKnowsIsEmpty();
  });

  it("... and cannot access via direct link", function() {
    michael.go(messageUrl);
    michael.assertNotFoundError();
  });

  it("... and does not see it in his profile page, the messages section", function() {
    michael.userProfilePage.openNotfsFor(michael.username, idAddress.origin);
    michael.userProfilePage.notfs.waitUntilKnowsIsEmpty();
  });

  it("... and does not see it in the watchbar", function() {
    michael.watchbar.openIfNeeded();
    michael.watchbar.asserExactlyNumTopics(1); // the forum, but no priv-message
  });

  it("Maria also doesn't see it listed in the forum", function() {
    maria.go(idAddress.origin);
    maria.forumTopicList.waitUntilKnowsIsEmpty();
  });

  it("... but she can access it via a direct link", function() {
    maria.go(messageUrl);
    maria.waitForMyDataAdded();
    maria.assertPageTitleMatches(messageTitle);
    maria.assertPageBodyMatches(messageText);
  });

  it("... and via her profile page, the messages section", function() {
    maria.userProfilePage.openNotfsFor(maria.username, idAddress.origin);
    maria.userProfilePage.notfs.waitUntilSeesNotfs();
    maria.userProfilePage.notfs.openPageNotfWithText(messageTitle);
    maria.waitForMyDataAdded();
    maria.assertPageTitleMatches(messageTitle);
    maria.assertPageBodyMatches(messageText);
  });

  it("... and via the watchbar", function() {
    maria.go(idAddress.origin);
    maria.watchbar.openIfNeeded();
    maria.watchbar.asserExactlyNumTopics(2); // forum + priv-message
    maria.watchbar.assertTopicVisible(messageTitle);
    maria.watchbar.goToTopic(messageTitle);
    maria.assertPageTitleMatches(messageTitle);
    maria.assertPageBodyMatches(messageText);
  });

  it("Maria logs out", function() {
    maria.topbar.clickLogout({ waitForLoginButton: false });
    // COULD test if becoes 404 Not Found, or redirected to homepage?
  });

  describe("... and can access the priv message no more", function() {
    it("not in the topic list", function() {
      maria.go(idAddress.origin);
      maria.forumTopicList.waitUntilKnowsIsEmpty();
    });

    it("not in the watchbar", function() {
      maria.watchbar.openIfNeeded();
      maria.watchbar.asserExactlyNumTopics(1); // the forum, but no priv-message
    });

    it("not via direct link", function() {
      maria.go(messageUrl);
      maria.assertNotFoundError();
    });

    it("not via profile page", function() {
      maria.userProfilePage.openNotfsFor(maria.username, idAddress.origin);
      maria.userProfilePage.notfs.assertMayNotSeeNotfs();
    });
  });

  /*
  it("Owen also doesn't see it listed in the forum", function() {
    owen.debug();
    owen.go(idAddress.origin);
    owen.forumTopicList.waitUntilKnowsIsEmpty();
  });

  it("... but he too can access it via a direct link", function() {
  });

  it("... and via his profile page, the messages section", function() {
  });

  it("Michael leaves, a guest logs in", function() {
  });

  it("The guest doesn't see the topic in the topic list", function() {
  });

  it("... and cannot access it via a direct link", function() {
  });
  */

  it("Done", function() {
    everyone.perhapsDebug();
  });

});

