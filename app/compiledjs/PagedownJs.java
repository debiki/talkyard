/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package compiledjs;

/**
 * Java interface to client/compiledjs/PagedownJavaInterface.js.
 *
 * (...Which in turn calls modules/pagedown/Markdown.Converter.js to convert
 * Markdown to HTML.)
 *
 * Compiled by the Makefile in the project directory.
 */
public interface PagedownJs {

  String makeHtml(String source, String hostAndPort);

}

