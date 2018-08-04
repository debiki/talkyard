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
let strangersBrowser;

let siteIdAddress: IdAddress;
let siteId;

let forum: LargeTestForum;

const page1001LinkSelector = '[href^="/-1001"]';
const page1015LinkSelector = '[href^="/-1015"]';
const page1020LinkSelector = '[href^="/-1020"]';
const page1021LinkSelector = '[href^="/-1021"]';
const page1040LinkSelector = '[href^="/-1040"]';
const page1041LinkSelector = '[href^="/-1041"]';
const page1059LinkSelector = '[href^="/-1059"]';
const page1060LinkSelector = '[href^="/-1060"]';
const page1079LinkSelector = '[href^="/-1079"]';
const page1080LinkSelector = '[href^="/-1080"]';
const page1099LinkSelector = '[href^="/-1099"]';

describe("forum-scroll-position [TyT5ABK2WL4]", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addLargeForum({
      title: "Some E2E Test",
      members: undefined, // default = everyone
    });
    for (let i = 1; i < 100; ++i) {
      const id = `${1000 + i}`;
      forum.topics.byMariaCategoryA = builder.addPage({
        id,
        folder: '/',
        showId: true,
        slug: `page-id-${id}`,
        role: c.TestPageRole.Discussion,
        title: `Scrolly page ${id}`,
        body: "So scrollifying scrolly scrolling scroll test.",
        categoryId: forum.categories.categoryA.id,
        authorId: forum.members.maria.id,
        // Let New be by id, ascending, and Active be by id, descending,
        // so sorting by New and Active lists things in the opposite orders.
        createdAtMs: builder.defaultCreatedAtMs + i * 1000,
        bumpedAtMs: builder.defaultCreatedAtMs + 1000 * 1000 - i * 1000,
      });
    }
    assert(builder.getSite() === forum.siteData);
    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
  });

  it("initialize people", () => {
    everyonesBrowsers = _.assign(browser, pagesFor(browser));
    richBrowserA = _.assign(browserA, pagesFor(browserA));
    richBrowserB = _.assign(browserB, pagesFor(browserB));

    owen = forum.members.owen;
    owensBrowser = richBrowserA;
    maria = forum.members.maria;
    mariasBrowser = richBrowserB;
    strangersBrowser = richBrowserB;
  });

  it("A stranger goes to the home page", () => {
    strangersBrowser.go(siteIdAddress.origin);
  });

  it("Sees page 1001, because sorted by recent activity", () => {
    strangersBrowser.waitForVisible(page1001LinkSelector);
  });

  it("... sees pages up to 1040", () => {
    strangersBrowser.waitForVisible(page1040LinkSelector);
  });

  it("... but not 1041", () => {
    assert(!strangersBrowser.isVisible(page1041LinkSelector));
  });

  it("Scrolls down to page id 1040, at the bottom of the topic list", () => {
    strangersBrowser.scrollToBottom();
  });

  let scrollPosAtBottom;

  it("Clicks 'Load more ...'", () => {
    scrollPosAtBottom = strangersBrowser.getPageScrollY();
    assert(scrollPosAtBottom > 1000); // else test broken
    strangersBrowser.forumTopicList.clickLoadMore();
  });

  it("... More topics appear, 1041", () => {
    strangersBrowser.waitForVisible(page1041LinkSelector);
  });

  it("... to 1079", () => {
    strangersBrowser.waitForVisible(page1079LinkSelector);
  });

  it("... but not 1080", () => {
    assert(!strangersBrowser.isVisible(page1080LinkSelector));
  });

  it("... The scroll position didn't change, 1", () => {
    const scrollPosAfterMoreTopics = strangersBrowser.getPageScrollY();
    assert.equal(scrollPosAtBottom, scrollPosAfterMoreTopics);
  });

  it("Hen scrolls up to topic 1015", () => {
    strangersBrowser.scrollIntoViewInPageColumn(page1015LinkSelector);
  });

  let scrollPosByActivityTopic1015;

  it("... opens it", () => {
    scrollPosByActivityTopic1015 = strangersBrowser.getPageScrollY();
    assert(scrollPosByActivityTopic1015 > 1000); // else test broken
    strangersBrowser.forumTopicList.goToTopic('1015')
  });

  it("... And navigates back", () => {
    strangersBrowser.topbar.clickHome();
  });

  it("... the scroll position didn't change, 2", () => {
    strangersBrowser.waitForVisible(page1015LinkSelector);
    strangersBrowser.pause(500); // wait until has reset scroll pos
    const scrollPosAfterBack = strangersBrowser.getPageScrollY();
    assert.equal(scrollPosByActivityTopic1015, scrollPosAfterBack);
  });

  it("Hen views the New topics instead of Active", () => {
    strangersBrowser.scrollToTop();
    strangersBrowser.forumTopicList.viewNewest();
  });

  it("... now different topics are visible: topic 1099", () => {
    strangersBrowser.waitForVisible(page1099LinkSelector);
  });

  it("... to 1060", () => {
    strangersBrowser.waitForVisible(page1060LinkSelector);
  });

  it("... but not 1059", () => {
    assert(!strangersBrowser.isVisible(page1059LinkSelector));
  });

  it("Scrolling down and clicking Load More", () => {
    strangersBrowser.scrollToBottom();
    strangersBrowser.forumTopicList.clickLoadMore();
  });

  it("... loads topics 1059", () => {
    strangersBrowser.waitForVisible(page1059LinkSelector);
 });

  it("... to 1021", () => {
    strangersBrowser.waitForVisible(page1021LinkSelector);
  });

  it("... but not 1020", () => {
    assert(!strangersBrowser.isVisible(page1020LinkSelector));
  });

  it("Loading topics once more, shows the remaining topics", () => {
    strangersBrowser.scrollToBottom();
    strangersBrowser.forumTopicList.clickLoadMore();
  });

  it("... topic 1001", () => {
    strangersBrowser.waitForVisible(page1001LinkSelector);
});

  it("... and Michael's and Maria's topics", () => {
    strangersBrowser.forumTopicList.assertTopicVisible(forum.topics.byMariaCategoryA.title);
    strangersBrowser.forumTopicList.assertTopicVisible(forum.topics.byMichaelCategoryA.title);
  });


  /*
  it("Hen views a user's profile", () => {
  });

  it("... and navigates back", () => {
  });

  it("... The scroll position didn't change, 3", () => {
  });  */

  // Later:
  /*
  it("Maria creates a topic", () => {
  });

  it("... Owen's topic list auto updates with the new topic", () => {
  });

  it("... The scroll position doesn't change though, 4", () => {
  }); */

});

