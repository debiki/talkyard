/*
 * Copyright (c) 2024 Kaj Magnus Lindberg
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
/// <reference path="../morekit/proxy-diag.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.persona {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const DropdownModal = utils.DropdownModal;
const ExplainingListItem = util.ExplainingListItem;


/// Figures out, or asks, what persona to use when editing a post.  [choose_persona]
///
/// Ensures pat will continue using the same persona, when editing a post, as when
/// creating it. E.g. if posting a question, and later on, accepting an answer.
/// 
/// If pat were to use a different persona when editing a post of hans,
/// others might guess that the two personas (pat, and hans alias)
/// are in fact the same (sine they were able to edit the same thing). [deanon_risk]
/// (E.g. pat creates a page anonymously, and then edits it as hanself,
/// without being a moderator. This function makes sure han will instead
/// reuse the anonym, when editing the page.)
/// 
/// If a moderator edits someone else's page, then, if han uses a persona
/// (e.g. a pseudonym), others might guess that that persona is a moderator
/// (since that persona was able to edit other's posts).
/// And that's no good. So, for now, one can't use an alias when altering
/// someone else's page — one has to do that as oneself. [deanon_risk]
/// Later on, if a moderator really wants to alter sbd elses page using
/// an alias, maybe that should by default be a different alias, e.g.
/// a new anonym, than what they use if they're part of the discussion
/// on the page and trying to be anonymous. [anon_mods]
///
/// If trying to do sth not-allowed, shows an error dialog and won't call `then`.
///
export function chooseEditorPersona(ps: ChooseEditorPersonaPs, then?: (res: DoAsAndOpts) => V) {

  // TESTS_MISSING  TyTALIALTERPG

  const page: Page = ps.store.currentPage;
  dieIf(!page, 'TyE56032MWJ');
  const post = page.postsByNr[ps.postNr || BodyNr];
  const author = ps.store.usersByIdBrief[post.authorId];
  const me: Me = ps.store.me;

  const dp: DiscPropsDerived | U = ps.store.curDiscProps;

  const pseudonymsAllowed = false; // [pseudonyms_later]
  const anonsAllowed = dp && dp.comtsStartAnon >= NeverAlways.Allowed;
  const mustBeAnon = dp && dp.comtsStartAnon >= NeverAlways.AlwaysButCanContinue;

  const switchedToPseudonym = false; // [pseudonyms_later]
  const switchedToAnonym = me.usePersona && !!me.usePersona.anonStatus;
  const switchedToSelf = me.usePersona && me.usePersona.self;

  const postedAsSelf = author.id === me.id;
  const postedAsAlias = author.anonForId === me.id;

  if (!postedAsSelf && !postedAsAlias) {
    // Ask the server for any existing anon, or create a new one?
    // For now, continue as oneself (don't use an alias) — only works if is
    // pat has `mayEditPage` or `mayEditComment` or `mayEditWiki` permissions,
    // otherwise the server will return a permission error. Later, could create
    // a new anon for any moderator actions (so others can't know that some anonymous
    // comments in the discussion, are by a moderator). [anon_mods]

    if (ps.draft) {
      if (!ps.draft.doAsAnon) {  // [oneself_0_false]
        // Pat has already started editing as hanself —  don't pop up any dialog again.
        editAsSelf();
        return;
      }
      else {
        // Pat started editing using an alias, but that's not supported / allowed.
        // Continue below: Show the info message, and edit as hanself.
      }
    }

    // COULD allow if is wiki  [alias_ed_wiki] [alias_0_ed_others]
    const errMsg: St | N = !mustBeAnon ? null :
          "You cannot edit other people's posts here. This is an anonymous-" +
          "only secttion, but you cannot edit others' posts anonymously, as of now.";
    if (errMsg) {
      morekit.openSimpleProxyDiag({ atRect: ps.atRect, body: rFr({}, errMsg) });
      return;
    }

    const infoMsg: St | N =
        switchedToAnonym ? "You cannot edit other people's posts anonymously" : (
        switchedToPseudonym ? "You cannot edit other people's posts under " +
                                                      "a pseudonymous name" : (
        // For clarity, if it's possible to be anonymous, then require that pat has
        // explicitly chooses to post as hanself.
        // UX COULD [alias_ux] If pat has commented or done sth on/with the
        // page as hanself, then, don't ask, just continue as pat hanself.
        // Look in `store.curPersonaOptions.optsList[0]` — if it's pat hanself
        // (not an alias), and it's also the best guess, the that's enough
        // (set infoMsg to null).
        (anonsAllowed || pseudonymsAllowed) && !switchedToSelf ?
                          "You cannot edit other people's posts anonymously" : (
        // Need not show any message (continue with `editAsSelf()` below).
        null)));
    if (infoMsg) {
      // If it's a one-click thing, like accepting an answer, "Edit post as" is confusing?
      // There's no editor involved. "Do as: ..." is better, right.
      const editAs = ps.isInstantAction ? "Do as" : "Edit post as";  // I18N
      const body = rFr({},
        r.p({}, `${editAs} yourself, ${pat_name(me)}?`),  // I18N
        infoMsg);
      morekit.openSimpleProxyDiag({ atRect: ps.atRect, body,
            primaryButtonTitle: "Yes, do as me",  // I18N
            secondaryButonTitle: t.Cancel,
            onPrimaryClick: () => {
              editAsSelf();
            }});
      return;
    }

    function editAsSelf() {
      // _Only_one_item (`false`) in the list —  must edit as oneself.
      then({ doAsAnon: false, myAliasOpts: [false] });  // [oneself_0_false]
    }

    editAsSelf();
  }
  else {
    // Continue using the same persona, as when creating the page. (See the descr
    // of this fn.)
    const anyAlias: MaybeAnon = postedAsSelf
        ? false  // [oneself_0_false]
        : { sameAnonId: author.id, anonStatus: author.anonStatus } satisfies SameAnon;

    const modeAuthorMismatch =
            postedAsSelf && switchedToAnonym || postedAsAlias && switchedToSelf;

    // If draft author != post author, pat needs to continue editing as the *post author*.
    // (If using the draft author persona, others might guess that that one, and the
    // post author, are the same. For example, if you posted as Anonym A (post author),
    // then somehow managed to save a draft with yourself as author, then, when you resume
    // the draft, you'll be editing as Anon A again, so others can't see that both
    // you and Anon A can edit the same post.) [true_0_ed_alias] [alias_0_ed_others]
    if (ps.draft && isVal(ps.draft.doAsAnon) && ps.draft.doAsAnon !== anyAlias // [oneself_0_false]
          || modeAuthorMismatch) {
      // TESTS_MISSING  TyTDRAFTALI
      // [pseudonyms_later]
      const edit = ps.isInstantAction ? "do" : "edit";
      const asWho = // I18N and below
              anyAlias === false ?  // [oneself_0_false]
                    rFr({}, r.b({}, "yourself"), " (not anonymously)") : (
              anyAlias.anonStatus ?
                    r.b({}, anonStatus_toStr(anyAlias.anonStatus, Verbosity.Full)) :
              "unknown [TyEUNKALI]");  // D_DIE
      // [close_cross_css]
      const body = r.p({ style: { marginRight: '30px' }},
              `You will ${edit} as `, asWho);
      const asMeOrAnon = anyAlias === false ? "as me" : "anonymously";

      morekit.openSimpleProxyDiag({ atRect: ps.atRect, body,
            primaryButtonTitle: `Ok, I'll ${edit} ${asMeOrAnon}`,
            secondaryButonTitle: t.Cancel,
            onPrimaryClick: () => {
              then({ doAsAnon: anyAlias, myAliasOpts: [anyAlias] });
            }});
    }
    else {
      // _Only_one_item (`anyAlias`) in the list.
      then({ doAsAnon: anyAlias, myAliasOpts: [anyAlias] });
    }
  }
}



/// Figures out, or pops up a dialog and asks, which alias to use (if any), when
/// posting comments or pages, or voting ("posting" a vote).  [choose_persona]
///
/// Prefers the same alias as most recently in the same sub thread, if any,
/// Then the same as elsewhere on the page. (See findPersonaOptions().)
/// Then any persona mode alias [alias_mode],  then any per category default persona,
/// e.g. anonymous in anon-by-default cats.
///
/// Later: Might ask the server to suggest which alias to use  [fetch_alias].
///
export function choosePosterPersona(ps: ChoosePosterPersonaPs,
      then?: (_: DoAsAndOpts | 'CANCEL') => V)
      : DoAsAndOpts {

  // @ifdef DEBUG
  dieIf(then && !ps.atRect, "Wouldn't know where to open dialog [TyE70WJE35]");
  // @endif

  // ----- Derive persona options list

  // (We can't use `DiscStore.curPersonaOptions`: We want persona options for the
  // comments thread ending at `ps.postNr`, but `curPersonaOptions` is for the whole
  // page, no specific sub thread.)

  const myPersonasThisPage = disc_findMyPersonas(
          ps.discStore, { forWho: ps.me, startAtPostNr: ps.postNr });
  const personaOpts: PersonaOptions = findPersonaOptions({
          myPersonasThisPage, me: ps.me, discProps: ps.discStore.curDiscProps });

  const res: DoAsAndOpts = {
    doAsAnon: personaOpts ? personaOpts.optsList[0].doAs : false, // [oneself_0_false]
    myAliasOpts: personaOpts ? personaOpts.optsList.map(a => a.doAs) : [false],
  }

  if (ps.draft && isVal(ps.draft.doAsAnon)) {
    addDraftAuthor_inPl(ps.draft, res);
    personaOpts.isAmbiguous = false; // will use the author of the draft
  }

  // ----- Choose persona

  // If we're unsure which alias (if any) the user wants to use, we'll open a dialog
  // and ask.  But if the caller didn't pass any `then()` fn, then, return the
  // result immediately.

  if (!then)
    return res;

  if (personaOpts.isAmbiguous) {
    openChoosePersonaDiag({ atRect: ps.atRect,
          personaOpts, me: ps.me, origins: ps.origins,
          }, then);
  }
  else {
    then(res);
  }
}


/// A next-to-the-button-clicked dialog that asks the user which alias to use,
/// if it's unclear. E.g. han has switched to Anonmous mode, but has commented
/// on the page as hanself already. When posting another comment, does
/// han want to be anonymous (because of Anonymous mode), or continue commenting
/// as hanself?  We'd better ask, not guess.
///
function openChoosePersonaDiag(ps: { atRect: Rect,
        personaOpts: PersonaOptions, me: Me, origins: Origins, },
        then?: (_: (DoAsAndOpts | 'CANCEL')) => V) {
  morekit.openProxyDiag({ atRect: ps.atRect, flavor: DiagFlavor.Dialog,
          onHide: () => { if (then) then('CANCEL'); }, dialogClassName: 'c_' },
          (closeDiag: () => V) => {

    const opts = ps.personaOpts.optsList.map(a => a.doAs);

    function closeAndThen(doAsAnon: MaybeAnon) {
      closeDiag();
      then({ doAsAnon, myAliasOpts: opts });
    }

    let debugJson = null;
    // @ifdef DEBUG
    //debugJson = r.pre({}, JSON.stringify(ps, undefined, 3));
    // @endif

    // (This list might include more than one type of anonymous user, say, 1) temporarily
    // anonymous and 2) permanently anonymous. This can happen if a user U replies as
    // perm anon on a page in a perm anon category. But then an admin moves the page to
    // a temp anon category. Now, user U replies again, but chooses to be temp anon, this
    // time (which is allowed in this different category). [move_anon_page] [dif_anon_status])
    return rFr({},
        r.div({ className: 'esDropModal_header' },
            `Do as ...`),
        r.ol({},
            ps.personaOpts.optsList.map((opt: PersonaOption) => {
              const avatarElm = avatar.Avatar({
                    user: opt.alias, origins: ps.origins, ignoreClicks: true,
                    size: AvatarSize.Small });
              return ExplainingListItem({
                  key: opt.alias.id,
                  title: pat_name(opt.alias),
                  img: avatarElm,
                  text: ambiguityToDescr(opt, ps.me),
                  tabIndex: 100,
                  onClick: () => closeAndThen(opt.doAs),
              });
            })),
        debugJson);
  });
}


function ambiguityToDescr(opt: PersonaOption, me: Me): RElm {
  // UX SHOULD require 2 clicks to choose? At different coordinates. [deanon_risk] [mouse_slip]
  const isMe = opt.alias.id === me.id;
  const selfOrAnon = isMe ? "Yourself" : anonStatus_toStr(  // [pseudonyms_later]  I18N
            opt.alias.anonStatus, Verbosity.Full);
  const selfOrAnonLower = selfOrAnon.toLowerCase();

  const part1 =
      opt.inSameThread ?
          // "Earlier", but not necessarily "above" (as in higher up on the page). Depends
          // on the sort order.
          r.span({}, `You are ${selfOrAnonLower} earlier in this thread`) : (
      opt.onSamePage ?
          r.span({}, `You are ${selfOrAnonLower} elsewhere on this page`) : (
      null));

  let part2 = part1 ? '.' : '';
  if (opt.isFromMode) {
    if (!part1) part2 = `You're in ${selfOrAnon} mode.`;
    else part2 = `, and you're in ${selfOrAnon} mode.`;
  }

  // Skip this — "You're recommended ..." sounds a bit paternalistic?
  // (Would make sense if  [the *recommended* persona] being different from e.g.  [any previously
  // *used* persona] made the choose-persona dialog to appear (`PersonaOptions.isAmbiguous`)
  // —  but that's no longer the case.)
  //if (opt.isRecommended) {
  //  part3 = ` You're recommended to be ${selfOrAnon} here.`;
  //}

  const part4 = part2 || !isMe ? '' : "Yourself";

  const part5 = opt.isNotAllowed ?
      ` However, you cannot be ${selfOrAnonLower} here.` : '';

  return rFr({}, part1, part2, part4, part5);
}


function addDraftAuthor_inPl(draft: Draft, doAsOpts: DoAsAndOpts) {
  dieIf(!isVal(draft.doAsAnon), 'TyE3076MSRDw')  // [oneself_0_false]

  // Let's add the persona pat has already choosen as the author, to doAsOpts, if missing.
  // (Not impossible the server will refuse to save the post —  maybe anonymous
  // comments have been disabled, for example. Then, the user can choose another persona,
  // and try again.)
  let optFound: MaybeAnon | U;
  for (let opt of doAsOpts.myAliasOpts) {
    if (opt === false || draft.doAsAnon === false) { // false is oneself [oneself_0_false]
      if (opt === draft.doAsAnon) {
        optFound = opt;
        break;
      }
    }
    else {
      // We know it's WhichAnon, since is not oneself (tested above). [pseudonyms_later]
      const optAlias = opt as WhichAnon;
      const draftAlias = draft.doAsAnon as WhichAnon;
      if (optAlias.sameAnonId || draftAlias.sameAnonId) {
        if (optAlias.sameAnonId === draftAlias.sameAnonId) {
          optFound = opt;
          break;
        }
      }
      else if (optAlias.anonStatus || draftAlias.anonStatus) {
        if (optAlias.anonStatus === draftAlias.anonStatus) {
          // Must be `WhichAnon.lazyCreate` — `createNew_tst` hasn't been implemented.
          optFound = opt;
          break;
        }
      }
      else {
        // Can't happen, until later when implementing pseudonyms.
      }
    }
  }

  // If [the alias pat is using as author of the draft] isn't among the current options,
  // add it.
  if (!isVal(optFound)) { // [oneself_0_false]
    doAsOpts.myAliasOpts.push(draft.doAsAnon);
    optFound = draft.doAsAnon;
  }

  // Continue using the same author, for this draft, as before.
  // (`optFound` also includes any anon status, so use it. But `draft.doAsAnon`
  // might not incl the anon status —  it'd be better if it did, see [chk_alias_status].)
  doAsOpts.doAsAnon = optFound;
}



// ----------------------------------------------------------------------------
// REFACTOR:
// The rest of this file, should be in its own file?  ChoosePersonaDropdown.ts?


let setStateExtFn: (_: ChoosePersonaDlgPs) => V;

export function openAnonDropdown(ps: ChoosePersonaDlgPs) {
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

  const [state, setState] = React.useState<ChoosePersonaDlgPs | N>(null);

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
      // [oneself_0_false] `&&` won't work with `{ self: true }`.
      const status = whichAnon && whichAnon.anonStatus;
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

    items = state.myAliasOpts.map(makeItem);// [ali_opts_only_needed_here]
  }

  return (
      DropdownModal({ show: isOpen, onHide: close, atX: atRect.left, atY: atRect.top,
          pullLeft: true, showCloseButton: true, dialogClassName2: 'e_ChoAuD' },
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
  // [oneself_0_false] `?` won't work with `{ self: true }`.
  const anonStatus = doAs ? doAs.anonStatus : AnonStatus.NotAnon;
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
