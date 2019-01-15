/*
 * Copyright (c) 2016, 2018 Kaj Magnus Lindberg
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

/// <reference path="../utils/react-utils.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.page.Hacks {
//------------------------------------------------------------------------------


/**
 * React roots outside the main root, can use this hacky function to
 * make navigation happen properly, in the main React root.
 * This single-page-app navigation only works if ExtReactRootNavComponent has
 * been mounted though — and then, this fn returns true; then the caller
 * should skip any default click event action.
 *
 * CLEAN_UP REFACTOR maybe not needed? Supposedly, if creating different Router:s in separate
 * react roots, but one gives them the same History object, they'll know what the others
 * are doing and update their own routes proprely, when navigation happens in another React root...
 * .. NO don't do that? Because it's ~ 4 kb min.js.gz, feels like too much, when not really needed.
 *
 * ...But still a bit needed, for any non-React links in the custom-html-top-header.
 */
export function navigateTo(path: string): boolean {
  return doNavigate(path);
}

let doNavigate: (string) => boolean = function() {
  return false;
};

export const ExtReactRootNavComponent = createReactClass({
  displayName: 'ExtReactRootNavComponent',

  componentWillMount: function() {
    doNavigate = (path: string) => {
      if (this.props.location.pathname !== path) {
        this.props.history.push(path);
        return true;
      }
    }
  },

  render: function() {
    return null;
  }
});


export function reactRouterLinkifyTopHeaderLinks() {
  Bliss.delegate(document, 'click', '.esPageHeader a[href]', function(event) {
    const elem = <HTMLLinkElement> event.target;
    if (!elem || !elem.href || !elem.href.length) return;
    // Try internal single-page-app navigation, if it's a link to a page here on the same site.
    const href = elem.href;
    let newUrlPath;
    if (href.search('//') === -1) {
      if (href[0] === '/') {
        // And absolute url path, like '/some/page'.
        newUrlPath = href;
      }
      else {
        // A relative link, like 'some/page', weird. Don't try SPA navigation.
        return;
      }
    }
    else if (href.search(location.origin) === 0) {
      // Something like 'https://this.server.com/page/path' — keep '/page/path' only.
      newUrlPath = href.substr(location.origin.length)
    }
    else if (href.search(`//${location.hostname}/`) === 0) {
      // Something like '//this.server.com/page/path' — keep '/page/path' only.
      newUrlPath = href.substr(location.hostname.length + 2);
    }
    else {
      // External link.
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    navigateTo(newUrlPath)
  });
}


export function processPosts(startElemId?: string) {
  const startElemSelector = startElemId ? '#' + startElemId : undefined;
  processTimeAgo(startElemSelector);
  hideShowCollapseButtons();
  addCanScrollHintsSoon();
  makeMentionsInEmbeddedCommentsPointToTalkyardServer();
  if (talkyard.postElemPostProcessor) {
    talkyard.postElemPostProcessor(startElemId || 't_PageContent');
  }
}


// Finds all tall posts and unhides their collapse button, which by default
// is hidden by CSS. [4KY0S2]
//
function hideShowCollapseButtons() {
  const collapseBtns = $$all('.dw-a-clps');
  _.each(collapseBtns,function(collapseBtn) {
    // Three steps up: dw-p-hd —> .dw-p —> .dw-t, we'll find the .closest('.dw-t').  IE11 doesn't
    // support .closest.
    const threadElem = collapseBtn.parentElement.parentElement.parentElement;
    if (!threadElem) return;
    const rect = threadElem.getBoundingClientRect();  // ooops, FORCED_REFLOW caused by this line
    if (rect.height > 170) {
      $h.addClasses(collapseBtn, 'esP_Z-Show');       // ... and this
    }
    else {
      $h.removeClasses(collapseBtn, 'esP_Z-Show');    // ... and this
    }
  });
}


function addCanScrollHintsImpl() {
  // Remove scroll hints for elemes that no longer need it.
  const elemsWithHint = $$all('.dw-p-bd.esScrollHint-X');
  _.each(elemsWithHint,function(elem) {
    const overflowsX = elem.scrollWidth > elem.clientWidth;
    if (!overflowsX) {
      // (Some of these will be checked again in the 2nd $('.dw-p-bd...') call below.)
      $h.removeClasses(elem, 'esScrollHint-X');
    }
  });
  // Add scroll hints for elemes that need it.
  const elemsNoHint = $$all('.dw-p-bd:not(.esScrollHint-X)');
  _.each(elemsNoHint,function(elem) {
    const overflowsX = elem.scrollWidth > elem.clientWidth;
    if (overflowsX) {
      $h.addClasses(elem, 'esScrollHint-X');
    }
  });
}

export const addCanScrollHintsSoon = _.debounce(addCanScrollHintsImpl, 1100);


function makeMentionsInEmbeddedCommentsPointToTalkyardServer() {
  // If not an embedded comments page, relative user profile links in mentions, work fine
  // — need do nothing. However, in embedded comments pages, relative links would  [6JKD2A]
  // resolve to (non existing) pages on the embedding server.
  // Make them point to the Talkyard server instead.
  //
  // (This could alternatively be done, by including the Takyard server origin, when
  // rendering the comments from Markdown to HTML. But this approach (below) is simpler,
  // and works also if the Talkyard server moves to a new address (won't need
  // to rerender all comments and pages).)

  if (!eds.isInEmbeddedCommentsIframe)
    return;

  const mentions = debiki2.$all('.dw-p-bd .esMention[href]:not([href^="http"])');
  for (let i = 0; i < mentions.length; ++i) {
    const mention = mentions[i];
    const href = mention.getAttribute('href');
    if (href.indexOf(origin()) === 0) {
      // Skip, already processed.
    }
    else {
      const hrefNoOrigin = href.replace(OriginRegex, '');
      mention.setAttribute('href', origin() + hrefNoOrigin);
    }
  }
}


/**
 * Safari in iOS 12 hides, and doesn't show again, the contents in an iframe, if one scrolls.
 * However, if some rendering setting changes, then Safari does repaint so the iframe
 * becomes visible again. The setting needs to be something that for real changes
 * how things look, so cannot just do a no-op. Let's change the opacity — no human will
 * notice this, but iOS will rerender.
 *
 * If doing this only after scrolling (from client/app-slim/if-in-iframe.ts,
 * the 'iframeOffsetWinSize' event) then in some cases this bug workaround
 * won't work — the iframe contents becomes invisible in some other cases too,
 * e.g. if one clicks the Safari address bar. (At least in the SauceLabs emulator.)
 * So let's do once per second, always, instead.
 *
 * DO_AFTER 2019-06-01 see if Apple has fixed this iOS Safari bug; then add a do-after
 * comment to remove this workaround 3 months later (when most people have upgraded?).
 *
 * This happens only with iOS 12 not iOS 11, but let's do for all iOS versions,
 * for simplicity. (iOS 11 has a jump-to-scroll-bottom-if-opens-any-dialog
 * bug instead :-P  only iOS 11)
 */
export function maybeStartIosBugfix() {
  return; /*
  if (eds.isIos && eds.isInIframe) {
    console.info("Starting iOS 12 Safari invisible iframe bug workaround. [TyMAPLBUG]");
    setInterval(function() {
      iosBugFixCounter += 1;
      document.getElementById('esPageColumn').style.opacity =
          iosBugFixCounter % 2 === 0 ? '1' : '0.99';
    }, 1000);
  } */
}

let iosBugFixCounter = 0;


/**
 * This is for debugging emulated browsers with Weinre, on localhost. E.g. iOS Safari,
 * in a SauceLabs emulated iPhone, connected to localhost via a tunnel (see below).
 * Assume Weinre runs on port 8090 on localhost because Node.js' http-server listens on 8080
 * when testing embedded comments. 8080 is otherwise Weinre's default port.
 * Start like so:  node_modules/.bin/weinre --boundHost -all-  --httpPort 8090
 * Info about Weinre and how to install it:  http://people.apache.org/~pmuellr/weinre/
 * And you also need to work around a Weinre bug, and maybe add a SauceLabs tunnel, see:
 * docs/debugging-ios-safari-without-iphone.md
 *
 * Wrap in try-catch so any uninteresting bug here, just for enabling debug,
 * won't break everything.
 */
try {
  if (debiki2.getMainWin().location.hash.indexOf('&loadWeinre') >= 0) {  // [WEINRE]
    console.info("Lazy loading Weinre [TyMWEINRE]");
    // 127.0.0.1 doesn't work in SauceLab's iPhone emulator — but 'localhost' works.
    debiki2.Server.loadJs('http://localhost:8090/target/target-script-min.js#anonymous');
    // This might be needed for Android — then, 10.0.2.2 resolves to localhost, at least
    // in the past. If needed, just load the Weinre script from both these locations
    // (above and below), one will fail, one will work.
    //debiki2.Server.loadJs('http://10.0.2.2:8090/target/target-script-min.js#anonymous');
  }
}
catch (ex) {
  console.warn("Error loading Weinre [TyE0WEINRE]", ex);
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
