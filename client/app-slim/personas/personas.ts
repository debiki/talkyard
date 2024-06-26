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

/// <reference path="../prelude.ts" />

//------------------------------------------------------------------------------
   namespace debiki2 {
//------------------------------------------------------------------------------


/// disc_findMyPersonas()
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
export function disc_findMyPersonas(discStore: DiscStore, ps: {
            forWho: Pat | Me | U, startAtPostNr?: PostNr }): MyPersonasThisPage {

  const result: MyPersonasThisPage = {
    sameThread: [],
    outsideThread: [],
    byId: {},
  };

  const forWho: Pat | Me | U = ps.forWho;
  if (!forWho || !forWho.id)
    return result;

  const curPage: Page | U = discStore.currentPage;
  if (!curPage)
    return result;

  // ----- Same thread

  // Find out if pat was henself, or was anonymous, in any earlier posts by hen,
  // in the path from ps.startAtPostNr and back towards the orig post.
  // (patsAnon2002, patHenself, and patsAnon2001 in the example above (i.e. in
  // the docs comment to this fn)).
  // (Much later: Should fetch from server, if page big – an 999 comments long thread
  // – maybe not all comments in the middle were included by the server?  [fetch_alias])

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

    // Bit dupl code:  [_find_anons]

    // We might have added this author, already.
    if (result.byId[nextPost.authorId])
      continue;

    const author: Pat | U = discStore.usersByIdBrief[nextPost.authorId];
    if (!author)
      continue; // would be a bug somewhere, or a rare & harmless race? Oh well.

    const postedAsSelf = author.id === forWho.id;
    const postedAnonymously = author.anonForId === forWho.id;

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
        // Sometimes voters are lazy-created and added. Might be some bug. [lazy_anon_voter]
        // @ifdef DEBUG
        dieIf(!voter, `Voter ${voterId} missing [TyE502SRKJ5]`);
        // @endif
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

    // Bit dupl code:  [_find_anons]

    // Each anon pat has used, is to be included at most once.
    if (result.byId[post.authorId])
      return;

    const author: Pat | U = discStore.usersByIdBrief[post.authorId];
    if (!author)
      return;

    const postedAsSelf = author.id === forWho.id;
    const postedAnonymously = author.anonForId === forWho.id;

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



/// Makes a list of personas pat can use, for replying or voting. The first
/// item in the list is the one to use by default, and if it's unclear what
/// pat might want, sets `PersonaOptions.isAmbiguous` in the response to true.
///
/// Ambiguity matrix:
///
///   D = the persona in the left column is automatically used (has priority).
///   d = We'll ask which persona pat wants to use, and this persona (the one in
///       the left column) is the default, listed first.
///       Not totally implemented for the editor though?
///   - = ignored, doesn't have priority
///   A = ambiguous, should ask the user
///  (AP = ambiguous, should ask and update the Preferred-persona-on-page.
///       But not implemented – means A instead, for now.)
///
///                              None Thread (PrfOnP) Page  Recom   Pers Mode
///                         None  n/a      -      -      -      -      -
///            Persona in Thread*   D    n/a      A      d      D      d
///  (Preferred Persona on Page)**  D      d    n/a      D      D      d
///              Persona on Page    D      -      -    n/a      D      A
///          Recommended Persona    d      -      -      -     n/a     -
///         Persona mode persona    D      A      A      A      D    n/a
///
///   * "Persona in Thread" means that pat has replied or voted earlier in the same
///     page, same sub thread, as that persona. Example:
///
///       A comment by Alice
///       `—> A comment by this user as anonym A   <—— this persona (anonym A) is in
///           |                                        `MyPersonasThisPage.sameThread`
///           `—> A comment by Bob
///               `—> Here our user starts replying to Bob,
///                   and findPersonaOptions() gets called.
///                   Our user likely wants to reply as anonym A again.
///       Some other comment, same page but not same sub thread
///       `—> A reply
///           `——> A comment by our      <— this persona (the user hanself) is
///                user, as hanself         in  `MyPersonasThisPage.outsideThread`, and
///                                         that's "Persona on Page" in the table above
///
///   ** "Preferred Persona on Page" is if in the future it'll be possible to
///      remember "Always use this persona, on this page" — so won't have to choose,
///      repeatedly. But maybe that's just an over complicated idea.
///
export function findPersonaOptions(ps: {
        // Missing, if on a forum homepage (no discussions directly on such pages).
        myPersonasThisPage?: MyPersonasThisPage,
        me: Me,
        // Missing, if on an auto generated page (rather than a discussion page).
        // Would be good with site-default props [site_disc_props] instead of `undefined`.
        discProps?: DiscPropsDerived,
        }): PersonaOptions {

  const dp: DiscPropsDerived | U = ps.discProps;
  const anonsAllowed = dp && dp.comtsStartAnon >= NeverAlways.Allowed;
  const anonsRecommended = dp && dp.comtsStartAnon >= NeverAlways.Recommended;
  //nst pseudonymsRecommended = false; // [pseudonyms_later]
  const mustBeAnon = dp  && dp.comtsStartAnon >= NeverAlways.AlwaysButCanContinue;
  const newAnonStatus = dp && dp.newAnonStatus;
  const selfRecommended = !anonsRecommended; // later: dp.comtsStartAnon <= AllowedMustChoose

  // @ifdef DEBUG
  dieIf(anonsAllowed && !newAnonStatus, `[TyE4WJE281]`);
  dieIf(anonsRecommended && !anonsAllowed, `[TyE4WJE282]`);
  dieIf(mustBeAnon && !anonsRecommended, `[TyE4WJE282]`);
  // @endif

  const myPersThisPage: MyPersonasThisPage | U = ps.myPersonasThisPage;
  const me = ps.me;

  const result: PersonaOptions = { isAmbiguous: false, optsList: [] };
  let selfAdded = false;
  let anonFromPropsAdded = false;
  let modePersonaAdded = false;
  let recommendedAdded = false;

  // ----- Personas from the current discussion

  if (!myPersThisPage) {
    // We're on a forum homeage, or user profile page, or sth like that, which
    // itself has no discussions or comments.
  }
  else {
    // We're on some discussion page, with comments, authors, votes.

    // Same sub thread has priority – so we continue replying as the same person,
    // won't become sbd else in the middle of a thread.
    for (let ix = 0; ix < myPersThisPage.sameThread.length; ++ix) {
      const pat = myPersThisPage.sameThread[ix];
      const opt: PersonaOption = {
        alias: pat,
        doAs: patToMaybeAnon(pat, me),
        // The first item is who pat most recently replied or voted as, in the relevant sub thread.
        isBestGuess: ix === 0,
        inSameThread: true,
      }
      initOption(opt);
      result.optsList.push(opt);
    }

    // Thereafter, elsewhere on the same page, but not in the same sub thread.
    for (let ix = 0; ix < myPersThisPage.outsideThread.length; ++ix) {
      const pat = myPersThisPage.outsideThread[ix];
      const opt: PersonaOption = {
        alias: pat,
        doAs: patToMaybeAnon(pat, me),
        isBestGuess:
            !myPersThisPage.sameThread.length &&
            // If pat has commented using different aliases on this page, we can't
            // know which one is the best guess?  Maybe the most recently used one?
            // Or the most frequently used one? Who knows.
            myPersThisPage.outsideThread.length === 1,
        onSamePage: true,
      }
      initOption(opt);
      result.optsList.push(opt);
    }
  }

  // ----- Persona mode

  // The user might be in e.g. anon mode also on pages without any discussions.

  if (me.usePersona && !modePersonaAdded) {
    let opt: PersonaOption;
    if (me.usePersona.self) {
      opt = {
        alias: me,
        doAs: false, // not anon, be oneself [oneself_0_false]
        isFromMode: true,
        isSelf: true,
      };
      if (mustBeAnon) {
        opt.isNotAllowed = true;
      }
      if (selfRecommended) {
        opt.isRecommended = true;
        recommendedAdded = true;
      }
      selfAdded = true;
    }
    else if (me.usePersona.anonStatus) {
      // Since not added above (!modePersonaAdded), this'd be a new anon.
      const anonStatus = me.usePersona.anonStatus;
      const anonPat = anon_create({ anonStatus, anonForId: me.id });
      opt = {
        alias: anonPat,
        doAs: patToMaybeAnon(anonPat, me),
        isFromMode: true,
      };
      if (!anonsAllowed) {
        opt.isNotAllowed = true;
      }
      if (anonStatus === newAnonStatus) {
        if (anonsRecommended) {
          opt.isRecommended = true;
          recommendedAdded = true;
        }
        opt.isFromProps = true;
        anonFromPropsAdded = true;  // [dif_anon_status]
      }
    }
    else {
      // [pseudonyms_later] ?
    }

    result.optsList.push(opt);
  }

  // Are there more than two persona options? Then we don't know which one to use.
  //
  // (We ignore additional options added below. Only any Persona Mode option (added above),
  // and personas pat has been on the current page (also added above), can make us unsure
  // about who pat wants to be now.  But not just because anonymity or posting as oneself
  // is the default / recommended on the page.)
  //
  result.isAmbiguous = result.optsList.length >= 2;

  // Add Anonymous as an option, if not done already.
  if (!anonFromPropsAdded && anonsAllowed) {
    const anonPat = anon_create({ anonStatus: newAnonStatus, anonForId: me.id });
    const opt: PersonaOption = {
      alias: anonPat,
      doAs: patToMaybeAnon(anonPat, me),
    };
    if (!recommendedAdded && anonsRecommended) {
      // (It's the recommended type of anon — we created it with newAnonStatus just above.)
      opt.isRecommended = true;
      recommendedAdded = true;
    }
    result.optsList.push(opt);

    // If not in alias mode, maybe it's good to tell the user that han can be anonymous
    // if han wants? – No, this feels just annoying. If someone started commenting
    // on a page as hanself, then it's pretty pointless to suddenly have han replaced by
    // "Anon 123" in subsequent comments, when "everyone" can guess who Anon 123 is anyway.
    // if (ambiguities2.aliases.length >= 2 && !me.usePersona && anonsRecommended) {
    //   ambiguities2.isAmbiguous = true;
    // }
  }

  // Add oneself as an option, if not done already. (But don't consider this an ambiguity.)
  if (!selfAdded && !mustBeAnon) {
    const opt: PersonaOption = {
      alias: me,
      doAs: false, // not anon [oneself_0_false]
      isSelf: true,
    };
    if (!recommendedAdded && selfRecommended) {
      opt.isRecommended = true;
      recommendedAdded = true;
    }
    result.optsList.push(opt);
  }

  result.optsList.sort((a: PersonaOption, b: PersonaOption) => {
    if (a.isNotAllowed !== b.isNotAllowed)
      return a.isNotAllowed ? +1 : -1; // place `a` last

    if (a.isBestGuess !== b.isBestGuess)
      return a.isBestGuess ? -1 : +1; // place `a` first

    if (a.isFromMode !== b.isFromMode)
      return a.isFromMode ? -1 : +1;

    if (a.isRecommended !== b.isRecommended)
      return a.isRecommended ? -1 : +1;

    if (a.isSelf !== b.isSelf)
      return a.isSelf ? -1 : +1;
  })

  function initOption(opt: PersonaOption) {
    const pat: Pat = opt.alias;
    const isMe = pat.id === me.id;
    const isAnonFromProps = pat.anonStatus && pat.anonStatus === newAnonStatus;

    if (isMe) {
      opt.isSelf = true;
      selfAdded = true;
      result.hasBeenSelf = true;
    }

    if (pat.isAnon) {
      // (opt.isAnon not needed —  opt.alias.isAnon is enough.)
      if (isAnonFromProps) {
        opt.isFromProps = true;
        anonFromPropsAdded = true;  // [dif_anon_status]
      }
      result.hasBeenAnon = true;
    }

    // if (...) [pseudonyms_later]

    // Is the same persona as any current Persona Mode?
    if (me.usePersona) {
      const isSelfFromMode = me.usePersona.self && isMe;
      const isAnonFromMode = me.usePersona.anonStatus === pat.anonStatus && pat.anonStatus;
      if (isSelfFromMode || isAnonFromMode) {
        opt.isFromMode = true;
        modePersonaAdded = true;
      }
    }

    // Any persona mode anonym, might not be of the recommended anonymity status. [dif_anon_status]
    // But one from the category properties, would be.
    if ((isAnonFromProps && anonsRecommended) || (isMe && selfRecommended)) {
      opt.isRecommended = true;
      recommendedAdded = true;
    }

    if ((pat.isAnon && !anonsAllowed) || (isMe && mustBeAnon)) {
      opt.isNotAllowed = true;
    }
  }

  return result;
}


export function patToMaybeAnon(p: Pat | KnownAnonym | NewAnon, me: Me): MaybeAnon {
  if ((p as WhichAnon).createNew_tst) {
    // Then `p` is a WhichAnon already, not a Pat.
    return p as NewAnon;
  }

  const pat = p as Pat;

  if (pat.id === me.id) {
    return false; // means not anon, instead, oneself [oneself_0_false]
  }
  else if (pat.id === Pats.FutureAnonId) {
    // Skip `NewAnon.createNew_tst` for now. [one_anon_per_page]
    return { anonStatus: pat.anonStatus, lazyCreate: true } satisfies LazyCreatedAnon;
  }
  else {
    return { anonStatus: pat.anonStatus, sameAnonId: pat.id } as SameAnon;
  }
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
