/*
 * Copyright (c) 2023 Kaj Magnus Lindberg
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/// <reference path="more-prelude.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2 {
//------------------------------------------------------------------------------


/// disc_findAnonsToReuse()
///
/// If pat is posting a reply anonymously, then, if han has posted or voted earlier
/// anonymously on the same page, usually han wants hens new reply, to be
/// by the same anonym, so others see they're talking with the same person
/// (although they don't know who it is, just that it's the same).
///
/// This fn finds anonyms a pat has used, so the pat can reuse them. First it
/// looks for anonyms-to-reuse in the sub thread where pats reply will appear,
/// thereafter anywhere on the same page.
///
/// Returns sth like this, where 200 is pat's id, and 2001, 2002, 2003, 2004 are
/// anons pat has used on the current page:  (just nice looking numbers)
/// {
///   // Just an example
///   byId: {
///     2001: patsAnon2001,  // = { id: 2001, forPatId: 200, ... }
///     2002: patsAnon2002,  // = { id: 2002, forPatId: 200, ... }
///     2003: patsAnon2003,  // = { id: 2003, forPatId: 200, ... }
///     2004: patsAnon2004,  // = { id: 2004, forPatId: 200, ... }
///   },
///   sameThread: [
///     patsAnon2002,  // pat's anon (or pat henself) who made pat's last comment
//                     // in the path from  startAtPostNr, back to the orig post.
///     patHenself,    // here pat posted using hens real account (not anonymously)
///     patsAnon2001,  // pat upvoted a comment using anon 2001, along this path
///   ],
///   outsideThread: [
///     // If pat has posted earlier in the thread (closer to the orig post), using
///     // any of the above (anon 2002, 2001, or as henself), those comments are
///     // ignored: we don't add an anon more than once to the list.)
///
///     patsAnon2004, // Pat replied elsewhere on the page using hens anon 2004
///     patsAnon2003, // ... and before that, han posted as anon 2003, also
///                   //     elsewhere on the same page.
///   ]
/// }
///
/// In the above example, patsAnon2003 didn't post anything in the thread from
/// startAtPostNr up to the orig post — but that anon did post something,
/// *elsewhere* in the same discussion. So that anon is still in the list of anons
/// pat might want to use again, on this page.
///
export function disc_findAnonsToReuse(discStore: DiscStore, ps: {
            forWho: Pat | Me | U, startAtPostNr?: PostNr }): MyPatsOnPage {

  const result: MyPatsOnPage = {
    sameThread: [],
    outsideThread: [],
    byId: {},
  };

  const forWho: Pat | Me | U = ps.forWho;
  if (!forWho)
    return result;

  const forWhoId: PatId = ps.forWho.id;
  const curPage: Page | U = discStore.currentPage;

  if (!forWhoId || !curPage)
    return result;

  // ----- Same thread

  // Find out if pat was henself, or was anonymous, in any earlier posts by hen,
  // in the path from ps.startAtPostNr and back towards the orig post.
  // (patsAnon2002, patHenself, and patsAnon2001 in the example above (i.e. in
  // the docs comment to this fn)).

  const startAtPost: Post | U = ps.startAtPostNr && curPage.postsByNr[ps.startAtPostNr];
  const nrsSeen = {};
  let myVotesByPostNr: { [postNr: PostNr]: Vote[] } = {};

  const isMe = pat_isMe(forWho);
  if (isMe) {
    myVotesByPostNr = forWho.myDataByPageId[curPage.pageId]?.votesByPostNr || {};
  }
  else {
    die('TyE0MYVOTS'); // [_must_be_me]
  }

  let nextPost: Post | U = startAtPost;
  const myAliasesInThread = [];

  for (let i = 0; i < StructsAndAlgs.TooLongPath && nextPost; ++i) {
    // Cycle? (Would be a bug somewhere.)
    if (nrsSeen[nextPost.nr])
      break;
    nrsSeen[nextPost.nr] = true;

    // Bit dupl code:  [.find_anons]

    // We might have added this author, already.
    if (result.byId[nextPost.authorId])
      continue;

    const author: Pat | U = discStore.usersByIdBrief[nextPost.authorId];
    if (!author)
      continue; // would be a bug somewhere, or a rare & harmless race? Oh well.

    const postedAsSelf = author.id === forWhoId;
    const postedAnonymously = author.anonForId === forWhoId;

    if (postedAsSelf || postedAnonymously) {
      // This places pat's most recently used anons first.
      myAliasesInThread.push(author);
      result.byId[author.id] = author;
    }
    else {
      // This comment is by someone else. If we've voted anonymously, let's
      // continue using the same anonym. Or using our main user account, if we've
      // voted not-anonymously.
      const votes: Vote[] = myVotesByPostNr[nextPost.nr] || [];
      for (const myVote of votes) {
        // If myVote.byId is absent, it's our own vote (it's not anonymous). [_must_be_me]
        const voterId = myVote.byId || forWho.id;
        // Have we added this alias (or our real account) already?
        if (result.byId[voterId])
          continue;
        const voter: Pat = discStore.usersByIdBrief[voterId];
        myAliasesInThread.push(voter);
        result.byId[voter.id] = voter;
      }
    }

    nextPost = curPage.postsByNr[nextPost.parentNr];
  }

  // ----- Same page

  // If pat posted outside [the thread from the orig post to ps.startAtPostNr],
  // then include any anons pat used, so Pat can choose to use those anons, now
  // when being active in sub thread startAtPostNr.  (See patsAnon2003 and patsAnon2004
  // in this fn's docs above.)

  // Sleeping BUG:, ANON_UNIMPL: What if it's a really big page, and we don't have
  // all parts here, client side?  Maybe this ought to be done server side instead?
  // Or the server could incl all one's anons on the current page, in a list  [fetch_alias]

  const myAliasesOutsideThread: Pat[] = [];

  _.forEach(curPage.postsByNr, function(post: Post) {
    if (nrsSeen[post.nr])
      return;

    // Bit dupl code:  [.find_anons]

    // Each anon pat has used, is to be included at most once.
    if (result.byId[post.authorId])
      return;

    const author: Pat | U = discStore.usersByIdBrief[post.authorId];
    if (!author)
      return;

    const postedAsSelf = author.id === forWhoId;
    const postedAnonymously = author.anonForId === forWhoId;

    if (postedAsSelf || postedAnonymously) {
      myAliasesOutsideThread.push(author);
      result.byId[author.id] = author;
    }
  });

  _.forEach(myVotesByPostNr, function(votes: Vote[], postNrSt: St) {
    if (nrsSeen[postNrSt])
      return;

    for (const myVote of votes) {
      // The voter is oneself or one's anon or pseudonym. [_must_be_me]
      const voterId = myVote.byId || forWho.id;

      if (result.byId[voterId])
        return;

      const voter: Pat | U = discStore.usersByIdBrief[voterId];  // [voter_needed]
      if (!voter)
        return;

      myAliasesOutsideThread.push(voter);
      result.byId[voter.id] = voter;
    }
  });


  // Sort, newest first. Could sort votes by voted-at, not the comment posted-at — but
  // doesn't currently matter, not until [many_anons_per_page].
  // Old — now both comments and votes, so won't work:
  //myPostsOutsideThread.sort((p: Post) => -p.createdAtMs);
  //const myPatsOutside = myPostsOutsideThread.map(p => discStore.usersByIdBrief[p.authorId]);

  // ----- The results

  result.sameThread = myAliasesInThread;
  result.outsideThread = myAliasesOutsideThread;

  return result;
}



//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
