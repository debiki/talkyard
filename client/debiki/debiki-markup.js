/* Copyright (c) 2010 - 2012 Kaj Magnus Lindberg. All rights reserved. */


(function() {

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


// Converts markdown to sanitized html.
d.i.markdownToSafeHtml = function(markdownSrc, hostAndPort, sanitizerOptions) {
  var htmlTextUnsafe = markdownToUnsafeHtml(markdownSrc, hostAndPort);
  var htmlTextSafe = d.i.sanitizeHtml(htmlTextUnsafe, sanitizerOptions);
  return htmlTextSafe;
};


function markdownToUnsafeHtml(markdownSrc, hostAndPort) {
  var converter = new Markdown.Converter();

  // Duplicated hook. See client/compiledjs/PagedownJavaInterface.js.
  // (This hook is for the browser. The duplicate is for the JVM.)
  converter.hooks.chain('postConversion', function(text) {
    return text.replace(/(https?:\/\/)\//g, '$1'+ hostAndPort +'/');
  });

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
  var htmlTextSafe = d.i.googleCajaSanitizeHtml(
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
