/**
 * Copyright (C) 2012 Kaj Magnus Lindberg (born 1979)
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

package compiledjs;

/**
 * Java interface to this Javascript code, compiled to Java:
 *   client/compiledjs/PagedownJavaInterface.js.
 *
 * (...Which in turn calls modules/pagedown/Markdown.Converter.js to convert
 * Markdown to HTML.)
 *
 * Compiled by the Makefile in the project directory.
 */
public interface PagedownJs {

  String makeHtml(String source, String hostAndPort);

}

