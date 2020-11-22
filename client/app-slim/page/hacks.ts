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
export function navigateTo(path: St): Vo {
  doNavigate(path);
}

let doNavigate: (url: St) => Vo = function(url: St) {
  location.assign(url);
};

export const ExtReactRootNavComponent = createReactClass({
  displayName: 'ExtReactRootNavComponent',

  UNSAFE_componentWillMount: function() {
    doNavigate = (url: string) => {
      // this.props.location is made available by ReactRouter — we should be
      // wrapped in a Router(..., Routes( ... )) component.
      const loc = this.props.location;
      const localPath = url_asLocalAbsPath(url, loc);
      if (!localPath) {
        // External link.
        window.location.assign(url);
        return;
      }

      // Already at the desired url?
      if (loc.pathname === localPath)
        return;

      const linksToAdminArea = localPath.indexOf('/-/admin/') === 0; // dupl [5JKSW20]
      const canSinglePageAppNavigate = eds.isInAdminArea === linksToAdminArea;

      if (!canSinglePageAppNavigate) {
        window.location.assign(url);
        return;
      }

      // We can single-page-navigate without any page reload.
      this.props.history.push(localPath);

      // (Now, ReactRouter will mount new routes and components — and they'll
      // typically fetch json from the server.)
    }
  },

  render: function() {
    return null;
  }
});


/// Changes a url to a server local url path, if the url is to the
/// same origin.  If cannot do this, returns false.
///
function url_asLocalAbsPath(url: St, loc: { origin: St, hostname: St }): St | false {
  // Is it a path, no origin or hostname?
  const slashSlashIx = url.indexOf('//');
  let isPathMaybeQuery = slashSlashIx === -1;
  if (!isPathMaybeQuery) {
    // Ignore any url in any query string or hash fragment.
    const queryIx = url.indexOf('?');
    const hashIx = url.indexOf('#');
    isPathMaybeQuery = (queryIx !== -1 && queryIx < slashSlashIx) ||
                       (hashIx !== -1 && hashIx < slashSlashIx);
  }

  if (isPathMaybeQuery) {
    // It's already an absolute url path, like '/some/page'?
    if (url[0] === '/')
      return url;

    // A relative link, like 'some/page', weird. Don't try SPA navigation.
    return false;
  }

  // Something like 'https://this.server.com/page/path'?  Keep '/page/path' only.
  if (url.indexOf(loc.origin) === 0)
    return url.substr(loc.origin.length)

  // Something like '//this.server.com/page/path'?  Keep '/page/path' only.
  if (url.indexOf(`//${loc.hostname}/`) === 0)
    return url.substr(loc.hostname.length + 2);

  // External link.
  return false;
}


export function reactRouterLinkifyTopHeaderLinks() {
  Bliss.delegate(document.body, 'click', '.esPageHeader a[href]', function(event) {
    const elem = <HTMLLinkElement> event.target;
    if (!elem || !elem.href || !elem.href.length) return;
    // Try internal single-page-app navigation, if it's a link to a page here on the same site.
    const asLocalPath: St | false = url_asLocalAbsPath(elem.href, location);
    if (!asLocalPath) {
      // External link — let the browser handle this.
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    doNavigate(asLocalPath)
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
  if (location.hash.indexOf('&loadWeinre') >= 0) {  // [WEINRE]
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
