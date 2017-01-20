/// <reference path="../test-types.ts"/>
/// <reference path="../../../modules/definitely-typed/lodash/lodash.d.ts"/>
/// <reference path="../../../modules/definitely-typed/mocha/mocha.d.ts"/>

import * as _ from 'lodash';
import server = require('../utils/server');
import utils = require('../utils/utils');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import buildSite = require('../utils/site-builder');
import assert = require('assert');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

declare let browser: any;

let forum;

let everyone;
let owen;
let owensBrowser;
let maria;
let mariasBrowser;
let michael;
let michaelsBrowser;
let strangersBrowser;

let idAddress: IdAddress;
let forumTitle = "Change Username Test Forum";

let mariasUsername2 = "maria2";
let mariasUsername3 = "maria3";
let mariasUsername4 = "maria4";
let mariasUsername5 = "maria5";


describe("user profile access:", () => {

  it("import a site", () => {
    browser.perhapsDebugBefore();
    forum = buildSite().addLargeForum({ title: forumTitle });
    idAddress = server.importSiteData(forum.siteData);
  });

  it("initialize people", () => {
    browser = _.assign(browser, pagesFor(browser));
    everyone = browser;
    owen = forum.members.owen;
    owensBrowser = browser;

    maria = forum.members.maria;
    mariasBrowser = browser;
    michael = forum.members.michael;
    michaelsBrowser = browser;
    strangersBrowser = browser;
  });


  it("Member Maria logs in", () => {
    mariasBrowser.go(idAddress.origin);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  it("... and goes to her profile, preferences", () => {
    mariasBrowser.topbar.clickGoToProfile();
    mariasBrowser.userProfilePage.clickGoToPreferences();
  });


  // ------ Cannot change to someone elses username

  it("She attempts to change her username to Michael, but its not available", () => {
    mariasBrowser.userProfilePage.preferences.startChangingUsername();
    mariasBrowser.userProfilePage.preferences.setUsername(michael.username);
    mariasBrowser.userProfilePage.preferences.clickSave();
  });

  it("... results in an error", () => {
    mariasBrowser.serverErrorDialog.waitAndAssertTextMatches('EdE5D0Y29_');
    mariasBrowser.serverErrorDialog.close();
  });


  // ------ Can change username

  it("She instead changes it to: " + mariasUsername2, () => {
    mariasBrowser.userProfilePage.preferences.setUsername(mariasUsername2);
    mariasBrowser.userProfilePage.preferences.save();
  });

  it("... reloads the page, sees her new username", () => {
    mariasBrowser.refresh();
    mariasBrowser.userProfilePage.goToPreferences();
    mariasBrowser.userProfilePage.assertUsernameIs(mariasUsername2);
  });


  // ------ Cannot change too many times

  it("... then she changes to: " + mariasUsername3, () => {
    mariasBrowser.userProfilePage.preferences.startChangingUsername();
    mariasBrowser.userProfilePage.preferences.setUsername(mariasUsername3);
    mariasBrowser.userProfilePage.preferences.save();

  });

  it("... then to: " + mariasUsername4, () => {
    mariasBrowser.userProfilePage.preferences.startChangingUsername();
    mariasBrowser.userProfilePage.preferences.setUsername(mariasUsername4);
    mariasBrowser.userProfilePage.preferences.clickSave();
  });

  it("But that didn't work, too many changes", () => {
    mariasBrowser.serverErrorDialog.waitAndAssertTextMatches('EdE7KP4ZZ_');
    mariasBrowser.serverErrorDialog.close();
  });


  // ------ But can change back

  it("She can however change it back to: " + mariasUsername2, () => {
    mariasBrowser.userProfilePage.preferences.setUsername(mariasUsername2);
    mariasBrowser.userProfilePage.preferences.save();
  });

  it("She reloads the page, sees her username is now " + mariasUsername2, () => {
    mariasBrowser.refresh();
    mariasBrowser.userProfilePage.assertUsernameIs(mariasUsername2);
  });

  it("She visits a topic of hers, her username has been updated", () => {
    mariasBrowser.go('/' + forum.topics.byMariaCategoryA.slug);
    mariasBrowser.topbar.assertMyUsernameMatches(mariasUsername2);
    assert(mariasBrowser.topic.getTopicAuthorUsernameInclAt() === '@' + mariasUsername2);
  });


  // ------ Others see the new username, not just Maria

  it("Maria leaves. A stranger arrives", () => {
    mariasBrowser.topbar.clickLogout();
    assert(mariasBrowser === strangersBrowser);
  });

  it("The stranger also sees this new username", () => {
    strangersBrowser.refresh();
    assert(strangersBrowser.topic.getTopicAuthorUsernameInclAt() === '@' + mariasUsername2);
  });

  it("In 'all' Maria's topics", () => {
    strangersBrowser.go('/' + forum.topics.byMariaCategoryANr2.slug);
    assert(strangersBrowser.topic.getTopicAuthorUsernameInclAt() === '@' + mariasUsername2);
  });

  it("... this topic too", () => {
    strangersBrowser.go('/' + forum.topics.byMariaCategoryB.slug);
    assert(strangersBrowser.topic.getTopicAuthorUsernameInclAt() === '@' + mariasUsername2);
  });

  // COULD check forum topic list name too, but it's only shown when hovering the user avatar
  // — how does one check on-hover tooltips? Skip for now.


  it("Done", () => {
    everyone.perhapsDebug();
  });

});

