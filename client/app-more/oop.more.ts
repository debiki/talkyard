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

/// <reference path="../editor-prelude.editor.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.editor {
//------------------------------------------------------------------------------


/// disc_findAnonsToReuse()
///
/// If pat is posting a reply anonymously, then, if hen has posted earlier
/// anonymously on the same page, usually hen wants hens new reply, to be
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
///   byThreadLatest: [
///     patsAnon2002,  // pat's anon (or pat henself) who made pat's last comment
//                     // in the path from  startAtPostNr, back to the orig post.
///     patHenself,    // here pat posted using hens real account (not anonymously)
///     patsAnon2001,  // pat also commented using anon 2001, along this path
///
///     // If pat has posted earlier in the thread (closer to the orig post), using
///     // any of the above (anon 2002, 2001, or as henself), those comments are
///     // ignored: we don't add an anon more than once to the list.)
///
///     patsAnon2004, // Pat replied elsewhere on the page using hens anon 2004
///     patsAnon2003, // ... and before that, hen posted as anon 2003, also
///                   //     elsewhere on the same page.
///
///     // The caller cannot tell if the anons were used in the thread (the first 3)
///     // or elsewhere on the page (the last 2) — currently doesn't matter,
///     // as long as the order is right.
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
  const forWhoId: PatId = ps.forWho && ps.forWho.id;
  const curPage: Page | U = discStore.currentPage;
  const result: MyPatsOnPage = { byThreadLatest: [], byId: {} };
  if (!forWhoId || !curPage)
    return result;

  // ----- Same thread

  // Find out if pat was henself, or was anonymous, in any earlier posts by hen,
  // in the path from ps.startAtPostNr and back towards the orig post.
  // (patsAnon2002, patHenself, and patsAnon2001 in the example above (i.e. in
  // the docs comment to this fn)).

  const startAtPost: Post | U = ps.startAtPostNr && curPage.postsByNr[ps.startAtPostNr];
  const nrsSeen = {};
  let nextPost: Post | U = startAtPost;
  const myPatsInThread = [];

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
      myPatsInThread.push(author);
      result.byId[author.id] = author;
    }
    else {
      // This comment is by someone else.
    }

    nextPost = curPage.postsByNr[nextPost.parentNr];
  }

  // ----- Same page

  // If pat posted outside [the thread from the orig post to ps.startAtPostNr],
  // then include any anons pat used, so Pat can choose to use those anons, now
  // when being active in sub thread startAtPostNr.  (See patsAnon2003 and patsAnon2004
  // in this fn's docs above.)

  const myPostsOutsideThread: Post[] = [];

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
      myPostsOutsideThread.push(post);
      result.byId[author.id] = author;
    }
  });

  // Sort, most recent first.
  myPostsOutsideThread.sort((p: Post) => -p.createdAtMs);
  const myPatsOutside = myPostsOutsideThread.map(p => discStore.usersByIdBrief[p.authorId]);

  // ----- Join results

  // This places [anons for pat's most recent comments in the thread] first, followed
  // by pat's other anons, by time (more recent first).
  result.byThreadLatest = [...myPatsInThread, ...myPatsOutside];

  return result;
}



//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
