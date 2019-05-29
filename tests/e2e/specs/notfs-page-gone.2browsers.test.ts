/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

declare var browser: any;
declare var browserA: any;
declare var browserB: any;

let everyonesBrowsers;
let richBrowserA;
let richBrowserB;

let owen: Member;
let owensBrowser;
let maria: Member;
let mariasBrowser;
let maja: Member;
let majasBrowser;

let siteIdAddress: IdAddress;
let siteId;

let forum: TwoPagesTestForum;

let discussionPageUrl: string;

const mariasReplyMentionsMaja = 'mariasReplyMentionsMaja @maja';
const majasReplyToOwen = 'Ok Owen, wise words and tasty birds'


describe("notfs-page-gone  TyT7DMR24RF8", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Notfs Page Gone",
      members: ['maja', 'maria', 'michael'],
    });
    assert(builder.getSite() === forum.siteData);
    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
    discussionPageUrl = siteIdAddress.origin + '/' + forum.topics.byMariaCategoryA.slug;
  });

  it("initialize people", () => {
    everyonesBrowsers = _.assign(browser, pagesFor(browser));
    richBrowserA = _.assign(browserA, pagesFor(browserA));
    richBrowserB = _.assign(browserB, pagesFor(browserB));

    owen = forum.members.owen;
    owensBrowser = richBrowserA;
    maria = forum.members.maria;
    mariasBrowser = richBrowserB;
    maja = forum.members.maja;
    majasBrowser = richBrowserB;
  });

  it("Maria goes to her page, logs in", () => {
    mariasBrowser.go(discussionPageUrl);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  it("Maria posts a reply, mentions Maja", () => {
    mariasBrowser.complex.replyToOrigPost(mariasReplyMentionsMaja);
  });

  it("... returns to the topic list, so won't see the page any more", () => {
    mariasBrowser.go('/');
  });

  it("Maria leaves, Maja arrives", () => {
    mariasBrowser.topbar.clickLogout();
    majasBrowser.complex.loginWithPasswordViaTopbar(maja);
  });

  it("Maja sees a notification to her", () => {
    mariasBrowser.topbar.waitForNumDirectNotfs(1);
  });

  it("Owen arrives", () => {
    owensBrowser.go(discussionPageUrl);
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
  });

  it("He deletes Maria's comment — Owen likes colibris, but the comment isn't about colibris", () => {
    owensBrowser.topic.deletePost(c.FirstReplyNr);
  });

  it("Owen replies to Maria that only colibri are on-topic", () => {
    owensBrowser.complex.replyToOrigPost("Please talk about colibris, they are so interesting");
  });

  it("Maja clicks the notf in her username menu", () => {
    majasBrowser.topbar.openNotfToMe({ waitForNewUrl: true });
  });

  it("... sees a message that the post has been deleted", () => {
    majasBrowser.waitForVisible('.e_PDd');
    majasBrowser.stupidDialog.close();
  });

  it("Maja replies to Owen", () => {
    majasBrowser.complex.replyToPostNr(c.FirstReplyNr + 1, majasReplyToOwen);
  });

  it("Maja leaves, Maria arrives", () => {
    majasBrowser.topbar.clickHome();
    majasBrowser.topbar.clickLogout();
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  it("Maria sees a notification to her", () => {
    mariasBrowser.topbar.waitForNumDirectNotfs(1);
  });

  it("But Owen deletes the whole page — he has an idea, a new mission", () => {
    owensBrowser.topbar.pageTools.deletePage();
  });

  let lastUrlPath;

  it("Maria clicks the notification to her", () => {
    lastUrlPath = majasBrowser.urlPath();
    mariasBrowser.topbar.openNotfToMe({ waitForNewUrl: true });
  });

  it("There's a dialog about the page not existing", () => {
    majasBrowser.waitForVisible('.e_NoPg');
  });

  it("... Maja clicks Back in the dialog", () => {
    majasBrowser.rememberCurrentUrl();
    majasBrowser.waitAndClick('.e_NoPg a');  // back to prev page button
    majasBrowser.waitForNewUrl();
    assert.equal(majasBrowser.urlPath(), lastUrlPath);
  });

  it("Owen goes to his profile page", () => {
    owensBrowser.topbar.clickGoToProfile();
  });

  it("... tabs to the notifications tab", () => {
    owensBrowser.userProfilePage.tabToNotfs();
  });

  it("There's one notification", () => {
    assert.equal(owensBrowser.userProfilePage.notfs.numNotfs(), 1);
  });

  it("Owen clicks it; it's Maja's reply to him — he can see notfs on deleted pages " +
        "because he's admin", () => {
    owensBrowser.userProfilePage.notfs.openPageNotfWithText(forum.topics.byMariaCategoryA.title);
  });

  it("... the browser goes to the delted page. Owen sees Maja's reply", () => {
    owensBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr + 2, majasReplyToOwen);
  });

  it("... the url is correct", () => {
    assert(owensBrowser.url().value.startsWith(discussionPageUrl));
  });

  it("Owen books a ticket to the tropical rain forrests, to go and feed the colibris", () => {
  });

});

