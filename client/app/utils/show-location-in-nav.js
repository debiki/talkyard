/* Highligts the current page/section in the navigation menu.
 * Copyright (C) 2010-2012 Kaj Magnus Lindberg (born 1979)
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

(function() {

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


// Adds class 'debiki-current-site-section' to the navigation
// menu link that matches the current window.location.
// However, unless you are on the home page, links to the home page
// (which is assumed to be '/') are ignored, because *everything* is below
// the homepage, so homepage links would otherwise always be marked.
d.i.showCurLocationInSiteNav = function() {
  function $isCurSectionLink() {
    var link = $(this).attr('href');
    var linkPathStart =
      link.search('https?://') === 0 ? link.indexOf('/', 8) : 0;
    // Same protocol, host and port, a.k.a. origin?
    var linkOrigin = link.substr(0, linkPathStart);
    if (linkOrigin.length !== 0 && linkOrigin !==  locationOrigin())
      return false;
    // Exact path match? (include home page links)
    var linkPath = link.substr(linkPathStart);
    if (linkPath === location.pathname)
      return true;
    // Ignore links to the home page.
    if (linkPath === '/')
      return false;
    // Ignore links with query string or hash parts.
    // {{{ Then I can include in the site <nav> links to a certain
    // Subscribe part of my homepage ,without that link being
    // considered a separate site section. }}}
    if (linkPath.search(/[?#]/) !== -1)
      return false;
    // Does `location' start with `linkPath'?
    var locStartsWithLink = location.pathname.search(linkPath) === 0;
    return locStartsWithLink;
  };

  $('.debiki-0-mark-current-site-section a[href]')
      .filter($isCurSectionLink)
      .addClass('debiki-0-current-site-section');
};


function locationOrigin() {
  // Only Chrome has location.origin.
  return location.protocol +"//"+ location.host +"/";
}


})();

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
