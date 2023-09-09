/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import * as utils from '../utils/utils';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import settings from '../utils/settings';
import { dieIf } from '../utils/log-and-die';
import c from '../test-constants';

let richBrowserA;
let richBrowserB;
let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let maria: Member;
let mariasBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

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


describe(`forum-sort-and-scroll.d.2br  TyT5ABK2WL4`, () => {

  it("import a site", async () => {
    const builder = buildSite();
    forum = builder.addLargeForum({
      title: "Some E2E Test",
      members: undefined, // default = everyone
    });
    for (let i = 1; i <= 99; ++i) {
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
    assert.eq(builder.getSite(), forum.siteData);
    siteIdAddress = await server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
  });

  it("initialize people", async () => {
    richBrowserA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    richBrowserB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owensBrowser = richBrowserA;
    maria = forum.members.maria;
    mariasBrowser = richBrowserB;
    strangersBrowser = richBrowserB;
  });

  it("A stranger goes to the home page", async () => {
    await strangersBrowser.go2(siteIdAddress.origin);
  });

  it("Sees page 1001, because sorted by recent activity", async () => {
    await strangersBrowser.waitForVisible(page1001LinkSelector);
  });

  it("... sees pages up to 1040", async () => {
    await strangersBrowser.waitForVisible(page1040LinkSelector);
  });

  it("... but not 1041", async () => {
    assert.not(await strangersBrowser.isVisible(page1041LinkSelector));
  });

  let scrollPosAtBottom;

  it("Scrolls down to page id 1040 at the bottom, clicks 'Load more ...'", async () => {
    // There's a race — there's [.sometimes_a_relayout] making the page taller,
    // after getPageScrollY() — then Load More disappears off screen. So, retry
    await utils.tryUntilTrue("222 Scroll down until sees Load More", 3, async (): Pr<Bo> => {
      await strangersBrowser.scrollToBottom();
      scrollPosAtBottom = await strangersBrowser.getPageScrollY();
      assert.greaterThan(scrollPosAtBottom, 1000); // else test broken
      // The scroll button is already visible, thanks to scrollToBottom() above. Don't
      // scroll it even more into view — that'd break the scroll position test below (2AD4J0).
      // However, [.sometimes_a_relayout] here so the click might fail, see above.
      const res = await strangersBrowser.forumTopicList.clickLoadMore({ mayScroll: false, timeoutMs: 1000, timeoutIsFine: true });
      return res === 'Clicked';
    });
  });

  it("... More topics appear, 1041", async () => {
    await strangersBrowser.waitForVisible(page1041LinkSelector);
  });

  it("... to 1079, because loads 40 topics at a time, by default, and no. 1040 incl again", async () => {
    await strangersBrowser.waitForVisible(page1079LinkSelector);
  });

  it("... but not 1080", async () => {
    assert.not(await strangersBrowser.isVisible(page1080LinkSelector));
  });

  it("... The scroll position didn't change, 1", async () => {
    const scrollPosAfterMoreTopics = await strangersBrowser.getPageScrollY();
    assert.eq(scrollPosAfterMoreTopics, scrollPosAtBottom);  // (2AD4J0)
  });

  it("Hen scrolls up to topic 1015", async () => {
    await strangersBrowser.scrollIntoViewInPageColumn(page1015LinkSelector);
  });

  let scrollPosByActivityTopic1015;

  it("... opens it", async () => {
    scrollPosByActivityTopic1015 = await strangersBrowser.getPageScrollY();
    // In Chrome, we're always at scroll pos > 1000, but in FF, we're at
    // scroll pos 995. Why? Maybe doesn't matter? I suppose somehow FF
    // scrolls up a tiny bit more, in the step just above?
    const minScroll = settings.browserName === 'firefox' ? 990 : 1000;
    assert.greaterThan(scrollPosByActivityTopic1015, minScroll); // else test broken
    await strangersBrowser.forumTopicList.goToTopic('1015', { mayScroll: false });
  });

  it("... And navigates back", async () => {
    await strangersBrowser.topbar.clickHome();
  });

  async function wait5SecondsUntilHasResetScroll() {
    let scrollPosAfterBack;
    for (let i = 0; i < 4800; i += 400) {
      scrollPosAfterBack = await strangersBrowser.getPageScrollY();
      // Accept small differences.
      if (Math.abs(scrollPosAfterBack - scrollPosByActivityTopic1015) < 10) {
        return;
      }
      await browser.pause(400);
    }
    // This'll fail.
    assert.eq(scrollPosAfterBack, scrollPosByActivityTopic1015);
  }

  it("... the scroll position didn't change, 2", async () => {
    await strangersBrowser.waitForVisible(page1015LinkSelector);
    await wait5SecondsUntilHasResetScroll();
  });

  it("Try mess up the scroll pos a few more times — there was a bug before  TyT5WG7AB02", async () => {
    for (let i = 0; i < 3; ++i) {
      await strangersBrowser.scrollIntoViewInPageColumn(page1015LinkSelector);
      scrollPosByActivityTopic1015 = await strangersBrowser.getPageScrollY();
      await strangersBrowser.forumTopicList.goToTopic('1015', { mayScroll: false });
      await strangersBrowser.topbar.clickHome();
      await strangersBrowser.waitForVisible(page1015LinkSelector);
      await wait5SecondsUntilHasResetScroll();
    }
  });

  it("Hen views the New topics instead of Active", async () => {
    await strangersBrowser.scrollToTop();
    await strangersBrowser.forumTopicList.viewNewest();
  });

  it("... now different topics are visible: topic 1099", async () => {
    await strangersBrowser.waitForVisible(page1099LinkSelector);
  });

  it("... to 1060", async () => {
    await strangersBrowser.waitForVisible(page1060LinkSelector);
  });

  it("... but not 1059", async () => {
    assert.ok(!await strangersBrowser.isVisible(page1059LinkSelector));
  });

  it("Scrolling down and clicking Load More", async () => {
    await strangersBrowser.scrollToBottom({ tryUntilSeesLoadMore: true });
    await strangersBrowser.forumTopicList.clickLoadMore();
  });

  it("... loads topics 1059", async () => {
    await strangersBrowser.waitForVisible(page1059LinkSelector);
 });

  it("... to 1021", async () => {
    await strangersBrowser.waitForVisible(page1021LinkSelector);
  });

  it("... but not 1020", async () => {
    assert.ok(!await strangersBrowser.isVisible(page1020LinkSelector));
  });

  it("Loading topics once more, shows the remaining topics", async () => {
    await strangersBrowser.scrollToBottom({ tryUntilSeesLoadMore: true });
    await strangersBrowser.forumTopicList.clickLoadMore();
  });

  it("... topic 1001", async () => {
    await strangersBrowser.waitForVisible(page1001LinkSelector);
});

  it("... and Michael's topic", async () => {
    await strangersBrowser.forumTopicList.waitForTopicVisible(forum.topics.byMariaCategoryA.title);
});

  it("... and Maria's topic", async () => {
    await strangersBrowser.forumTopicList.waitForTopicVisible(forum.topics.byMichaelCategoryA.title);
  });


  /*
  it("Hen views a user's profile", async () => {
  });

  it("... and navigates back", async () => {
  });

  it("... The scroll position didn't change, 3", async () => {
  });  */

  // Later:
  /*
  it("Maria creates a topic", async () => {
  });

  it("... Owen's topic list auto updates with the new topic", async () => {
  });

  it("... The scroll position doesn't change though, 4", async () => {
  }); */

});

