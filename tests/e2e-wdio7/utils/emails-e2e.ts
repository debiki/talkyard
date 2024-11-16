/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from './ty-assert';
import { die } from './log-and-die';
import c from '../test-constants';
import server from './server';


export function checkEmailsTo(
    toName: St,
    to: () => Member,
    ps: { from: [St, () => Member],
          isAnon?: Bo,
          isWhat: 'VotedLike' | 'NewTopic' | 'DirectReply' | 'CommentNotf' |
                  'ReplyToReview' | 'TopicToReview',
          postNr?: PostNr,
          textOrRegex?: St | RegExp,
          expectedNumEmails?: () => Nr,
          site: () => IdAddress }) {

  let lastEmail: EmailSubjectBody;
  const fromName: St = ps.from[0];
  const from: () => Member = ps.from[1];
  const what: S =
          ps.isWhat === 'VotedLike' ? "Like vote" : (
          ps.isWhat === 'NewTopic' ? "new topic" : (
          ps.isWhat === 'DirectReply' || ps.isWhat === 'CommentNotf' ? "reply" : (  // MORE EXACT?
          ps.isWhat === 'TopicToReview' ? "new topic to review" : (
          ps.isWhat === 'ReplyToReview' ? "reply to review" : (
          die(`Bad isWhat: "${ps.isWhat}" TyE56032TNMG3`))))));

  it(`${toName} gets notified about ${fromName}'s ${what}`, async () => {
    const nameToCheck = ps.isAnon ? c.EmailAnonName : from().username;
    const emails: EmailSubjectBody[] =
            await server.waitGetLastEmailsSentTo(
                ps.site().id, to().emailAddress, to().expectedNumEmails);
    lastEmail = emails[emails.length - 1];
    if (ps.isWhat === 'VotedLike') {
      const postType = ps.postNr === c.BodyNr ? "topic" : "reply";
      const regex = new RegExp(
             `<i>${nameToCheck}</i> likes ` +
              `<a href="https?://e2e-test-[^/]+/-2#post-${ps.postNr}">your ${postType}`);
      assert.matches(lastEmail.bodyHtmlText, regex);
    }
    else if (_.isString(ps.textOrRegex))
      assert.includes(lastEmail.bodyHtmlText, ps.textOrRegex);
    else if (_.isRegExp(ps.textOrRegex))
      assert.matches(lastEmail.bodyHtmlText, ps.textOrRegex);
    else
      die(`Not a string or regex: ${ps.textOrRegex}  [TyE5WNJ3SL7]`)
  });

  const typeStr =
          // 'VotedLike': tested in the regex above: "... likes ...".
          // 'NewTopic' - todo?
          ps.isWhat === 'DirectReply' ? "You have a reply," : (
          ps.isWhat === 'CommentNotf' ? "A new comment has been posted," : (
          ps.isWhat === 'TopicToReview' ? "A new topic for you to review," : (
          ps.isWhat === 'ReplyToReview' ? "A new reply for you to review," : (
          null))));

  if (typeStr) {
    it(`It's of type: "${typeStr}"`, async () => {
      assert.includes(lastEmail.bodyHtmlText, typeStr);
    });
  }

  if (ps.isAnon) {
    it(`... doesn't see ${fromName}'s name — instead, "${c.EmailAnonName}"`, async () => {
      assert.excludes(lastEmail.bodyHtmlText.toLowerCase(), [
                fromName, from().username, from().fullName].map(x => x.toLowerCase()));
      assert.includes(lastEmail.bodyHtmlText, `>${c.EmailAnonName}</`); // between <i>..</i> tags
    });
  }
  else {
    it(`... sees ${fromName}'s name`, async () => {
      assert.includes(lastEmail.bodyHtmlText, `>${from().username}</`); // between <i>..</i> tags
    });
  }

  if (ps.expectedNumEmails) {
    it(`No other emails got sent`, async () => {
      const expected = ps.expectedNumEmails();
      const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(ps.site().id);
      assert.eq(num, expected, `Emails sent to: ${addrsByTimeAsc}`);
    });
  }
}

