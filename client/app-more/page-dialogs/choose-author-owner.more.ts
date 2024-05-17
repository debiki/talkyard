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
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/// <reference path="../more-prelude.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.anon {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const DropdownModal = utils.DropdownModal;
const ExplainingListItem = util.ExplainingListItem;


export function maybeChooseModAlias(ps: MaybeChooseAnonPs, then?: (res: ChoosenAnon) => V) {
  const page: Page = ps.store.currentPage;
  dieIf(!page, 'TyE56032MWJ');
  const post = page.postsByNr[ps.postNr || BodyNr];
  const author = ps.store.usersByIdBrief[post.authorId];
  const me: Me = ps.store.me;

  const postedAsSelf = author.id === me.id;
  const postedAsAlias = author.anonForId === me.id;

  // ANON_UNIMPL  Might want to do anonymously, or using a pseudonym, regardless
  // of history.  [alias_mode]
  if (!postedAsSelf && !postedAsAlias) {
    // Ask the server for any existing anon, or create a new one?
    // But for now, continue as oneself (don't use an alias) — only works if is
    // mod or admin, otherwise the server will return a permission error. [anon_mods]
    then({ doAsAnon: false, myAliasOpts: [false] });
  }
  else {
    // [deanon_risk] Might not want to do mod-only things using an anonym that has
    // also posted comments (so won't show that that anon is a mod).
    const anyAlias = postedAsSelf
        ? false
        : { sameAnonId: author.id, anonStatus: author.anonStatus } as SameAnon;

    then({ doAsAnon: anyAlias, myAliasOpts: [anyAlias] })
  }
}



/// Figures out which alias to use (if any), when replying, voting, editing one's
/// page, etc. Uses the same anon as most recently in the same sub thread, if any,
/// otherwise the same as elsewhere on the page. ANON_UNIMPL:  But if a moderator does sth
/// only mods may do, creates a new anon for moderator actions (to not show that
/// any anon used for comments, is a moderator). [anon_mods]
/// [alias_mode] If one is in e.g. Anon Mode, does things anonymously if allowed,
/// or pops up a dialog and says it's not allowed here (e.g. this category).
///
/// Later: if `then` specified, might ask the server to suggest which alias to
/// use and/or pop up a dialog. Otherwise, suggests something directly
/// (which can be good, if opening the editor — there's an alias dropdown there,
/// so can change later, no need for another dialog).
///
export function maybeChooseAnon(ps: MaybeChooseAnonPs, then?: (_: ChoosenAnon) => V)
      : ChoosenAnon {

  const discStore: DiscStore = ps.store;
  const postNr: PostNr | U = ps.postNr;
  const discProps: DiscPropsDerived = ps.discProps || page_deriveLayout(
          discStore.currentPage, discStore, LayoutFor.PageNoTweaks);

  const myAliasesHere: MyPatsOnPage | U = postNr && disc_findAnonsToReuse(discStore, {
          forWho: discStore.me, startAtPostNr: postNr });

  const anonsAllowed = discProps.comtsStartAnon >= NeverAlways.Allowed;
  const anonsRecommended = discProps.comtsStartAnon >= NeverAlways.Recommended;

  // When someone starts posting on the relevant page, must they be anonymous?
  const mustBeAnon = discProps.comtsStartAnon >= NeverAlways.AlwaysButCanContinue;

  // It is ok to *continue* posting using one's real account, on
  // this page, if  comments-start-anon is  Always-**But-Can-Continue**  posting
  // using one's real name.
  const canContinueAsSelf =
          discProps.comtsStartAnon <= NeverAlways.AlwaysButCanContinue;

  // @ifdef DEBUG
  dieIf(mustBeAnon, "Unimpl: mustBeAnon [TyE602MKG1]");
  dieIf(!canContinueAsSelf, "Unimpl: !canContinueAsSelf [TyE602MKG2]");
  dieIf(anonsAllowed && discProps.newAnonStatus === AnonStatus.NotAnon, "TyE6@NJ04");
  // @endif

  if (myAliasesHere &&
        !myAliasesHere.sameThread.length &&
        myAliasesHere.outsideThread.length >= 2) {
    // UX: ask which alias to use? [choose_alias]   unless it's clear from any
    // current [alias_mode] which one to use.  ANON_UNIMPL
    // Pat has commented or voted using two or more different aliases, or hans real
    // account and an alias, on this page, but not in this thread. — Then, hard to know
    // which alias han wants to continue using.
    // If asking, and pat wants to use hans real name, maybe show an extra
    // "Use your real name? (That is, @your_username)  [yes / no]"  dialog?
    //
    // For now, default to doing things anonymously if pat has been anon
    // anywhere on this page.
    // So:  noop()   here, for now.
  }

  // The user accounts the current has used on this page — first looking higher up in
  // the same sub thread, then looking at the whole page.
  const patsByThreadThenLatest = !myAliasesHere ? [] :
          [...myAliasesHere.sameThread, ...myAliasesHere.outsideThread];

  // Only looking at the same sub thread (parent comment, grandparent etc).
  const lastPatSameThread: Pat | U = myAliasesHere?.sameThread[0];

  const lastAnonPat: Pat | U = patsByThreadThenLatest.find(p => p.isAnon);
  const lastAnon: WhichAnon | N = !lastAnonPat ? null :
              { sameAnonId: lastAnonPat.id, anonStatus: lastAnonPat.anonStatus } as SameAnon;

  const doAsAnon: WhichAnon | false = !patsByThreadThenLatest.length
      ? (
        // We haven't posted or voted on this page before.
        // Create a new anonym, iff recommended.
        anonsRecommended
              ? { newAnonStatus: discProps.newAnonStatus } as NewAnon
              : false  // don't do as anon, use real account
        )
      : (
        // We have posted on this page before. But in the same sub thread?
        lastPatSameThread
              ? (
                // Continue using our earlier account, from the same sub thread.
                // (Either an anonym, or ourself.)
                lastPatSameThread.isAnon ? lastAnon : false)
              :
                // If we've posted or commented anonymously anywhere else
                // on the page, continue anonymously.
                // Otherwise, continue using our real name (since we've used our
                // real name previously, on this page).
                // Here, could make sense to explicitly [choose_alias] or derive
                // based on the [alias_mode].
                lastAnon || false
        );

  // Even if we'll by default continue as ourself (!doAsAnon), we might need an anonym
  // to show in the ChooseAnonModal dropdown.
  const anyAnon = doAsAnon || lastAnon ||
          anonsAllowed && ({ newAnonStatus: discProps.newAnonStatus } as NewAnon);

  // Distant future: [pseudonyms_later]
  // const anyPseudonyms: WhichPseudonym[] = ...
  // and also a way to:
  //    openCreatePseudonymsDialog(..) ?
  //  — there could be a Create Pseudonym button?

  const res: ChoosenAnon = {
    doAsAnon,
    myAliasOpts: anyAnon
          ? [false, anyAnon]  // options are: ourself, or the anonym `anyAnon`
          : [false],          // option is: we can only be ourself
  };

  if (then) {
    then(res);
  }
  return res;
}


let setStateExtFn: (_: ChooseAnonDlgPs) => Vo;

export function openAnonDropdown(ps: ChooseAnonDlgPs) {
  if (!setStateExtFn) {
    ReactDOM.render(ChooseAnonModal(), utils.makeMountNode());  // or [use_portal] ?
  }
  setStateExtFn(ps);
}


/// Some dupl code? [6KUW24]  but this with React hooks.
///
///  Or use instead:  client/app-more/page-dialogs/add-remove-people-dialogs.more.ts  ?
///  Or maybe have this dialog, use that dialog,
///       via a  As someone else ...   button — and then one could use one's pen name,
///       if any?
///
///
const ChooseAnonModal = React.createFactory<{}>(function() {
  //displayName: 'ChooseAnonModal',

  // TESTS_MISSING

  const [state, setState] = React.useState<ChooseAnonDlgPs | N>(null);

  setStateExtFn = setState;

  const atRect: Rect = (state?.atRect || {}) as Rect;
  const isOpen = state && state.open;

  function close() {
    setState(null);
  }

  let items: RElm[] = [];

  if (isOpen) {
    const me: Me = state.me;
    const pat: Pat | U = state.pat;

    const makeItem = (whichAnon: MaybeAnon): RElm => {
      const title = whichAnon_title(whichAnon, { me, pat });
      const text = whichAnon_descr(whichAnon, { me, pat });
      const active =
          // `whichAnon` and `state.curAnon` can be false, or a WhichAnon object.
          any_isDeepEqIgnUndef(whichAnon, state.curAnon);
      const status = whichAnon && (whichAnon.anonStatus || whichAnon.newAnonStatus);
      return (
          ExplainingListItem({
            title, text, active, key: whichAnon ? whichAnon.sameAnonId || 'new' : 'self',
            className:
                !whichAnon ? 'e_AsSelfB' : (
                status === AnonStatus.IsAnonCanAutoDeanon ? 'e_AnonTmpB' : (
                status === AnonStatus.IsAnonOnlySelfCanDeanon ? 'e_AnonPrmB' : (
                die(JSON.stringify(whichAnon) + ' [TyEUNKANST]')))),
            onSelect: () => {
              state.saveFn(whichAnon);
              close();
            },
          }));
    }

    items = state.myAliasOpts.map(makeItem);
  }

  return (
      DropdownModal({ show: isOpen, onHide: close, atX: atRect.left, atY: atRect.top,
          pullLeft: true, showCloseButton: true },
        r.div({ className: 's_ExplDrp_Ttl' }, "Post ..."),  // I18N
        items,
        ));
});


export function whichAnon_titleShort(doAs: MaybeAnon, ps: { me: Me, pat?: Pat }): RElm {
  // (TitleShort always gives us a RElm (not a string) with an e2e test class.)
  return whichAnon_titleDescrImpl(doAs, ps, TitleDescr.TitleShort) as RElm;
};


export function whichAnon_title(doAs: MaybeAnon, ps: { me: Me, pat?: Pat }): St | RElm {
  return whichAnon_titleDescrImpl(doAs, ps, TitleDescr.TitleLong);
};


export function whichAnon_descr(doAs: MaybeAnon, ps: { me: Me, pat?: Pat }): St | RElm {
  return whichAnon_titleDescrImpl(doAs, ps, TitleDescr.DescrLong);
};


const enum TitleDescr {
  TitleShort = 1,
  TitleLong = 2,
  DescrShort = 3,
  DescrLong = 4,
}


function whichAnon_titleDescrImpl(doAs: MaybeAnon, ps: { me: Me, pat?: Pat },  // I18N
        what: TitleDescr): St | RElm {
  const anonStatus = doAs ? doAs.anonStatus || doAs.newAnonStatus : AnonStatus.NotAnon;
  // UX SHOULD if doAs.sameAnonId, then, show which anon (one might have > 1 on the
  // same page) pat will continue posting as / using.
  // But not a hurry? Right now one cannot have more than one anon per
  // page? [many_anons_per_page]

  switch (anonStatus) {
    case AnonStatus.IsAnonCanAutoDeanon: {
      switch (what) {
        case TitleDescr.TitleShort:
        case TitleDescr.TitleLong:
          return rFr({},
              // To capitalize via CSS, where needed.
              r.span({ className: 'n_TtlCap e_AnonTmp',
                  // It's good to never let this be bold — so "temporarily" below
                  // becomes more prominent.
                  style: { fontWeight: 'normal' }}, "anonymously, "),
              // It's important (I think) to incl "temporarily", if the anon
              // can/will get deanonymized later.
              r.b({}, "temporarily"));
        default:
          // TitleDescr.DescrShort and Long:
          return rFr({}, r.i({}, "For a while: "), nameNotShownEtc,
              r.b({}, " Later"), ", everyone's ", r.b({}, "real"), " user ",
              r.b({}, "names"), " will (might) get ", r.b({}, "shown"), ".");
      }
    }

    case AnonStatus.IsAnonOnlySelfCanDeanon: {
      switch (what) {
        case TitleDescr.TitleShort:
        case TitleDescr.TitleLong:
          return r.span({ className: 'n_TtlCap e_AnonPrm' }, "anonymously");
        default:
          // TitleDescr.DescrShort and Long:
          return nameNotShownEtc;
      }
    }

    default: {
      // Not anonymously.
      switch (what) {
        case TitleDescr.TitleShort:
          return r.span({ className: 'e_AsSelf' }, "as " + pat_name(ps.pat || ps.me));
        case TitleDescr.TitleLong:
          const pat = ps.pat;
          return pat ? "As " + pat_name(pat)
                    : "As you, " + pat_name(ps.me);
        default:
          // TitleDescr.DescrShort and Long:
          return "Others can see who you are — they'll see your username and picture.";
      }
    }
  }
}


const nameNotShownEtc =  // I18N
        "Your name and picture won't be shown. " +
        "Admins and moderators can still check who you are, though.";


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
