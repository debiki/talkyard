/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import { j2s } from '../utils/log-and-die';
import c from '../test-constants';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maria: Member;
let memah: Member;
let memah_brB: TyE2eTestBrowser;
let michael: Member;

let site: IdAddress;
let forum: TwoPagesTestForum;

let michaelsTopicUrl: St;
let mariasTopicUrl: St;

const tagOneDash = 'tagOneDash-da-sh';  // will be used only once
const tagTwoSpace = 'tagTwoSpace space s';  // will be used twice
const tagThreeColonSlash = 'tagThreeColonSlash:/ab/c';   // trice


describe(`tags-basic.2br  TyTE2ETAGSBSC`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Some E2E Test",
      members: ['owen', 'memah', 'maria', 'michael']
    });

    builder.settings({ enableTags: true });

    // Currently tags won't appear, in the default e2e test layout — TitleExcerptSameLine.
    // Maybe stop supporting TitleExcerptSameLine?
    // For now, pick a different layout:
    builder.updatePage(forum.forumPage.id, (p: PageJustAdded) => {
      p.layout = c.TestTopicListLayout.ExcerptBelowTitle;   // TyTFRMLAYOUT
    });

    builder.addPost({
      page: forum.topics.byMariaCategoryA,
      nr: c.FirstReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.michael.id,
      approvedSource: "Tags are nice, makes me tagged.",
    });

    builder.addPost({
      page: forum.topics.byMariaCategoryA,
      nr: c.FirstReplyNr + 1,
      parentNr: c.BodyNr,
      authorId: forum.members.maria.id,
      approvedSource: "Tags are edgy, do I want any?",
    });

    builder.addPost({
      page: forum.topics.byMichaelCatA,
      nr: c.FirstReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.maria.id,
      approvedSource: "To tag, or not to tag? I'd say, not to tag.",
    });

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    maria = forum.members.maria;
    memah = forum.members.memah;
    memah_brB = brB;
    michael = forum.members.michael;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
    michaelsTopicUrl = site.origin + '/' + forum.topics.byMichaelCategoryA.slug;
    mariasTopicUrl = site.origin + '/' + forum.topics.byMariaCategoryA.slug;
  });


  it(`Memah goes to Maria's page. There are no tags`, async () => {
    await memah_brB.go2(mariasTopicUrl);
    await memah_brB.complex.loginWithPasswordViaTopbar(memah);
  });

  // ttt
  addTagTests(() => memah_brB, 'Memah', new Map([
        [c.BodyNr, []],
        [c.SecondReplyNr, []]]));



  // ----- Tag a page

  it(`Owen goes to Mara's page ... `, async () => {
    await owen_brA.go2(mariasTopicUrl);
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });

  it(`Owen tags the page`, async () => {
    await owen_brA.topic.openTagsDialog();
    await owen_brA.tagsDialog.createAndAddTag(tagOneDash, { numAfterwards: 1 });
    await owen_brA.tagsDialog.saveAndClose();
  });

  it(`Owen sees the tag without page reload`, async () => {
    const tags = await owen_brA.topic.getTags({ forPostNr: 1, howManyTags: 1 });
    assert.deepEq(tags, [tagOneDash]);
  });

  it(`Memah reloads the page; she sees the tag too`, async () => {
    await memah_brB.refresh2();
  });

  addTagTests(() => memah_brB, 'Memah', new Map([
        [c.BodyNr, [tagOneDash]],
        [c.SecondReplyNr, []]]));



  // ----- Many tags

  it(`Owen adds two more tags`, async () => {
    await owen_brA.topic.openTagsDialog();
    await owen_brA.tagsDialog.createAndAddTag(tagTwoSpace, { numAfterwards: 2 });
    await owen_brA.tagsDialog.createAndAddTag(tagThreeColonSlash, { numAfterwards: 3 });
    await owen_brA.tagsDialog.saveAndClose();
  });

  it(`Memah reloads the page — the OP should have 3 tags, the other posts none`, async () => {
    await memah_brB.refresh2();
  });

  addTagTests(() => memah_brB, 'Memah', new Map([
        [c.BodyNr, [tagOneDash, tagThreeColonSlash, tagTwoSpace]],
        [c.SecondReplyNr, []]]));



  // ----- Tag a reply.  More dropdown, for post

  it(`Owen tags a reply as well`, async () => {
    await owen_brA.topic.openTagsDialog({
          forPostNr: c.SecondReplyNr, openHow: 'ViaMoreDropdown' });
    // Unique constraint error: (maybe add auto test?)  constr: tagtypes_u_anypat_dispname
    //await owen_brA.tagsDialog.createAndAddTag(tagTwoSpace, { numAfterwards: 1 });
    // Instead:
    await owen_brA.tagsDialog.addExistingTag(tagTwoSpace, { numAfterwards: 1 });
    await owen_brA.tagsDialog.saveAndClose();
  });



  // ----- Tag a 2nd page.  More dropdown, for page

  it(`Owen goes to Michael's page`, async () => {
    await owen_brA.go2(michaelsTopicUrl);
  });

  it(`... tags Michael's page`, async () => {
    await owen_brA.topic.openTagsDialog({ openHow: 'ViaMoreDropdown' });
    await owen_brA.tagsDialog.addExistingTag(tagThreeColonSlash, { numAfterwards: 1 });
    await owen_brA.tagsDialog.saveAndClose();
  });

  it(`... and Maria's reply`, async () => {
    await owen_brA.topic.openTagsDialog({ forPostNr: c.FirstReplyNr,
          openHow: 'ViaMoreDropdown' });
    await owen_brA.tagsDialog.addExistingTag(tagThreeColonSlash, { numAfterwards: 1 });
    await owen_brA.tagsDialog.saveAndClose();
  });

  it(`Memah also goes to Michael's page, sees Orig Post and reply 1 tags`, async () => {
    await memah_brB.go2(michaelsTopicUrl);
  });

  addTagTests(() => memah_brB, 'Memah', new Map([
        [c.BodyNr, [tagThreeColonSlash]],
        [c.FirstReplyNr, [tagThreeColonSlash]]]));



  // ----- Removing a post tag

  it(`Owen sees that Maria's reply is tagged,  ttt`, async () => {
    const tags = await owen_brA.topic.getTags({ forPostNr: c.FirstReplyNr, howManyTags: 1 });
    assert.deepEq(tags, [tagThreeColonSlash]);
  });

  it(`Owen un-tags Maria's reply`, async () => {
    await owen_brA.topic.openTagsDialog({ forPostNr: c.FirstReplyNr,
          openHow: 'ViaMoreDropdown' });
    await owen_brA.tagsDialog.removeNthTag(1, { numAfterwards: 0 });
    await owen_brA.tagsDialog.saveAndClose();
  });

  it(`... the tag is gone, directly, for Owen`, async () => {
    const tags = await owen_brA.topic.getTags({ forPostNr: c.FirstReplyNr, howManyTags: 0 });
    assert.deepEq(tags, []);
  });



  // ----- Removing a page tag

  it(`Owen goes to Maria's page`, async () => {
    await owen_brA.go2(mariasTopicUrl);
  });

  it(`... removes a single tag — namely "${tagTwoSpace}"`, async () => {
    await owen_brA.topic.openTagsDialog();
    // The tags are sorted by name [sort_tags], so the order is:
    // ['tagOneDash...', 'tagThreeColonSlash...', 'tagTwoSpace...'].
    // So, to remove tag two, we remove the last item (index 3; CSS n-th is one-indexed).
    await owen_brA.tagsDialog.removeNthTag(3, { numAfterwards: 2 });
    await owen_brA.tagsDialog.saveAndClose();
  });

  it(`... the tags update directly, for Owen`, async () => {
    const tags = await owen_brA.topic.getTags({ howManyTags: 2 });
    assert.deepEq(tags, [tagOneDash, tagThreeColonSlash]);
  });


  // ----- Check that pages get rerendered

  it(`Now Memah sees just the page tag, on Micheal's page`, async () => {
    await memah_brB.refresh2();
  });

  addTagTests(() => memah_brB, 'Memah', new Map([
        [c.BodyNr, [tagThreeColonSlash]],
        [c.FirstReplyNr, []]]));


  it(`On Maria's page, she sees the Orig Post has just two tags`, async () => {
    await memah_brB.go2(mariasTopicUrl);
  });

  addTagTests(() => memah_brB, 'Memah', new Map([
        [c.BodyNr, [tagOneDash, tagThreeColonSlash]],
        [c.FirstReplyNr, []],
        [c.SecondReplyNr, [tagTwoSpace]]]));



  // ----- Removing all tags

  it(`Owen removes all page tags`, async () => {
    await owen_brA.topic.openTagsDialog({});
    await owen_brA.tagsDialog.removeNthTag(1, { numAfterwards: 1 });
    await owen_brA.tagsDialog.removeNthTag(1, { numAfterwards: 0 });
    await owen_brA.tagsDialog.saveAndClose();
  });

  it(`Tags gone, directly, for Owen`, async () => {
    const tags = await owen_brA.topic.getTags({ howManyTags: 0 });
    assert.deepEq(tags, []);
  });

  it(`... but Maria's reply still has its tag`, async () => {
    const tags = await owen_brA.topic.getTags({ forPostNr: c.SecondReplyNr, howManyTags: 1 });
    assert.deepEq(tags, [tagTwoSpace]);
  });

  it(`Memah sees that her Orig Post now has no tags`, async () => {
    await memah_brB.refresh2();
  });

  addTagTests(() => memah_brB, 'Memah', new Map([
        [c.BodyNr, []],
        [c.SecondReplyNr, [tagTwoSpace]]]));



  // ----- Adding back a removed tag (no unique key error)

  it(`Owen adds back a tag`, async () => {
    await owen_brA.topic.openTagsDialog({});
    await owen_brA.tagsDialog.addExistingTag(tagOneDash, { numAfterwards: 1 });
    await owen_brA.tagsDialog.saveAndClose();
  });

  it(`... it's back`, async () => {
    const tags = await owen_brA.topic.getTags({ howManyTags: 1 });
    assert.deepEq(tags, [tagOneDash]);
  });

  it(`... also after reload`, async () => {
    owen_brA.refresh2();
    const tags = await owen_brA.topic.getTags({ howManyTags: 1 });
    assert.deepEq(tags, [tagOneDash]);
  });



  function addTagTests(br: () => TyE2eTestBrowser, who: St, tagsByPostNr: Map<PostNr, St[]>) {
    let pagePath: St | U;
    let pageId: St | U;
    let origPostAuthor: St | U;

    it(`${who} sees these post tags: ${j2s(tagsByPostNr)}`, async () => {
      pagePath = await br().urlPath();
      pageId = await br().getPageId();
      origPostAuthor = await br().topic.getPostAuthorUsername(c.BodyNr);

      // Dupl code [.check_post_tags]
      // Might need to wait for the server to re-render the page?
      for (const [postNr, tags] of tagsByPostNr) {
        const actualTagTitles: St[] =
              await br().topic.getTags({ forPostNr: postNr, howManyTags: tags.length });
        assert.deepEq(actualTagTitles.sort(), tags.sort());
      }
    });

    const origPostTags = tagsByPostNr.get(c.BodyNr);

    if (origPostTags) {
      it(`The page has tag(s) — they're shown in the forum topic list`, async () => {
        await br().topbar.clickHome();
        // [E2EBUG] no idea why, but unless triggering a relayout,  Webdriverio never finds:
        //   .c_TpcTtl[href="/by-maria-category-a"] + .dw-p-excerpt
        // although I see it myself, find it in Dev Tools.
        // Trigger relayout: (or make the page wider?)  [topc_list_tags_not_found]
        await br().watchbar.openIfNeeded();
        await br().watchbar.close();
        const actualTagTitles: St[] = await br().forumTopicList.getTopicTags({
                topicUrlPath: pagePath, howManyTags: origPostTags.length });
        assert.deepEq(actualTagTitles.sort(), origPostTags.sort());
      });

      it(`... also after page reload`, async () => {
        await br().refresh2();
        const actualTagTitles: St[] = await br().forumTopicList.getTopicTags({
                topicUrlPath: pagePath, howManyTags: origPostTags.length });
        assert.deepEq(actualTagTitles.sort(), origPostTags.sort());
      });

      it(`${who} goes to the page author's profile page`, async () => {
        await br().userProfilePage.activity.summary.goHere(origPostAuthor);
      });

      it(`... single-page navigates to the recent posts list`, async () => {
        await br().userProfilePage.activity.switchToPosts({ shallFindPosts: true });
      });

      it(`... sees orig post tags`, async () => {
        // Should use both page and post nr (or just post *id*) to
        // select the correct post. However in this case, just nr happens to work.
        const actualTags = await br().userProfilePage.activity.posts.getTags({
                forPostNr: c.BodyNr, howManyTags: origPostTags.length });
        assert.deepEq(actualTags.sort(), origPostTags.sort());
      });
      it(`... also after page reload`, async () => {
        await br().refresh2();
        const actualTags = await br().userProfilePage.activity.posts.getTags({
                forPostNr: c.BodyNr, howManyTags: origPostTags.length });
        assert.deepEq(actualTags.sort(), origPostTags.sort());
      });

      it(`${who} jumps away from the posts list`, async () => {
        await br().userProfilePage.activity.summary.goHere(origPostAuthor);
      });

      it(`... single-page navigates to the topics list`, async () => {
        await br().userProfilePage.activity.switchToTopics({ shallFindTopics: true });
      });

      it(`... sees the orig post tags`, async () => {
        const actualTags = await br().userProfilePage.activity.topics.getTags({
                forPagePath: pagePath, howManyTags: origPostTags.length });
        assert.deepEq(actualTags.sort(), origPostTags.sort());
      });

      it(`... also after page reload`, async () => {
        await br().refresh2();
        const actualTags = await br().userProfilePage.activity.topics.getTags({
                forPagePath: pagePath, howManyTags: origPostTags.length });
        assert.deepEq(actualTags.sort(), origPostTags.sort());
      });

      it(`${who} navigates to the discussion page`, async () => {
        await br().userProfilePage.activity.topics.navToPage({ pagePath });  // TyTNAVUSR2PG
      });

      it(`... tags shown here, after single-page navigating there`, async () => {
        // Dupl code [.check_post_tags]
        for (const [postNr, tags] of tagsByPostNr) {
          const actualTagTitles: St[] =
                await br().topic.getTags({ forPostNr: postNr, howManyTags: tags.length });
          assert.deepEq(actualTagTitles.sort(), tags.sort());
        }
      });
    }
  }

});

