/*
 * Copyright (c) 2020 Kaj Magnus Lindberg
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

/// <reference path="prelude.ts" />
/// <reference path="widgets.ts" />
/// <reference path="oop-methods.ts" />
/// <reference path="utils/react-utils.ts" />


/// Talkyard Shortcuts
///
/// The shortcuts are sequences of alphanumeric keys, lowercase only.
/// E.g. 'gaa' for "Go to Admin Area" or 'mn' for "view My Notifications".
///
/// When starting typing, all shortcuts matching the keys hit thus far,
/// are shown in a pop up dialog. This makes the shortcuts discoverable,
/// and no need to remember them by heart (except for maybe the first letter)
///
/// Shift opens the shortcuts dialog and shows all shortcuts
/// — this make the shortcuts even more discoverable? People sometimes
/// click Shift by accident. Then they'll discover Ty's shortcuts?
/// But not Ctrl! That'd make the dialog pop up too often by mistake, e.g.
/// if Ctrl+Tab to switch tab but one then changes one's mind and releases Ctrl.
///
/// It needs to be simple to cancel any shortcut being typed.  Don't want
/// people getting stuck in "shortcut mode", like people can get stuck in Vim
/// or Ex.  Therefore, doing anything at all except for typing the next key
/// (or Backspace to undo the last key), cancels any ongoing shortcut sequence
/// and closes the dialog.
/// E.g. moving the mouse, closes the dialog (unless the pointer is inside the dialog).
/// Or hitting Space, Alt, Shift, Berserk Mode, Tab, whatever, or scrolling.
///
/// Ctrl or Shift are not parts of shortcuts, except for Ctrl+Enter to submit
/// a text one is typing.
/// Why not?
/// Using e.g. Ctrl+(a key) as a shortcut, would almost certainly? conflict
/// with *someone's* privately configured browser or OS shortcuts,
/// or built-in browser or OS shortcuts — which vary between operating
/// systems and browsers.
/// But by never using Ctrl+(a key) for shortcuts, we won't run into any collisions.
/// And Shift + a letter doesn't really save any keystrokes? Shift is a button too.
/// However, with Shift, people sometimes wouldn't easily know if say 'l' is
/// lowercase L or uppercase i, or if 'O' is uppercase o or 0 (zero)?
/// Better always use lowercase? (pat should notice everything is lowercase,
/// and thus know that 'l' is lowercase 'L' not 'I').
///
///
/// Key codes test page: https://keycode.info/
///


// MOVE to more-bundle ?   or keyboard-mouse-bundle  ?
//
// REMOVE  keymaster dependency,  SMALLER_BUNDLE
//    but need to somehow add shortcuts for left & right sidebar,
//    and scroll 1 2 3 4 f b.
//
// Add bind- and unbindable generic shortcuts that any widget that *lists*
// things (maybe nested) can listen to:
//   onRight onLeft onUp onDown  onNext onPrev  onOpen onClose  onEnter  onDel
//
// maybe: onX(fn) and  offX(fn)   to bind and unbind.
//    or: onX(fn)  onX(fn, false)
//
// Don't need any Ctrl+Enter callback fn, instead, just use
// onKeyPress, onKeyDown and event_isCtrlEnter  — see  onKeyPressOrKeyDown [5KU8W2].
//


//------------------------------------------------------------------------------
   namespace debiki2.KeyboardShortcuts {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;


/// A fn that does what the shortcut should do, e.g. goTo(somewhere).
///
type ShortcutFn = (store: Store) => Vo;


/// The shortcut key sequence, description and implementation function.
///
/// (Not an object — nice to not have to read the same field names
/// over and over again (arrays have no field names).)
///
type ShorcFnItem = [
  // Shortcut keys, e.g. "gaa".
  St,
  // Description, e.g. "Go to Admin Area".
  St | RElm,
  // The effect, what it does, e.g. () => { location.assign(...) }.
  // This is array index 2 === ShortcutFnIx below.
  ShortcutFn];

const ShortcutFnIx = 2;


/// An info text in the shortcuts list.
///
type ShortcInfoItem = [
  // When to show this info text, e.g. 'g' means: Show if 'g' or no key pressed.
  St,
  // Info text. E.g. shows one's current page notf level, just above
  // the change notf level shortcuts.
  St | RElm]


/// The shortcuts list is made of 1) actual shortcuts, 2) info texts, and
/// 3) not-applicable (falsy) shortcuts, e.g. admin shortcuts but pat isn't admin.
///
type ShortcFnInfoZ = ShorcFnItem | ShortcInfoItem | Z;
type ShortcFnInfo = ShorcFnItem | ShortcInfoItem;


interface ShortcutDiagState {
  isOpen: Bo;
  // If opening clicking Shift, won't close just because mouse move.
  tryStayOpen?: Bo;
  // Shortcut keys pat has typed this far, e.g. 'ga', not yet matching 'gaa'
  // (go to admin area).
  keysTyped: St;
  // Shortcuts and info texts matching the keys typed thus far.
  shortcutsToShow: ShortcFnInfoZ[];
}


let skipNextShiftUp: Bo | U;
let isShiftDown: Bo | U;
let curKeyDown = ''; // could be a Set, but this'll do for now
let curState: ShortcutDiagState = { isOpen: false, keysTyped: '', shortcutsToShow: [] };
let dialogSetState: ((state: ShortcutDiagState) => Vo) | U;



function makeMyShortcuts(store: Store, keysTyped: St): ShortcFnInfoZ[] {
  const curPage: Page | U = store.currentPage;
  const curPageId: PageId | U = store.currentPageId;
  const curPageType: PageRole | U = curPage && curPage.pageRole;
  const curPageAuthorId: PatId | U = curPage && curPage.postsByNr[BodyNr]?.authorId;
  const isDisc = page_isDiscussion(curPageType);
  const isForum = curPageType === PageRole.Forum;

  const me: Me = store.me;
  const isAdmin: Bo = me.isAdmin;
  const isStaff: Bo = pat_isStaff(me);
  const isMember: Bo = pat_isMember(me);
  const isPageAuthorOrStaff = isStaff || curPageAuthorId === me.id;

  // Later:  mayChangePage = ... calculate permissions, look at PostActions,
  // show Edit button or not, for example.

  const pageNotfsTarget: PageNotfPrefTarget | Z =
          curPageId && { pageId: curPageId };

  const curEffNotfPref: EffPageNotfPref | Z =
          curPageId && isMember &&
            pageNotfPrefTarget_findEffPref(pageNotfsTarget, store, me);

  const curNotfLevel: PageNotfLevel | Z =
          curEffNotfPref && notfPref_level(curEffNotfPref);
  const curNotfLevelTitle: St | Z = curEffNotfPref && notfPref_title(curEffNotfPref)

  function changeNotfLevel(newLevel: PageNotfLevel): () => Vo {
    return function() {
      Server.savePageNotfPrefUpdStoreIfSelf(
            store.me.id,
            pageNotfsTarget as PageNotfPrefTarget,
            newLevel,
            sayWhatHappened(rFr({},
                `Notification level is now: `,
                r.b({}, notfLevel_title(newLevel, true)))));
    }
  }

  function goTo(path: St): () => Vo {
    return function() {
      // Don't:  location.assign(path)  — that'd do a full page reload.
      // Instead, do single-page-app navigation if possible:
      debiki2.page.Hacks.navigateTo(path);
    }
  }

  const forumPath = store.siteSections[0].path;
  const unimpl = true;

  return [   // I18N shortcut descriptions
      !unimpl &&
      ['/',
          descr('', "search — open the search dialog"),
          () => {}],


      // ----- In a topic

      isPageAuthorOrStaff &&
      ['c',
          `Change:`
          ] as ShortcInfoItem,

      !unimpl && isPageAuthorOrStaff &&
      ['cca',
          descr('c',"hange topic ", 'ca',"tegory"),
          () => {}],

      !unimpl && isPageAuthorOrStaff &&
      ['cst',
          descr('c',"hange topic ", 'st',"atus, e.g. to Doing or Done"),
          () => {}],

      !unimpl && isPageAuthorOrStaff && page_isOpen(curPage) &&
      ['ccl',
          descr('c',"hange topic: ", 'cl',"ose it"),
          () => {}],

      !unimpl && isPageAuthorOrStaff && page_isClosedNotDone(curPage) &&
      ['cre',
          descr('c',"hange topic: ", 're',"open it"),
          () => {}],

      isMember && isDisc &&
      ['cn',
          `Your notification level for this topic is: ${curNotfLevelTitle}`
          ] as ShortcInfoItem,

      isMember && isDisc && curNotfLevel !== PageNotfLevel.EveryPost &&
      ['cne',
          descr('c',"hange ", 'n',"otification level to ", 'e',"very post"),
          changeNotfLevel(PageNotfLevel.EveryPost)],

      isMember && isDisc && curNotfLevel !== PageNotfLevel.Normal &&
      ['cnn',
          descr('c',"hange ", 'n',"otification level to ", 'n',"ormal"),
          changeNotfLevel(PageNotfLevel.Normal)],

      isMember && isDisc && curNotfLevel !== PageNotfLevel.Hushed &&
      ['cnh',
          descr('c',"hange ", 'n',"otification level to ", 'h',"ushed"),
          changeNotfLevel(PageNotfLevel.Hushed)],


      // ----- Forum topic index

      !unimpl && isMember && isForum &&
      ['cn',
          descr('c',"reate ", 'n',"ew topic"),
          () => {}],


      // ----- Reply

      !unimpl && isMember && isDisc &&
      ['r',
          `Reply:`
          ] as ShortcInfoItem,

      !unimpl && isMember && isDisc &&
      ['rr',
          descr('r',"eply to the cu", 'r',"rently focused post"),
          () => {}],

      !unimpl && isMember && isDisc &&
      ['ro',
          descr('r',"eply to the ", 'o',"riginal post"),
          () => {}],


      // ----- Edit

      !unimpl && isPageAuthorOrStaff &&
      ['e',
          `Edit:`
          ] as ShortcInfoItem,

      !unimpl && isPageAuthorOrStaff &&
      ['eti',
          descr('e',"dit topic", 'ti',"tle"),
          () => {}],

      !unimpl && isPageAuthorOrStaff &&
      ['ebo',
          descr('e',"dit topic", 'bo',"dy"),
          () => {}],


      // ----- My things

      isMember &&
      ['m',
          `My things:`
          ] as ShortcInfoItem,

      isMember &&
      ['mn', descr('', "view ", 'm',"y ", 'n',"otifications"),
          goTo(linkToUsersNotfs(store))],

      isMember &&
      ['md',
          descr('', "view ", 'm',"y ", 'd',"rafts"),
          goTo(linkToMyDraftsEtc(store))],

      !unimpl && isMember &&
      ['mr',
          descr('', "view ",  'r',"eplies to me"),
          () => {}], // goTo(...)],

      !unimpl && isMember &&
      ['mb',
          descr('', "view ", 'm',"y ", 'b',"ookmarks"),
          () => {}], // goTo(...)],


      // ----- Go

      ['g',
          `Go elsewhere:`
          ] as ShortcInfoItem,

      ['gr',
          descr('g',"o to ", 'r',"ecently active topics"),
          goTo(forumPath + RoutePathLatest)],

      ['gw',
          descr('g',"o to ", 'w',"aiting topics, e.g. unanswered questions"),
          goTo(forumPath + RoutePathLatest +
                `?${QueryParams.TopicFilter}=${TopicFilters.ShowWaiting}`)],

      ['gn',
          descr('g',"o to ", 'n',"ewest topics"),
          goTo(forumPath + RoutePathNew)],

      isStaff &&
      ['ggr',
          descr('g',"o to the ", 'gr',"oups list"),
          goTo(linkToGroups())],

      isAdmin &&
      ['gaa',
          descr('g',"o to ", 'a',"dmin ", 'a',"rea"),
          goTo(linkToAdminPage())],

      isAdmin &&
      ['gau',
          descr('g',"o to ", 'a',"dmin area, the ", 'u',"sers tab"),
          goTo(linkToStaffUsersPage())],

      isStaff &&
      ['gmo',
          descr('g',"o to ", 'mo',"deration page"),
          goTo(linkToReviewPage())],

      ['gb',
          descr('g',"o ", 'b',"ack to last page"),
          () => history.back()],

      ['gf',
          descr('g',"o ", 'f',"orward"),
          () => history.forward()],
      ];
}



function descr(key1: St, text1: St, k2?: St, t2?: St, k3?: St, t3?: St): RElm {
  return rFr({},
      key1 ? r.b({}, key1) : null,
      text1,
      k2 ? r.b({}, k2) : null,
      t2,
      k3 ? r.b({}, k3) : null,
      t3,
      );
}



function sayWhatHappened(whatHappened: St | RElm): () => Vo {
  return function() {
    util.openDefaultStupidDialog({
      //dialogClassName: 's_UplErrD',
      closeButtonTitle: t.Okay,
      body: whatHappened,
    });
  }
}



function findMatchingShortcuts(shortcuts: ShortcFnInfoZ[],
          keysTyped: St): ShortcFnInfo[] {
  const schortcutsRightKeys = shortcuts.filter((keysDescrFn: ShortcFnInfoZ) => {
    // Shortcut not applicable in the current context?
    if (!keysDescrFn) return false;
    // We've started typing the right keys?
    const keys = keysDescrFn[0];
    // Alternatively, could use fuzzy search? Type chars in a shortcut's name
    // or description —> picks that shortcut.  [fuzzy_select]
    return keysTyped.length <= keys.length && keys.startsWith(keysTyped);
  });
  
  return schortcutsRightKeys as ShortcFnInfo[];
}




export function start() {
  logD(`Starting shortcuts [TyMSHORTCSON]`);
  addEventListener('keydown', onKeyDown, false);
  addEventListener('keyup', onKeyUp, false);
  addEventListener('click', onMouseMaybeReset, false);
  addEventListener('mousemove', onMouseMaybeReset, false);
  addEventListener('scroll', resetAndCloseDialog, false);
  addEventListener('touchmove', resetAndCloseDialog, false);
  addEventListener('mousewheel', resetAndCloseDialog, false);

  //addEventListener('focus', resetAndCloseDialog, false);
  //addEventListener('blur', resetAndCloseDialog, false);

  addEventListener('hashchange', resetAndCloseDialog, false);
  addEventListener('popstate', resetAndCloseDialog, false);
  // 'popstate' won't fire when navigating to a new page?
  // Other web apps sometimes generate a 'popstate' event themselves
  // when navigating to a new page, like so:
  // window.dispatchEvent(new Event('popstate'));
  // see:  https://stackoverflow.com/a/33668370
  // — but no need for that in Ty; instead,  in ReactStore,
  // function showNewPage() calls resetAndCloseDialog().

  // Never unregister.
}



export function resetAndCloseDialog() {
  //logD(`resetAndCloseDialog()`);
  if (curState.isOpen) {
    updateDialog({ isOpen: false, keysTyped: '', shortcutsToShow: [] });
  }
}



function onMouseMaybeReset(event: MouseEvent) {
  if (!curState.isOpen)
    return;

  if (curState.tryStayOpen && event.type === 'mousemove') {
    // Then don't close on mouse move events.
    return;
  }

  // Don't close if clicking or moving the mouse inside the shortcuts dialog.
  // Maybe pat wants to select and copy text, e.g. a shortcut description?
  const dialogElm: HElm | Z = curState.isOpen && $first('.c_KbdD-Mini .modal-dialog');
  const targetElm: Elm | Z = event.target as Elm;
  if (dialogElm && dialogElm.contains(targetElm))
    return;

  resetAndCloseDialog();
}



/// We'll skip shortcuts, if any modal dialog is open.
function anyOtherDialogOpen(): Bo {
  return !curState.isOpen && !!$first('.modal');
}



function isShift(key: St): Bo {
  return key === 'Shift';
}


function isModifierNotShift(key: St): Bo {
  return (
      key === 'Alt' ||
      key === 'AltGraph' ||
      key === 'CapsLock' ||
      key === 'Control' ||
      key === 'Fn' ||
      key === 'FnLock' ||
      key === 'Hyper' ||   // only on the old Space Cadet keyboard?
      key === 'Meta' ||    // Windows logo key or Mac command key
      key === 'NumLock' ||
      key === 'ScrollLock' ||
      // (Skip 'Shift'.)
      key === 'Super' ||  // the Windows key or Mac command key
      key === 'Symbol' ||
      key === 'SymbolLock');
}


function canBeShortcutKey(key: St): Bo {
  // All shortcuts are [a-z0-9]+ at least for now.
  const isAlnum = ('a' <= key && key <= 'z') || ('0' <= key && key <= '9');
  const isBackspace = key === 'Backspace'
  return isAlnum || isBackspace || isShift(key);
}



function onKeyUp(event: KeyboardEvent) {
  const key: St = event.key;

  if (isModifierNotShift(key))
    return;

  const store: Store = getMainWinStore();

  const uiPrefs = me_uiPrefs(store.me);
  if (uiPrefs.kbd !== UiPrefsKeyboardShortcuts.On)
    return;

  //logD(`onKeyUp: ${key}`);

  if (!curKeyDown) {
    // Pat pressed Ctrl+Shift+Tab or something in another tab, and now released
    // Shift in this tab? So there's a key-up but no key-down event? — Ignore.
    return;
  }

  if (curKeyDown === key) {
    curKeyDown = '';
  }

  // If typing some other command, don't interpret that as a shortcut.
  // Break out fn? (35FM7906RT)
  if (event.ctrlKey || event.altKey || event.metaKey) {  // not event.shiftKey
    resetAndCloseDialog();
    return;
  }

  if (!canBeShortcutKey(key)) {
    resetAndCloseDialog();
    return;
  }

  // In Talkyard, Shift opens the shortcuts dialog (or closes and cancels),
  // but is not part of the shortcuts.
  //
  // However, on Shift, don't open the shortcut dialog until pat releases
  // the key — because otherwise the dialog would appear briefly, if typing
  // e.g. Shift+Tab to tab around.
  //
  if (isShift(key)) {
    if (curState.isOpen) {
      resetAndCloseDialog();
    }
    else if (skipNextShiftUp) {
      // Don't open dialog. Otherwise, if pressing Shift+Tab and releasing Tab
      // before Shift  (or Ctrl+R, and realeasing R then Ctrl),
      // that'd open the dialog briefly  (until page done reloading).
    }
    else if (anyOtherDialogOpen()) {
      // Don't open the shortcuts dialog on top of another dialog.
    }
    else {
      // If opening explicitly via Shift or Ctrl, then, don't close if using
      // the mouse — maybe pat wants to copy text?
      // And hopefully pat understands that since Shift and Ctrl opens,
      // those same buttons also close the dialog?
      const tryStayOpen = true;
      const allShortcuts = makeMyShortcuts(store, '');
      const shortcutsToShow = findMatchingShortcuts(allShortcuts, '');
      updateDialog({ isOpen: true, tryStayOpen, keysTyped: '', shortcutsToShow });
    }

    isShiftDown = false;
    skipNextShiftUp = false;
  }

  // Skip shortcuts if typing text.
  if (event_canBeKeyTarget(event)) {
    resetAndCloseDialog();
  }
}



function onKeyDown(event: KeyboardEvent) {
  const store: Store = getMainWinStore();

  const uiPrefs = me_uiPrefs(store.me);
  if (uiPrefs.kbd !== UiPrefsKeyboardShortcuts.On)
    return;

  const key: St = event.key;
  const otherKeyAlreadyDown = curKeyDown;

  if (!isModifierNotShift(key)) {
    curKeyDown = key;
  }

  //logD(`onKeyDown: ${key}`);

  // Handled in onKeyUp() instead.
  if (isShift(key)) {
    isShiftDown = true;
    // Must not click Shift or Ctrl together with the shortcut keys.
    if (otherKeyAlreadyDown) {
      resetAndCloseDialog();
    }
    return;
  }

  // If typing some other command, don't interpret that as a shortcut.
  // Ctrl, Alt, Shift, Meta are never part of shortcuts.
  // Break out fn? (35FM7906RT)
  if (event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) {
    skipNextShiftUp ||= isShiftDown;
    resetAndCloseDialog();
    return;
  }

  // If shortcut dialog open, skip the browser's default key event. Otherwise
  // e.g. clicking Space, would scroll down — which feels weird, since the
  // shortcut dialog had focus, not the page in the background.
  if (curState.isOpen) {
    event.preventDefault();
    // If is the wrong key, we'll close the dialog and return, just below.
  }

  if (!canBeShortcutKey(event.key)) {
    // So Ctrl+R or Ctrl+T etc won't open the dialog, when one releases Ctrl.
    skipNextShiftUp ||= isShiftDown;
    resetAndCloseDialog();
    return;
  }

  // Don't open the dialog, if another dialog open already.
  //
  // But what if the shortcut dialog is open already, and then a fetch() request
  // finishes loading, causing another dialog to appear?
  // Then let's close the shortcut dialog? (We already did preventDefault() above.)
  //
  if (anyOtherDialogOpen()) {
    resetAndCloseDialog();
    return;
  }

  // If pat is typing text or selecting something, skip shortcuts.
  if (event_canBeKeyTarget(event)) {
    resetAndCloseDialog();
    return;
  }

  let keysTyped = curState.keysTyped;

  if (key === 'Backspace') {
    if (keysTyped) {
      // Undo any last key, and proceed below to show the thereafter
      // matching shortcuts — or all shortcuts, if keysTyped becomes '' empty.
      keysTyped = keysTyped.slice(0, keysTyped.length - 1);
    }
    else {
      // Don't open the dialog if just pressing Backspace. Or, close,
      // if hitting Backspace so all keys pressed are "gone".
      resetAndCloseDialog();
      return;
    }
  }
  else {
    // @ifdef DEBUG
    // Just a single [a-z0-9] key at a time.
    dieIf(key.length > 1, 'TyE395MRKT');
    // @endif
    keysTyped += key;
  }

  const allShortcuts: ShortcFnInfoZ[] = makeMyShortcuts(store, keysTyped);
  const matchingShortcutsAndInfo: ShortcFnInfo[] = findMatchingShortcuts(
          allShortcuts, keysTyped);

  // Info items have no shortcut fn.
  const matchingShortcuts: ShorcFnItem[] =
          matchingShortcutsAndInfo.filter(item => !!item[ShortcutFnIx]) as ShorcFnItem[];

  const numMatching = matchingShortcuts.length;
  //logD(`Num matching shortcuts: ${numMatching}, keysTyped: ${keysTyped}`);

  if (numMatching === 0 && keysTyped.length) {
    // Typed a Not-a-shortcut key, so cancel.
    resetAndCloseDialog();
    return;
  }

  if (numMatching === 1) {
    const shortcutToRun: ShorcFnItem = matchingShortcuts[0];
    const [keys, descr, shortcutFn] = shortcutToRun;
    if (keys.length === keysTyped.length) {
      logD(`Running shortcut for ${keysTyped}:`);
      shortcutFn(store);
      resetAndCloseDialog();
      return;
    }
  }
  // Else: Wait for more keys,
  // and show which shortcuts match the keys pressed this far:

  // If we didn't type anything yet (just hit Shift to open the dialog),
  // then list all shortcuts and info texts.
  const whatToShow = keysTyped ? matchingShortcutsAndInfo : allShortcuts;

  updateDialog({ isOpen: true, tryStayOpen: curState.tryStayOpen,
        keysTyped, shortcutsToShow: whatToShow });
}



function updateDialog(nextState: ShortcutDiagState) {
  if (!dialogSetState) {
    // Why does render() return null?
    ReactDOM.render(KeyboardShortcutsDialog(), utils.makeMountNode());
  }

  if (!_.isEqual(nextState, curState)) {
    //logD(`updateDialog({ ${JSON.stringify(nextState)} })`);
    dialogSetState(nextState);
    curState = nextState;
  }
  else {
    //logD(`Need not updateDialog(), state unchanged: { ${JSON.stringify(nextState)} }`);
  }
}



const KeyboardShortcutsDialog = React.createFactory<{}>(function() {
  const [state, setState] = React.useState<ShortcutDiagState | Nl>(null);

  dialogSetState = setState;

  if (!state || !state.isOpen)
    return r.div({});

  const boldKeysTyped = r.b({ className: 's_KbdD_KeysTyped' }, state.keysTyped);
  const numKeysTyped = state.keysTyped.length;

  function PrettyShortcut(item: ShortcFnInfoZ): RElm | Z {
    if (!item) return null;
    const [keys, descr, anyFn] = item;
    const isInfo = !anyFn;
    const keysLeft = keys.slice(numKeysTyped);
    return r.li({ key: keys },
        isInfo ? null : r.span({ className: 's_KbdD_ShortcutKeys' },
          boldKeysTyped, keysLeft + ' '),
        r.span({ className: 's_KbdD_Descr' + (isInfo ? ' s_KbdD_InfoIt' : '') },
          descr));
  }

  const title = (state.keysTyped
      ? rFr({}, `Typing shortcut: `, r.b({}, state.keysTyped),
          r.span({ className: 's_Fx-Blink' }, '_'))
          // Why <blink>_</blink> won't work o.O  to simulate a type-more cursor?
          // Browsers bring <blink> back
      : `Keyboard shortcuts:`);

  const orMovingTheMouse = state.tryStayOpen ? '' : ", or moving the mouse,";

  // If opening via Shift, show the full dialog directly.
  // But if starting typing a shortcut — then it's annoying to see the whole
  // dialog appearing suddenly; it's a bit large. Instead, show just the keys typed,
  // until after about a second; after that, the whole dialog will fade in.
  const fullOrMini = state.tryStayOpen ? 'c_KbdD-Full' : 'c_KbdD-Mini';

  return InstaDiag({
    diagClassName: 'c_KbdD ' + fullOrMini,
    title,
    body: rFr({},
        r.p({}, r.code({}, "Escape"), ',', r.code({}, "Space"), ',', r.code({}, "Shift"),
            orMovingTheMouse + " cancels."),
        r.ul({ className: 's_KbdD_ShortcutsL' },
          state.shortcutsToShow.map(PrettyShortcut))),
  });
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
