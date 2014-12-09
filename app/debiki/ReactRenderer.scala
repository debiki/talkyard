/**
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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

package debiki

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import java.{lang => jl, io => jio}
import javax.{script => js}



object ReactRenderer {


  /** The Nashorn Javascript engine isn't thread safe. */
  private val threadLocalJavascriptEngine = new jl.ThreadLocal[js.ScriptEngine]


  def renderPage(initialStateJson: String): String = {
    val invocableEngine = javascriptEngine.asInstanceOf[js.Invocable]
    invocableEngine.invokeFunction("setInitialStateJson", initialStateJson)
    val titleBodyComments = invocableEngine.invokeFunction(
      "renderReactServerSide").asInstanceOf[String]
    titleBodyComments.toString
  }


  private def javascriptEngine: js.ScriptEngine = {
    val engineOrNull = threadLocalJavascriptEngine.get
    if (engineOrNull != null)
      return engineOrNull

    // Pass 'null' to force the correct class loader. Without passing any param,
    // the "nashorn" JavaScript engine is not found by the `ScriptEngineManager`.
    // See: https://github.com/playframework/playframework/issues/2532
    val newEngine = new js.ScriptEngineManager(null).getEngineByName("nashorn")

    // React expects `window` or `global` to exist, and my React code sometimes
    // load React components from `window['component-name']`.
    newEngine.eval("var global = window = this;")

    newEngine.eval(i"""
        |var exports = {};
        |$DummyConsoleLogFunctions
        |$ServerSideDebikiModule
        |$ServerSideReactStore
        |
        |function renderReactServerSide() {
        |  try {
        |    return renderTitleBodyCommentsToString();
        |  }
        |  catch (e) {
        |    print(e.stack)
        |    print(e.lineNumber)
        |    print(e.columnNumber)
        |    print(e.fileName)
        |  }
        |  return "Error rendering React components on server [DwE2GKD92]";
        |}
        |""")

    def evalFile(path: String) {
      val stream = getClass().getResourceAsStream(path)
      newEngine.eval(new java.io.InputStreamReader(stream))
    }
    evalFile("/public/res/renderer.js")

    threadLocalJavascriptEngine.set(newEngine)
    newEngine
  }


  private val DummyConsoleLogFunctions = i"""
    |var console = {
    |  trace: function(message) {
    |    java.lang.System.out.println('Nashorn TRC: ' + message);
    |  },
    |  debug: function(message) {
    |    java.lang.System.out.println('Nashorn DBG: ' + message);
    |  },
    |  log: function(message) {
    |    java.lang.System.out.println('Nashorn LOG: ' + message);
    |  },
    |  warn: function(message) {
    |    java.lang.System.out.println('Nashorn WNR: ' + message);
    |  },
    |  error: function(message) {
    |    java.lang.System.out.println('Nashorn ERR: ' + message);
    |  }
    |};
    |"""


  private val ServerSideDebikiModule = i"""
    |var debiki = {
    |  store: {},
    |  v0: { util: {} },
    |  internal: {}
    |};
    |"""


  /** A React store from which the React components can get their initial state,
    * when they're being rendered server side.
    *
    * Doesn't provide any event related functions because non events happen when
    * rendering server side.
    */
  private val ServerSideReactStore = i"""
    |var debiki2 = debiki2 || {};
    |
    |debiki2.ReactStore = {
    |  allData: function() {
    |    return initialStateJson;
    |  },
    |  getUser: function() {
    |    return initialStateJson.user;
    |  }
    |};
    |
    |var initialStateJson = {};
    |
    |function setInitialStateJson(jsonString) {
    |  var json = JSON.parse(jsonString);
    |  initialStateJson = json;
    |}
    |"""

}
