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
  owensReplyMentionsMariaMichael: 'owensReplyMentionsMariaMichael @maria @michael',
};

function createEmbeddingPages(browser) {
  const mkPage = browser.adminArea.settings.embedded.createSaveEmbeddingPage;
  mkPage({ urlPath: slugs.threeRepliesPageSlug });
  mkPage({ urlPath: slugs.replyWithImagePageSlug });
  mkPage({ urlPath: slugs.onlyLikeVotePageSlug });
  mkPage({ urlPath: slugs.onlySubscrNotfsPageSlug });
}


export {
  slugs,
  texts,
  createEmbeddingPages,
}
