/* Copyright (c) 2010 - 2012 Kaj Magnus Lindberg. All rights reserved. */


(function() {

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


var html_sanitizer_bundle =
    require('html_sanitizer_bundle') ||  // prod builds
    { googleCajaSanitizeHtml: googleCajaSanitizeHtml };  // dev builds


// Converts markdown to sanitized html.
d.i.markdownToSafeHtml = function(markdownSrc, hostAndPort, sanitizerOptions) {
  var htmlTextUnsafe = markdownToUnsafeHtml(markdownSrc, hostAndPort);
  var htmlTextSafe = d.i.sanitizeHtml(htmlTextUnsafe, sanitizerOptions);
  return htmlTextSafe;
};


function markdownToUnsafeHtml(markdownSrc, hostAndPort) {
  var converter = new Showdown.converter();
  var htmlTextUnsafe = converter.makeHtml(markdownSrc, hostAndPort);
  return htmlTextUnsafe;
};


/**
 * Calls Google Caja JsHtmlSanitizer to sanitize the html.
 *
 * options.allowClassAndIdAttr = true/false
 * options.allowDataAttribs = true/false
 */
d.i.sanitizeHtml = function(htmlTextUnsafe, options) {
  var htmlTextSafe = html_sanitizer_bundle.googleCajaSanitizeHtml(
      htmlTextUnsafe, options.allowClassAndIdAttr, options.allowDataAttr);
  return htmlTextSafe;
};


d.i.sanitizerOptsForPost = function($post) {
  return {
    allowClassAndIdAttr: $post.dwIsArticlePost(),
    allowDataAttr: $post.dwIsArticlePost()
  };
};


})();

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
