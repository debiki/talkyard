/* A Java interface to Javascript Markdown code.
 * Copyright (C) 2012-2013 Kaj Magnus Lindberg (born 1979)
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


/**
 * Implements the Java interface to Markdown specified in
 * app/compiledjs/PagedownJs.java.
 *
 * (`gulpfile.js` ensures modules/pagedown/Markdown.Converter.js has
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
