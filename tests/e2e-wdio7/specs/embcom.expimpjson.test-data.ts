/// <reference path="../test-types.ts"/>

import { TyE2eTestBrowser } from '../utils/pages-for';

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

function createEmbeddingPages(browser: TyE2eTestBrowser) {
  const mkPage = browser.adminArea.settings.embedded.createSaveEmbeddingPage;
  mkPage({ urlPath: slugs.threeRepliesPageSlug });
  mkPage({ urlPath: slugs.replyWithImagePageSlug });
  mkPage({ urlPath: slugs.onlyLikeVotePageSlug });
  mkPage({ urlPath: slugs.onlySubscrNotfsPageSlug });
  mkPage({ urlPath: slugs.guestReplyPageSlug });
}


export {
  slugs,
  texts,
  createEmbeddingPages,
}
