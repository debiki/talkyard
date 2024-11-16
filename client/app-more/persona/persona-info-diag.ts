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

/// <reference path="../../macros/macros.d.ts" />
/// <reference path="../more-prelude.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.persona {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;


export function openPersonaInfoDiag(ps: { atRect: Rect, isSectionPage: Bo,
        me: Me, personaOpts: PersonaOptions, discProps: DiscPropsDerived }): V {

  const discProps: DiscPropsDerived = ps.discProps;
  const me: Me = ps.me;

  // This'll be  page_users3.prefer_alias_id_c  once implemented.
  //const thisPagePrefAlias: KnownAnonym | Me | N = null;

  //const pseudonymsRecommended = false; [pseudonyms_later]
  const anonsAllowed = discProps.comtsStartAnon >= NeverAlways.Allowed;
  const anonsRecommended = discProps.comtsStartAnon >= NeverAlways.Recommended;
  const mustBeAnon = discProps.comtsStartAnon >= NeverAlways.AlwaysButCanContinue;
  const switchedToPseudonym = false;
  const switchedToAnonStatus: AnonStatus | U = me.usePersona && me.usePersona.anonStatus;
  const switchedToSelf = me.usePersona && me.usePersona.self;

  morekit.openProxyDiag({ atRect: ps.atRect, flavor: DiagFlavor.Dialog,
            dialogClassName: 'e_PersInfD' }, (closeDiag: () => V) => {

    const inThisPlace = ps.isSectionPage ? "in this category" : "on this page";
    const thereforeIllAsk = "Therefore, I'll ask you if you want to be yourself, " +
              "or be anonymous, if you post something here.";

    // Either:  "But you  have also  posted       as ..."
    //     Or:  "You      have       posted  both as ... and as ..."
    const hasBeenBoth = ps.personaOpts.hasBeenAnon &&  ps.personaOpts.hasBeenSelf;
    const butYou = hasBeenBoth ? "You" : "But you";
    const also = hasBeenBoth ? '' : "also ";
    const both = hasBeenBoth ? "both " : '';

    let whatMode: St | U;
    let content: RElm;
    let enterSelfModeBtn: RElm | U;
    let enterAnonModeBtn: RElm | U;
    let okPersona = true;

    if (switchedToSelf) {  // [alias_mode]
      whatMode = "Yourself";  // I18N, this whole fn

      const youreInSelfMode = rFr({}, "You're in ", r.b({}, "Yourself mode"));
      const colonPostingAsSelf = ": You're posting and voting as yourself.";

      const ambigMsg = !ps.personaOpts.hasBeenAnon ? null : rFr({},
            r.p({},
              `${butYou} have ${also}posted ${both}anonymously${
                  both ? ", and as yourself," : ''} ${inThisPlace}.`),
            r.p({},
              thereforeIllAsk));

      if (mustBeAnon && ps.personaOpts.hasBeenSelf) {
        // 1: _May_not_but_can_continue
        // One can continue as oneself, if one has commented as oneself already before
        // this page/category became anonymous-only.
        content = rFr({},
            r.p({}, youreInSelfMode, '.'),
            r.p({},
              `Normally, you cannot post as yourself ${inThisPlace}, ` +
              "but you have done that already; therefore you can continue as yourself."));
      }
      else if (mustBeAnon) {
        // 2: _May_not
        okPersona = false;
        content = r.p({},
              youreInSelfMode, ". But you ", r.b({}, "cannot"),
              " post as yourself here — everyone needs to be anonymous.");
      }
      else if (anonsAllowed) { // [pseudonyms_later]
        // 3: _Can_choose
        content = rFr({},
              r.p({}, youreInSelfMode, colonPostingAsSelf),
              ambigMsg || r.p("You can be anonymous, though, if you want."));
      }
      else {
        // 4: _Everyone_is
        content = rFr({},
            r.p({}, youreInSelfMode, colonPostingAsSelf),
            ambigMsg ||
                // Maybe a bit interesting that Yourself mode isn't needed, here:
                // (But one can continue posting anonymously if one has done that already,
                // on the current page.)
                r.p({}, "(On this page, you cannot be anonymous anyway.)"),
            );
      }
    }
    else if (switchedToAnonStatus) {
      whatMode = anonStatus_toStr(switchedToAnonStatus);
      const youreInAnonMode = rFr({}, "You're in ", r.b({}, whatMode + " mode"));
      const colonPostingAnonly = ": You're posting and voting anonymously.";
      const ambigMsg = !ps.personaOpts.hasBeenSelf ? null : rFr({},
          r.p({},
            `${butYou} have ${also}posted ${both}as yourself${
                  both ? ", and anonymously," : ''} ${inThisPlace}.`),
          r.p({},
            thereforeIllAsk));

      // (Maybe not the same anon status.  [dif_anon_status])
      if (!anonsAllowed && ps.personaOpts.hasBeenAnon) {
        // 1: _May_not_but_can_continue
        // One can continue anonymously if one has been anonymous on this page already,
        // some time ago when that was allowed (or if the page got moved to another category?).
        content = rFr({},
            r.p({}, youreInAnonMode, '.',
            r.p({},
              `Normally, you cannot post anonymously ${inThisPlace}, ` +
              `but you have done that already; therefore you can continue.`)));
      }
      else if (!anonsAllowed) {
        // 2: _May_not
        okPersona = false;
        content = r.p({},
              youreInAnonMode, ". But you ", r.b({}, "cannot"), " be anonymous here.");
      }
      else if (!mustBeAnon) { // [pseudonyms_later]
        // 3: _Can_choose
        // (Maybe not the same type of anonyms?  [dif_anon_status])
        content = rFr({},
              r.p({}, youreInAnonMode, colonPostingAnonly),
              ambigMsg || (!anonsRecommended ? '' :
                  r.p({}, ` Everyone is anonymous ${inThisPlace} by default.`)));
      }
      else {
        // 4: _Everyone_is
        // (Maybe not the same type of anonyms?  [dif_anon_status])
        content = rFr({},
              r.p({}, youreInAnonMode, colonPostingAnonly),
              ambigMsg ||
                  r.p({}, `Everyone is anonymous ${inThisPlace} anyway.`));
      }
    }
    else if (switchedToPseudonym) {

      // @ifdef DEBUG
      die('TyE206MFKG'); // [pseudonyms_later]
      // @endif
      void 0;
      /*
      whatMode = "Pseudonymous Mode as user (S) Some Psuedonym";
      if (mustBeAnon || !pseudonymsAllowed) {
        okAlias = false;
        content = rFr({}, "You're in pseudonymous mode, but you cannot use pseudonyms here" +
              (mustBeAnon ? " — everyone must be anonymous." : '.'));
      }
      else {
        content = r.span({}, "You're using a pseudonym, (P) some_pseudonym, which will " +
              "be used if you post topics or comments, or upvote anything." +
              (!ambiguity ? '' : "However, you have also posted anonymously here, " +
              "and I'll need to ask you if you want to use the pseudonym, or " +
              "continue anonymously."));
      }
      */
    }
    else {
      const whenYouBlaBla = "when you post comments or upvote others.";
      if (ps.personaOpts.hasBeenSelf && ps.personaOpts.hasBeenAnon) {
        content = rFr({},
              r.p({}, "You have been both anonymous and yourself on this page. "),
              r.p({}, thereforeIllAsk));
      }
      else if (ps.personaOpts.hasBeenSelf) {
        content = rFr({},
            r.p({},
              "You have been yourself on this page, so, you'll continue " +
              "being yourself, " + whenYouBlaBla),
            !anonsAllowed ? null : r.p({},
              "You can be anonymous instead, if you want."));
        // There'll be an [Enter Anonymous mode] button below (if allowed here)
        // – that's clear enough? (No need for "Click ... below if ...".)
      }
      else if (ps.personaOpts.hasBeenAnon) {
        // COULD: If has been both temp anon and permanently anon, say sth like:
        // "You have been both temporarily and permanently anonymous on this page."
        // + thereforeIllAsk.  [dif_anon_status]
        content = rFr({},
            r.p({},
              "You have been anonymous on this page, so, you'll continue " +
              "being anonymous, " + whenYouBlaBla),
            mustBeAnon ? null: r.p({},
              "You can post as yourself instead, if you want."));
        // There'll be an [Enter Yourself mode] button below (if allowed).
      }
      else if (anonsRecommended) {
        // Say "temporarily anonymous" if temp anon. [dif_anon_status]
        content = r.p({},
              `You and others are anonymous by default, ${inThisPlace}.`);
      } /*
      else if (pseudonymsRecommended) {
        // [pseudonyms_later]
        // How's this going to work?  Can't create pseudonyms automatically – pat needs
        // to choose a pseudonym name, hmm. Maybe a pop-up question like:
        //   "Create a pseudonym? If you don't want to use your real name, ... [Yes] [No]"
      } */
      else if (anonsAllowed) {
        content = rFr({},
            r.p({},
              // Say "temporarily anonymous" if temp anon. [dif_anon_status]
              `You can post anonymously here, if you want.`),
            r.p({},
              "By default, your posting as yourself though."));
      }
      else {
        // Dead code? The personas info button shouldn't appear, if one cannot
        // be and hasn't been anonymous.
        content = r.p({},
              `You're yourself — you cannot post anonymously here.`);
      }

      if (!mustBeAnon) enterSelfModeBtn =
            mkBtn(r.span({},
                "Enter ", r.u({}, "Yourself"), " mode"),
                { self: true } satisfies Oneself, 'e_SlfMdeB');

      if (anonsAllowed) enterAnonModeBtn =
            mkBtn(r.span({},
                "Enter ", r.u({}, anonStatus_toStr(discProps.newAnonStatus)), " mode"),
                { anonStatus: discProps.newAnonStatus,
                  lazyCreate: true } satisfies LazyCreatedAnon,
                discProps.newAnonStatus === AnonStatus.IsAnonOnlySelfCanDeanon ?
                      'e_PrmAnoB' : 'e_TmpAnoB');

      // [pseudonyms_later] More buttons:
      //   [ Switch to (P) pseudonym_of_yours  ]
      //   [ Switch to (S) some_other_pseudonym]
      //   [ Create Pseudonym  ]
    }

    /* Sometimes incl cur page aliases in content? But when? Maybe if clicking a [More v]
    // button, then, could show a list of all one's aliases on the current page, in the
    // contextbar —  there's already a "Users on this page" list there, see [users_here],
    // and filtering out only one's own personas can make sense?
    if (me.myAliasCurPage.length >= 1) {
      const user = me.myAliasCurPage.length === 1 ? "user " : "users ";
      content = rFr({},
          "You are anonymous " + user,
          rFr({},
              me.myAliasCurPage.map((alias: KnownAnonym) =>
                  rFr({},
                      avatar.Avatar({ key: alias.id, user: alias, origins: store }),
                      r.span({ className: '' }, alias.username || alias.fullName)))),
          "on this page." + everyoneIs);
    } */

    const leaveModeBtn = !whatMode ? null :
            mkBtn(r.span({}, "Leave ", r.u({}, whatMode), " mode"), null, 'e_XitMdeB');

    function mkBtn(title: St | RElm, usePersona: Oneself | LazyCreatedAnon | N,
              e2eClass: St): RElm {
      return Button({ className: e2eClass, onClick: () => {
          ReactActions.patchTheStore({ me: { usePersona } });
          closeDiag();
        }}, title);
    }

    return rFr({},
        // Better without any header. The mode is in bold in the first sentence already,
        // feels like enough.
        // r.div({ className: 'esDropModal_header' }, !whatMode ? '' : whatMode + " Mode"),
        r.div({}, content),
        r.div({ className: 'c_PersInfD_Bs' },
          leaveModeBtn,
          enterSelfModeBtn,
          enterAnonModeBtn),
        );
  });
}




//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
