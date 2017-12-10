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

var d = { i: debiki.internal, u: debiki.v0.util };

debiki.FirstSiteId = '1';
debiki.debug = window.location.search.indexOf('debug=true') >= 0;
d.i.TitleNr = 0;
d.i.BodyNr = 1;

var allPostsNotTitleSelector = '.debiki .dw-p:not(.dw-p-ttl)';

// Debiki convention: Dialog elem tabindexes should vary from 101 to 109.
// HTML generation code assumes this, too. See Debiki for Developers, #7bZG31.
d.i.DEBIKI_TABINDEX_DIALOG_MAX = 109;

debiki2.rememberBackUrl(location.toString());

// Later, when there's a single router for everything, bind this to router events instead:
debiki2.utils.highlightActiveLinkInHeader();

// Replace gifs with static images that won't play until clicked.
Gifffer();

// Show large images on click.
StupidLightbox.start('.dw-p-bd', '.giffferated, .no-lightbox');


// Open about-user dialog if one clicks a @username mention (instead of navigating away to
// the about-user page).
debiki2.ifEventOnNotThen('click', 'a.esMention', '', function(linkElem, event) {
  event.preventDefault();
  var username = linkElem.href.replace(/^.*\/-\/users\//, '');
  debiki2.morebundle.openAboutUserDialog(username, linkElem);
});


d.u.addZoomOrResizeListener(debiki2.page.Hacks.addCanScrollHintsSoon);


debiki2.dieIf(location.port && debiki.internal.serverOrigin.indexOf(':' + location.port) === -1,
  "Wrong port or origin? The server thinks its origin is " + debiki.internal.serverOrigin +
  " and it'll use that address when sending POST requests and loading scripts. " +
  "But you're accessing the server via " + location.host + ". [EsE7YGK2]");


// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list
