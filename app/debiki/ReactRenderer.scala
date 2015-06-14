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
import debiki.DebikiHttp.throwInternalError
import java.{util => ju, io => jio}
import javax.{script => js}
import play.api.Play
import play.api.Play.current
import scala.concurrent.ExecutionContext.Implicits.global


/**
  * Implementation details:
  *
  * Initializing a Nashorn engine takes long, perhaps 3 - 10 seconds now when
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
object ReactRenderer extends com.debiki.core.CommonMarkRenderer {

  private val logger = play.api.Logger

  /** The Nashorn Javascript engine isn't thread safe.  */
  private val javascriptEngines =
    new java.util.concurrent.LinkedBlockingDeque[js.ScriptEngine](999)

  private val BrokenEngine = new js.AbstractScriptEngine() {
    override def eval(script: String, context: js.ScriptContext): AnyRef = null
    override def eval(reader: jio.Reader, context: js.ScriptContext): AnyRef = null
    override def getFactory: js.ScriptEngineFactory = null
    override def createBindings(): js.Bindings = null
  }


  def startCreatingRenderEngines() {
    dieIf(!javascriptEngines.isEmpty, "DwE50KFE2")
    scala.concurrent.Future {
      val numCores =
        if (Play.isProd) Runtime.getRuntime.availableProcessors
        else {
          // Initializing cores takes rather long, so only init one core in dev mode.
          1
        }
      for (i <- 1 to numCores) {
        val engine = try { makeJavascriptEngine() }
        catch {
          case t: Throwable =>
            logger.error("Error creating Javascript engine: [DwE4KEPF8]", t)
            javascriptEngines.clear()
            javascriptEngines.putLast(BrokenEngine)
            return
        }
        javascriptEngines.putLast(engine)
      }
    }
  }


  def renderPage(initialStateJson: String): String = {
    withJavascriptEngine(engine => {
      val timeBefore = (new ju.Date).getTime

      engine.invokeFunction("setInitialStateJson", initialStateJson)
      val pageHtml = engine.invokeFunction("renderReactServerSide").asInstanceOf[String]

      def timeElapsed = (new ju.Date).getTime - timeBefore
      def threadId = java.lang.Thread.currentThread.getId
      def threadName = java.lang.Thread.currentThread.getName
      logger.trace(s"Done rendering: $timeElapsed ms, thread $threadName  (id $threadId)")

      pageHtml
    })
  }


  override def renderAndSanitizeCommonMark(commonMarkSource: String,
        allowClassIdDataAttrs: Boolean, followLinks: Boolean): String = {
    withJavascriptEngine(engine => {
      val safeHtml = engine.invokeFunction("renderAndSanitizeCommonMark", commonMarkSource,
          allowClassIdDataAttrs.asInstanceOf[Object], followLinks.asInstanceOf[Object])
      safeHtml.asInstanceOf[String]
    })
  }


  override def sanitizeHtml(text: String): String = {
    withJavascriptEngine(engine => {
      val safeHtml = engine.invokeFunction("sanitizeHtml", text)
      safeHtml.asInstanceOf[String]
    })
  }


  private def withJavascriptEngine(fn: (js.Invocable) => String): String = {
    def threadId = Thread.currentThread.getId
    def threadName = Thread.currentThread.getName

    val mightBlock = javascriptEngines.isEmpty
    if (mightBlock) {
      logger.debug(s"Thread $threadName (id $threadId), waits for JS engine...")
    }

    val engine = javascriptEngines.takeFirst()

    if (mightBlock) {
      logger.debug(s"...Thread $threadName (id $threadId) got a JS engine.")
      if (engine eq BrokenEngine) {
        logger.debug(s"...But it is broken; I'll throw an error. [DwE4KEWV52]")
      }
    }

    if (engine eq BrokenEngine) {
      throwInternalError("DwE5KGF8", "Could not create Javascript engine; cannot render page.")
    }

    val result = fn(engine.asInstanceOf[js.Invocable])
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
        |// React-Router calls setTimeout(), but it's not available in Nashorn.
        |function setTimeout(callback) {
        |  callback();
        |}
        |
        |function renderReactServerSide() {
        |  try {
        |    return renderTitleBodyCommentsToString();
        |  }
        |  catch (e) {
        |    printStackTrace(e);
        |  }
        |  return "Error rendering React components on server [DwE2GKD92]";
        |}
        |""")

    val min = if (Play.isDev) "" else ".min"
    val javascriptStream = getClass.getResourceAsStream(s"/public/res/renderer$min.js")
    newEngine.eval(new java.io.InputStreamReader(javascriptStream))

    newEngine.eval(i"""
        |$RenderAndSanitizeCommonMark
        |""")

    def timeElapsed = (new ju.Date).getTime - timeBefore
    logger.debug(o"""... Done initializing Nashorn engine, took: $timeElapsed ms,
         thread id: $threadId, name: $threadName""")

    newEngine
  }


  private val RenderAndSanitizeCommonMark = i"""
    |var md;
    |try {
    |  md = markdownit({ html: true });
    |  md.use(debiki.internal.MentionsMarkdownItPlugin());
    |}
    |catch (e) {
    |  printStackTrace(e);
    |  console.error("Error creating CommonMark renderer [DwE5kFEM9]");
    |}
    |
    |function renderAndSanitizeCommonMark(source, allowClassIdDataAttrs, followLinks) {
    |  try {
    |    var unsafeHtml = md.render(source);
    |    var allowClassAndIdAttr = allowClassIdDataAttrs;
    |    var allowDataAttr = allowClassIdDataAttrs;
    |    if (!followLinks) {
    |      unsafeHtml = unsafeHtml.replace(/<a /, "<a rel='nofollow' ")
    |    }
    |    return googleCajaSanitizeHtml(unsafeHtml, allowClassAndIdAttr, allowDataAttr);
    |  }
    |  catch (e) {
    |    printStackTrace(e);
    |  }
    |  return "Error rendering CommonMark on server [DwE4XMYD8]";
    |}
    |
    |function sanitizeHtml(source) {
    |  try {
    |    source = source.replace(/<a /, "<a rel='nofollow' ")
    |    return googleCajaSanitizeHtml(source, false, false);
    |  }
    |  catch (e) {
    |    printStackTrace(e);
    |  }
    |  return "Error sanitizing HTML on server [DwE5GBCU6]";
    |}
    |"""


  private val DummyConsoleLogFunctions = i"""
    |var console = {
    |  trace: function(message) {
    |    java.lang.System.out.println('Nashorn TRACE: ' + message);
    |  },
    |  debug: function(message) {
    |    java.lang.System.out.println('Nashorn DEBUG: ' + message);
    |  },
    |  log: function(message) {
    |    java.lang.System.out.println('Nashorn LOG: ' + message);
    |  },
    |  warn: function(message) {
    |    java.lang.System.err.println('Nashorn WARN: ' + message);
    |  },
    |  error: function(message) {
    |    java.lang.System.err.println('Nashorn ERROR: ' + message);
    |  }
    |};
    |
    |function printStackTrace(exception) {
    |  console.error('File: ' + exception.fileName);
    |  console.error('Line: ' + exception.lineNumber);
    |  console.error('Column: ' + exception.columnNumber);
    |  console.error('Stack trace: ' + exception.stack);
    |}
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
