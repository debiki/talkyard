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

  let asYourName: RElm | U;
  let anonymously: RElm | U;

  if (isOpen) {
    const me: Me = state.me;
    const pat: Pat | U = state.pat;
    const makeItem = (whichAnon: WhichAnon, e2eClass: St): RElm => {
      const title = r.span({ className: e2eClass }, whichAnon_title(whichAnon, { me, pat }));
      const text = whichAnon_descr(whichAnon, { me, pat });
      return (
          ExplainingListItem({
            title, text,
            active: obj_isDeepEqIgnUndef(whichAnon, state.curAnon),
            onSelect: () => {
              state.saveFn(whichAnon);
              close();
            },
          }));
    }

    // Later: True if one has already posted something on the current page,
    // using one's real account.
    const alreadyTalkingAsSelf = false;  // ANON_UNIMPL
    const mustBeAnon = state.discProps.comtsStartAnon >= NeverAlways.AlwaysButCanContinue;
    // It's ok to *continue* posting, using one's real account, on
    // this page, because:  Comments start anon  Always-**But-Can-Continue**  posting
    // using one's real name.
    const canContinueAsSelf =
            state.discProps.comtsStartAnon <= NeverAlways.AlwaysButCanContinue;
    const mayUseRealName = !mustBeAnon || (canContinueAsSelf && alreadyTalkingAsSelf);

    if (mayUseRealName) {
      asYourName = makeItem({ newAnonStatus: AnonStatus.NotAnon }, 'e_AtrSelf');
    }

    anonymously = makeItem({ newAnonStatus: state.discProps.newAnonStatus }, 'e_AtrAnon');

    // Distant future: [pseudonyms_later]
    // usingPseudonym = ...
    // and also a way to: openAddPseudonymsDialog(alreadyAddedIds, onDone) ?
    //  — there could be a Create Pseudonym button?
  }

  return (
      DropdownModal({ show: isOpen, onHide: close, atX: atRect.left, atY: atRect.top,
          pullLeft: true, showCloseButton: true },
        r.div({ className: 's_ExplDrp_Ttl' }, "Post ..."),  // I18N
        asYourName,
        anonymously));
});


export function whichAnon_titleShort(doAs: WhichAnon | U, ps: { me: Me, pat?: Pat })
      : St | RElm {
  return whichAnon_titleDescrImpl(doAs, ps, TitleDescr.TitleShort);
};


export function whichAnon_title(doAs: WhichAnon | U, ps: { me: Me, pat?: Pat }): St | RElm {
  return whichAnon_titleDescrImpl(doAs, ps, TitleDescr.TitleLong);
};


export function whichAnon_descr(doAs: WhichAnon | U, ps: { me: Me, pat?: Pat }): St | RElm {
  return whichAnon_titleDescrImpl(doAs, ps, TitleDescr.DescrLong);
};


const enum TitleDescr {
  TitleShort = 1,
  TitleLong = 2,
  DescrShort = 3,
  DescrLong = 4,
}


function whichAnon_titleDescrImpl(doAs: WhichAnon | U, ps: { me: Me, pat?: Pat },  // I18N
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
              r.span({ className: 'n_TtlCap',
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
          return r.span({ className: 'n_TtlCap' }, "anonymously");
        default:
          // TitleDescr.DescrShort and Long:
          return nameNotShownEtc;
      }
    }

    default: {
      // Not anonymously.
      switch (what) {
        case TitleDescr.TitleShort:
          return "as " + pat_name(ps.pat || ps.me);
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
