

/**
 * Implements the Java interface to Markdown specified in
 * app/compiledjs/PagedownJs.java.
 *
 * (`grunt.js` ensures modules/pagedown/Markdown.Converter.js has
 * been prepended before this function.)
 */
function makeHtml(jSource, jHostAndPort) {

  // Convert from java.lang.String objects to Javascript strings.
  // (Otherwise this error happened:
  // void error: org.mozilla.javascript.EvaluatorException: "The choice of
  //   Java constructor replace matching JavaScript argument types
  //   (function,string) is ambiguous"  )
  var source = new String(jSource);
  var hostAndPort = jHostAndPort ? new String(jHostAndPort) : null;

  var converter = new Markdown.Converter();

  // This hook inserts the appropriate server name into links where
  // the server has been left out.
  // For example, changes: http:///file/on/local/server.txt
  // to: http://server.address.com/file/on/local/server.txt
  // **Duplicated** hook. See client/compiledjs/PagedownJavaInterface.js.
  // (This hook is for the JVM. The duplicate is for the browser.)
  if (hostAndPort) converter.hooks.chain('postConversion', function(text) {
    return text.replace(/(https?:\/\/)\//g, '$1'+ hostAndPort +'/');
  });

  return converter.makeHtml(source);
};


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
