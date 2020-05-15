/*
 * Copyright (C) 2015 Kaj Magnus Lindberg
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

/// <reference path="server-vars.d.ts" />
/// <reference path="model.ts" />
/// <reference path="constants.ts" />
/// <reference path="translations.d.ts" />
/// <reference path="magic-time.ts" />

declare const t: TalkyardTranslations;
declare const ReactDOMServer: any;
declare const ReactRouterDOM: any;
declare const ReactDOMFactories: any;
declare const createReactClass: any;
declare const parseQueryString: (s: string) => any;
declare const stringifyQueryString: (s: any) => string;

// node_modules/@types/react-addons-css-transition-group doesn't work, so use ':any' instead.
var ReactCSSTransitionGroup: any = isServerSide() ? null :
    reactCreateFactory(window['ReactTransitionGroup'].CSSTransitionGroup);

const rFragment = reactCreateFactory(React.Fragment);

// Don't <reference>, causes lots of TS errors.
declare const Bliss: any;
declare function $$(selector: string): Element[];

// Defined in client/third-party/smoothscroll-tiny.js.
declare function smoothScroll(elem: Element, x: number, y: number,
    durationMs?: number, onDone?: () => void);

// Defined in client/third-party/get-set-cookie.js.
declare function getSetCookie(cookieName: string, value?: string, options?: any): string;

// backw compat, later, do once per file instead (don't want a global 'r').
const r = ReactDOMFactories;

// Let this be a function, not a variable, so it can be used directly.
// (Otherwise there's a server side reactCreateFactory-not-yet-inited error)
function reactCreateFactory(type) {
  // Deprecated, causes warning, from React >= 16.13.0:
  // `return React['createFactory'](x);`
  // See: https://reactjs.org/blog/2020/02/26/react-v16.13.0.html#deprecating-reactcreatefactory
  // Instead:
  return React.createElement.bind(null, type);
}


function isServerSide(): boolean {
  return !!window['ReactDOMServer'];
}


// Use this function to call getBoundingClientRect() and other stuff just before the next repaint,
// to avoid forced refresh of the layout.
function doNextFrameOrNow(something: () => void) {
  if (window.requestAnimationFrame) {
    window.requestAnimationFrame(something)
  }
  else {
    something();
  }
}


/**
 * Basic stuff needed by essentially all modules / files.
 */
//------------------------------------------------------------------------------
   namespace debiki2 {
//------------------------------------------------------------------------------

// Typescript changes this so the macro breaks somehow, in prod builds:
// x ifdef DEBUG
export function toStr(x: any, indentation: number = 2): string {
  return JSON.stringify(x, undefined, indentation);
}
// x endif


// If in an embedded comments iframe.
export let iframeOffsetWinSize: IframeOffsetWinSize | undefined;


export function oneIfDef(x: any): number {
  return x ? 1 : 0;
}


/// Wrapper for console.log().
///
/// But uses *debug* level if we're in an embedded blog comments iframe — because
/// blog authors sometimes look in the console, and send emails asking about
/// actually harmless log messages in the console. — With debug log level,
/// though, the browser won't show those messages, by default.
///
/// Otherwise, use normal log level — so if someone copy-pastes a real warning
/// or error from the console, the console.log() messages are visible and
/// get included, simplifying troubleshooting.
///
export function logM(message, ex?) {
  if (eds.isInIframe) {
    console.debug.apply(console, arguments);
  }
  else {
    console.log.apply(console, arguments);
  }
}

export function logW(message, ex?) {
  console.warn.apply(console, arguments);
}

export function logE(message, ex?) {
  console.error.apply(console, arguments);
}

/// Wrapper for console.debug().
///
/// So can change how logging works, from this one place, rather than updating
/// console.debug() everywhere.
///
export function logD(message, ex?) {
  console.debug.apply(console, arguments);
}


export function logAndDebugDie(errorMessage: string, ex?) {
  console.error(errorMessage, ex);
  // @ifdef DEBUG
  die(errorMessage);
  // @endif
  void 0; // [macro-bug]
}


export function die(errorMessage: string) {
  // @ifdef DEBUG
  debugger;
  // @endif
  const dialogs: any = debiki2['pagedialogs'];
  // I don't remember why I added setTimeout() but there was a good reason.
  setTimeout(() => {
    debiki2['Server'].logError(errorMessage);
  });
  if (dialogs && dialogs.showAndThrowClientSideError) {
    dialogs.showAndThrowClientSideError(errorMessage);
  }
  else {
    // Server side.
    throw Error(errorMessage);
  }
}

export function dieIf(condition, errorMessage: string) {
  if (condition) {
    die(errorMessage);
  }
}


export function logError(errorMessage: string) {
  console.error(Error(errorMessage));
  // Why setTimeout()? I don't remember, see above in die(errorMessage).
  // @ifdef DEBUG
  debugger;
  // @endif
  setTimeout(() => {
    debiki2['Server'].logError(errorMessage);
  });
}


export function logErrorIf(condition, errorMessage: string) {
  if (condition) {
    logError(errorMessage);
  }
}


export function scrollToBottom(node) {
  dieIf(!node, 'DwE9FMW2');
  node.scrollTop = node.scrollHeight;
}


export function seemsSelfHosted(): boolean {
  return eds.siteId === FirstSiteId;
}


export function isBlogCommentsSite(): boolean {
  return location.hostname.startsWith('comments-for-'); // or how know? [7PLBKA24]
}


export function isCommunitySite(): boolean {
  return !isBlogCommentsSite();
}


export function isInSomeEmbCommentsIframe(): boolean {
  return eds.isInEmbeddedCommentsIframe || eds.isInEmbeddedEditor;
}

/**
 * Finds the main embedded comments window, where the per page temporary xsrf token
 * and sesion id are kept, when logging in without cookies. So they'll be accessible
 * everywhere: http requests that need the xsrf token or session id,
 * are made from the editor iframe and login popup wins too, not just the main
 * comments win.
 */
export function getMainWin(): MainWin {
  // Maybe there're no iframes and we're already in the main win?
  // (window.opener might still be defined though — could be an embedded
  // comments iframe, in another browser tab. So if we were to continue below,
  // we could find the main win from the *wrong* browser tab with the wrong
  // React store. )
  if (!eds.isInIframe && !eds.isInLoginPopup &&
        // If we're in a login popup, and got rediected back from an
        // OAuth provider, then eds.isInLoginPopup is false, but
        // the window name will be 'TyLoginPopup' — then, we need to continue
        // below to find the real main win (since we're in a popup).
        // (The window apparently keeps its name, also when going to the OAuth
        // provider and logging in there, and getting redirected back.)
        window.name !== 'TyLoginPopup') {
    return window as MainWin;
  }

  const lookingForName = 'edComments';

  if (window.name === lookingForName) {
    // @ifdef DEBUG
    dieIf(!window['typs'], 'TyE7S2063D');
    // @endif
    return <MainWin> window;
  }

  // This is the main window already, unless we're on an embedded comments page or in a login popup.
  let win = window;

  // If we're in a login popup window, switch to the opener, which should be either the
  // main win (with all comments and discussions), or the embedded editor 'edEditor' in an iframe.
  try {
    if (win.opener && win.opener.typs) {
      win = win.opener;
    }
  }
  catch (ignored) {
    // The opener is apparently a different domain that e.g. window.open():ed
    // the current page. Then, may not access opener.typs — that results in
    // an "accessing a cross-origin frame" error. Fine, just ignore.
  }

  if (win.name === 'edEditor') {
    // We're in the embedded editor iframe window. The parent window is the embedding window,
    // e.g. a blog post with comments embedded. And it should have another child window, namely
    // the main window, with all embedded comments.
    // @ifdef DEBUG
    dieIf(!win.parent, 'TyE7KKWGCE2');
    // @endif
    win = win.parent[lookingForName];
  }

  // @ifdef DEBUG
  dieIf(!win['typs'], 'TyE5KTGW0256');
  // @endif

  return <MainWin> win;
}


export function anyE2eTestPassword() {
  return (window.location.search.match(/e2eTestPassword=([^&#]+)/) || [])[1];
}

export function anyForbiddenPassword() {
  return (window.location.search.match(/forbiddenPassword=([^&#]+)/) || [])[1];
}


export const findDOMNode = isServerSide() ? null : window['ReactDOM'].findDOMNode;
dieIf(!isServerSide() && !findDOMNode, 'EsE6UMGY2');


export function hasErrorCode(request: HttpRequest, statusCode: string) {
  return request.responseText && request.responseText.indexOf(statusCode) !== -1;
}


export function toId(x: number | { id: number } | { uniqueId: number }): number {
  if (_.isNumber(x)) return <number> x;
  const nr = x['id'];
  if (_.isNumber(nr)) return <number> nr;
  return x['uniqueId'];
}


export function isDigitsOnly(maybeDigits: string): boolean {
  return /^\d+$/.test(maybeDigits);
  // Also negative numbers:  insert:  [\+-]?
  // Number.isInteger not supported in IE11.
  // (isNaN('222aaa') is false — the whole string needs to be a number. Except that
  // it thinks '' is a number: isNaN('') === false.
  // It considers '123e45' a number though so don't use. )
}


export function uppercaseFirst(text: string): string {
  return !text ? text : (
    text[0].toUpperCase() + text.substr(1));
}


export function isBlank(x: string): boolean {
  return _.isEmpty(x) || !x.trim();
}


export function nonEmpty(x): boolean {
  return !_.isEmpty(x);
}


export function isDefined2(x): boolean {
  return !_.isUndefined(x);
}


// Ooops bad name, shouldn't include null  CLEAN_UP rename to isPresent/isSomething/isSth/hasValue?
export function isDefined(x): boolean {  // rename to isNotNullOrUndefined(x), or:: notNullOrUndef
  return !isNullOrUndefined(x);
}


export function isNullOrUndefined(x): boolean {   // RENAME to isNullOrUndef/isAbsent/lacksValue?
  return _.isNull(x) || _.isUndefined(x);
}


export function firstDefinedOf(x, y, z?) {
  return !_.isUndefined(x) ? x : (!_.isUndefined(y) ? y : z);
}


/** Like _.groupBy but keeps just one value per key.
  */
export function groupByKeepOne<V>(vs: V[], fn: (v: V) => number): { [key: number]: V } {
  const manyById: { [key: number]: V[] } = _.groupBy(vs, fn);
  const oneById:  { [key: number]: V   } = _.mapValues(manyById, many => many[0]);
  return oneById;
}


// Finds and replaces (in-place) the first item with item.id = replacement.id.
// Dies, if there's not matching item.
export function replaceById(itemsWithId: any[], replacement) {
  // @ifdef DEBUG
  dieIf(isNullOrUndefined(replacement.id), 'EdE4GJTH02');
  // @endif

  for (let i = 0; i < itemsWithId.length; ++i) {
    const item = itemsWithId[i];
    // @ifdef DEBUG
    dieIf(isNullOrUndefined(item.id), 'EdE2FJ0U7');
    // @endif

    if (item.id === replacement.id) {
      itemsWithId[i] = replacement;
      break;
    }
    dieIf(i === itemsWithId.length - 1, 'EdE8KA0N2');
  }
}


export function deleteById(itemsWithId: any[], idToDelete) {
  for (let i = 0; i < itemsWithId.length; ++i) {
    const item = itemsWithId[i];
    // @ifdef DEBUG
    dieIf(isNullOrUndefined(item.id), 'EdE6JHW0U2');
    // @endif
    if (item.id === idToDelete) {
      itemsWithId.splice(i, 1);
      break;
    }
  }
}


export function arr_deleteInPlace<T>(ts: T[], toDelete: T) {  // RENAME arr_delInPl + arr_delCp
  while (true) {
    const ix = ts.indexOf(toDelete);
    if (ix === -1)
      return;
    ts.splice(ix, 1);
  }
}

/*
export function arr_delete<T>(ts: T[], toDelete: T): T[] {
  const ix = ts.indexOf(toDelete);
  if (ix === -1)
    return ts;
  const clone = ts.slice();
  clone.splice(ix, 1);  // but loop and delete all? clone 1st time only?
  return clone;
} */


export function shallowMergeFirstItemLast(items: any[]): any {
  let result = {};
  if (items) {
    for (let i = items.length - 1; i >= 0; --i) {
      const item = items[i];
      if (item) {
        result = { ...result, ...item };
      }
    }
  }
  return result;
}


export function parsePostNr(postElem: HTMLElement): number {
  // 5 = drop 'post-' from 'post-123'.
  return parseInt(postElem.id && postElem.id.substr(5, 9));
}


/**
 * Calls the callback if the event happens on the selector, unless on the skipSelector.
 *
 * elem.matches('...:not(.aaa, .bbb)') doesn't work, because of the ','. Can use this
 * fn instead: set skipSelector to '.aaa, .bbb'.
 */
export function ifEventOnNotThen(event: string, selector: string,
      skipSelector: string, callback?: (elem: HTMLElement, event) => void) {
  Bliss.delegate(document.body, event, selector, function(event) {
    const elem: HTMLElement = <HTMLElement> event.target;
    if (!elem) return;
    if (skipSelector) {
      if (elem.matches && elem.matches(skipSelector))
        return;
    }
    callback(elem, event);
  });
}


export const $all = $bySelector;
export const $$all = $bySelector;  // use $all instead?
export const $$bySelector = $bySelector;  // returns many, so should be named $$... not just $...
export function $bySelector(selector: string, elem?): NodeListOf<Element> {   // RENAME
  return (elem || document).querySelectorAll(selector);
}

export function $first(selector: string, elem?): HTMLElement {
  const elems = (elem || document).querySelectorAll(selector);
  return <HTMLElement> (elems.length ? elems[0] : null);
}

export function $byId(elemId: string): HTMLElement {
  // @ifdef DEBUG
  dieIf(/#\., /.test(elemId), 'EdE2KWWE45');
  // @endif
  return document.getElementById(elemId);
}


export function $$byClass(className: string, context?): HTMLCollectionOf<Element> {
  // @ifdef DEBUG
  // getElementsByClassName() works with one single class only.
  dieIf(/#\., /.test(className), 'EdE5JLKS02');
  // @endif
  return (context || document).getElementsByClassName(className);
}


export const $h = {
  hasClass: function(elem: Element, clazz: string): boolean {
    return elem.classList.contains(clazz);
  },

  // classesString should be a space and/or comma separated class name string.
  addClasses: function(elem: Element, classesString: string) {
    if (!classesString || !elem) return;
    // @ifdef DEBUG
    dieIf(/#\./.test(classesString), 'EdE6EF2T47');
    // @endif
    const classes = classesString.replace(/ *, */g, ',').replace(/ +/g, ',').split(',');
    elem.classList.add(...classes);
  },


  removeClasses: function(elems: Element | Element[] | NodeList, classesString: string) {
    if (!classesString || !elems) {
      // If proceeding, would get this error:
      // """Failed to execute 'remove' on 'DOMTokenList': The token provided must not be empty."""
      return;
    }
    // @ifdef DEBUG
    dieIf(/#\./.test(classesString), 'EdEKEW20P7');
    // @endif
    const classes = classesString.replace(/ *, */g, ',').replace(/ +/g, ',').split(',');
    const anyElems = <any> elems;
    if (_.isNumber(anyElems.length)) {
      for (let i = 0; i < anyElems.length; ++i) {
        elems[i].classList.remove(...classes);
      }
    }
    else {
      anyElems.classList.remove(...classes);
    }
  },


  // Returns true if the class was added, that is, is present afterwards.
  //
  toggleClass: function(elem: Element, clazz: string): boolean {
    if (!clazz) return;
    // @ifdef DEBUG
    dieIf(/#\. /.test(clazz), 'EdE5JFB8W2');
    // @endif
    if (!elem) return;
    const classes = elem.classList;
    const shallAdd = !classes.contains(clazz);
    if (shallAdd) classes.add(clazz);
    else classes.remove(clazz);
    return shallAdd;
  },


  parseHtml: function(htmlText: string): HTMLCollection {
    const doc = document.implementation.createHTMLDocument(''); // empty dummy title
    doc.body.innerHTML = htmlText;
    return doc.body.children;
  },


  wrapParseHtml: function(htmlText: string): HTMLElement {
    return <HTMLElement> $h.parseHtml('<div>' + htmlText + '</div>')[0];
  }

};


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
