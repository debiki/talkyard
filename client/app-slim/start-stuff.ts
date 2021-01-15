/* Starts stuff, a bit hacky.
 * Copyright (c) 2010-2017 Kaj Magnus Lindberg
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


debiki.startStuff = function() {

var d = { i: debiki.internal, u: debiki.v0.util };

debiki.debug = window.location.search.indexOf('debug=true') >= 0;

if (eds.isInEmbeddedCommentsIframe || eds.isInEmbeddedEditor) {
  debiki2.startIframeMessages();
}


// Debiki convention: Dialog elem tabindexes should vary from 101 to 109.
// HTML generation code assumes this, too. See Debiki for Developers, #7bZG31.
d.i.DEBIKI_TABINDEX_DIALOG_MAX = 109;

debiki2.rememberBackUrl();

// Later, when there's a single router for everything, bind this to router events instead:
debiki2.utils.highlightActiveLinkInHeader();

// Replace gifs with static images that won't play until clicked.
window['Gifffer']();

// Show large images on click.
window['StupidLightbox'].start('.dw-p-bd', '.giffferated, .no-lightbox');


// Open about-user dialog if one clicks a @username mention (instead of navigating away to
// the about-user page).
debiki2.ifEventOnNotThen('click', 'a.esMention', '',
        function(linkElem: HTMLAnchorElement, event: MouseEvent) {
  event.preventDefault();
  var username = linkElem.href.replace(/^.*\/-\/users\//, '');
  debiki2.morebundle.openAboutUserDialog(username, linkElem);
});


d.u.addZoomOrResizeListener(debiki2.page.Hacks.addCanScrollHintsSoon);


// Example: If running the Takyard server in a Vagrant VM, and accessing it on the host
// at localhost:8080 — then, by default, the Talkyard server generates e.g. email
// verification links pointing to port 80, the default HTTP port. However, when on the host
// port 8080 is in used (and mapped by Vagrant to 80 in the VM) — these port 80 server
// generated links won't work, and those who try out the server in Vagrant will get confused.
// So add a warning:
debiki2.dieIf(location.port && eds.debugOrigin.indexOf(':' + location.port) === -1,
  "Wrong port or origin? The server thinks its origin is " + eds.debugOrigin +
  " and it'll use that address when sending POST requests and loading scripts. " +
  "But you're accessing the server via " + location.host + ". [EsE7YGK2]");


  switch (eds.doWhat) {
    case 'StartPage':
      d.i.renderPageInBrowser();
      break;
    case 'ResetPwd':
      debiki2.Server.loadMoreScriptsBundle(function() {
        debiki2.login['renderNewPasswordPage']();
      });
      break;
    case 'Noop':
      break;
    default:
      debiki2.die(`Bad doWhat: ${eds.doWhat} [TyE503RSMT]`);
  }

}

// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list