/* Copyright (c) 2010-2012 Kaj Magnus Lindberg. All rights reserved. */


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
