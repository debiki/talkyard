/// <reference path="../test-types.ts"/>

import pagesFor = require('../utils/pages-for');

const slugs = {
  threeRepliesPageSlug: 'impexp-three-replies',
  replyWithImagePageSlug: 'impexp-reply-w-image',
  onlyLikeVotePageSlug: 'impexp-like-vote',
  onlySubscrNotfsPageSlug: 'impexp-subscr-notfs',
};

const texts = {
  mariasReplyOne: 'mariasReplyOne',
  mariasReplyTwoWithImage: 'mariasReplyTwoWithImage',
  michaelsReply: 'michaelsReply',
  owensReplyMentiosMariaMichael: 'owensReplyMentiosMariaMichael @maria @michael',
};

function createEmbeddingPages(browser) {
  const mkPage = browser.adminArea.settings.embedded.createSaveEmbeddingPage;
  mkPage({ urlPath: slugs.threeRepliesPageSlug, browser });
  mkPage({ urlPath: slugs.replyWithImagePageSlug, browser });
  mkPage({ urlPath: slugs.onlyLikeVotePageSlug, browser });
  mkPage({ urlPath: slugs.onlySubscrNotfsPageSlug, browser });
}


export {
  slugs,
  texts,
  createEmbeddingPages,
}
