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
import java.{lang => jl, util => ju, io => jio}
import javax.{script => js}
import scala.concurrent.ExecutionContext.Implicits.global


/**
  * Implementation details:
  *
  * Initializing a Nashorn engine takes long, perhaps 3 - 30 seconds now when
  * I'm testing on localhost. So, on startup, I'm initializing many engines
  * and inserting them into a thread safe blocking collection. One engine
  * per core. Later on, when rendering a page, the render thread fetches
  * an engine from the collection. And blocks until one is available.
  * Once done initializing one engine per core, render threads should block
  * no more, since there will be one engine per core.
  *
  * Using a thread local doesn't work well, because Play/Akka apparently
  * creates new threads, or has 50 - 100 'play-akka.actor.default-dispatcher-NN'
  * threads, and it doesn't make sense to create engines for that many threads.
  */
object ReactRenderer {

  private val logger = play.api.Logger

  /** The Nashorn Javascript engine isn't thread safe.  */
  private val javascriptEngines =
    new java.util.concurrent.LinkedBlockingDeque[js.ScriptEngine](999)


  def renderPage(initialStateJson: String): String = {
    withJavascriptEngine(engine => {
      val timeBefore = (new ju.Date).getTime

      val invocable = engine.asInstanceOf[js.Invocable]
      invocable.invokeFunction("setInitialStateJson", initialStateJson)
      val pageHtml = invocable.invokeFunction("renderReactServerSide").asInstanceOf[String]

      def timeElapsed = (new ju.Date).getTime - timeBefore
      def threadId = java.lang.Thread.currentThread.getId
      def threadName = java.lang.Thread.currentThread.getName
      logger.trace(s"Done rendering: $timeElapsed ms, thread $threadName  (id $threadId)")

      pageHtml
    })
  }


  private def withJavascriptEngine(fn: (js.ScriptEngine) => String): String = {
    def threadId = Thread.currentThread.getId
    def threadName = Thread.currentThread.getName

    val mightBlock = javascriptEngines.isEmpty
    if (mightBlock) {
      logger.debug(s"Thread $threadName (id $threadId), waits for JS engine...")
    }

    val engine = javascriptEngines.takeFirst()

    if (mightBlock) {
      logger.debug(s"...Thread $threadName (id $threadId) got a JS engine.")
    }

    val result = fn(engine)
    javascriptEngines.addFirst(engine)
    result
  }


  private def makeJavascriptEngine(): js.ScriptEngine = {
    val timeBefore = (new ju.Date).getTime
    def threadId = java.lang.Thread.currentThread.getId
    def threadName = java.lang.Thread.currentThread.getName
    logger.debug(s"Initializing Nashorn engine, thread id: $threadId, name: $threadName...")

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
        |    print('File: ' + e.fileName);
        |    print('Line: ' + e.lineNumber);
        |    print('Column: ' + e.columnNumber);
        |    print('Stack trace: ' + e.stack);
        |  }
        |  return "Error rendering React components on server [DwE2GKD92]";
        |}
        |""")

    val min = if (play.api.Play.isDev) "" else ".min"
    val javascriptStream = getClass.getResourceAsStream(s"/public/res/renderer$min.js")
    newEngine.eval(new java.io.InputStreamReader(javascriptStream))

    def timeElapsed = (new ju.Date).getTime - timeBefore
    logger.debug(o"""... Done initializing Nashorn engine, took: $timeElapsed ms,
         thread id: $threadId, name: $threadName""")

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


  scala.concurrent.Future {
    val numCores = Runtime.getRuntime.availableProcessors
    for (i <- 1 to numCores) {
      javascriptEngines.putLast(makeJavascriptEngine())
    }
  }

}
