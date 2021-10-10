/// <reference path="../test-types.ts"/>

import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';

const slugs = {
  threeRepliesPageSlug: 'impexp-three-replies.html',
  replyWithImagePageSlug: 'impexp-reply-w-image.html',
  onlyLikeVotePageSlug: 'impexp-like-vote.html',
  onlySubscrNotfsPageSlug: 'impexp-subscr-notfs.html',
  guestReplyPageSlug: 'impexp-guest-reply.html',
};

const texts = {
  mariasReplyOne: 'mariasReplyOne',
  mariasReplyTwoWithImage: 'mariasReplyTwoWithImage',
  michaelsReply: 'michaelsReply',
  owensReplyMentionsMariaMichael: 'owensReplyMentionsMariaMichael @maria @michael',
  guestsReply: 'guestsReply',
  guestsName: 'Garbo Guest',
  guestsEmail: 'e2e-garboguest@x.co',
};

async function createEmbeddingPages(browser: TyE2eTestBrowser) {
  const mkPage = browser.adminArea.settings.embedded.createSaveEmbeddingPage;
  await mkPage({ urlPath: slugs.threeRepliesPageSlug });
  await mkPage({ urlPath: slugs.replyWithImagePageSlug });
  await mkPage({ urlPath: slugs.onlyLikeVotePageSlug });
  await mkPage({ urlPath: slugs.onlySubscrNotfsPageSlug });
  await mkPage({ urlPath: slugs.guestReplyPageSlug });
}


export {
  slugs,
  texts,
  createEmbeddingPages,
}
