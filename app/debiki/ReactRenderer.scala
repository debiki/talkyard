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
import debiki.onebox.InstantOneboxRendererForNashorn
import org.apache.lucene.util.IOUtils
import play.api.Play
import play.api.Play.current
import scala.concurrent.Future
import scala.concurrent.ExecutionContext.Implicits.global
import scala.util.{Try, Success, Failure}


// COULD move elsewhere. Placed here only because the pwd strength function is
// zxcvbn implemented in Javascript, which is what this file deals with.
case class PasswordStrength(
  entropyBits: Float,
  crackTimeSeconds: Float,
  crackTimeDisplay: String,
  score: Int) {

  /** zxcvbn score 4 is the highest score, see https://github.com/dropbox/zxcvbn. */
  def isStrongEnough = score >= 4
}


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

  /** Initializing engines takes rather long, so create only two in dev mode:
    * one for the RenderContentService background actor, and one for
    * http request handler threads that need to render content directly.
    */
  val MinNumEngines = 2

  @volatile private var firstCreateEngineError: Option[Throwable] = None


  // Evaluating zxcvbn.min.js (a Javascript password strength check library) takes almost
  // a minute in dev mode. So enable server side password strength checks in prod mode only.
  // COULD run auto test suite on prod build too so server side pwd strength checks gets tested.
  private val passwordStrengthCheckEnabled = Play.isProd && false // disable for now, toooooo slow

  /** Bug: Apparently this reloads the Javascript code, but won't reload Java/Scala code
    * called from inside the JS code. This results in weird impossible things like
    * two versions of debiki.Global: one old version used when calling out to Scala from my
    * JS code, and one new version used in the rest of the application *after* Play has
    * soft-reloaded the app. Workaround: Kill the server: ctrl-d (ctrl-c not needed) and restart.
    * I'm thinking the reason Nashorn reuses old stale classes is that:
    *   "The only way that a Class can be unloaded is if the Classloader used is garbage collected"
    *   http://stackoverflow.com/a/148707/694469
    * but the Extensions class loader loads the script and then also the Java/Scala stuff they
    * call out to? And that classloader is never unloaded I suppose. In order to refresh
    * the Scala code called from my Nashorn JS, perhaps I need to somehow use a custom
    * classloader here?
    */
  def startCreatingRenderEngines() {
    if (Globals.isTestDisableScripts)
      return
    if (!javascriptEngines.isEmpty) {
      dieIf(!Play.isTest, "DwE50KFE2")
      // We've restarted the server as part of the tests? but this object lingers? Fine.
      return
    }
    Future {
      val numEngines =
        if (Play.isProd) {
          math.max(MinNumEngines, Runtime.getRuntime.availableProcessors)
        }
        else {
          MinNumEngines
        }
      for (i <- 1 to numEngines) {
        createOneMoreJavascriptEngine(isVeryFirstEngine = i == 1)
      }
    }
  }


  def numEnginesCreated = javascriptEngines.size()


  private def createOneMoreJavascriptEngine(isVeryFirstEngine: Boolean = false) {
    val engine = try {
      makeJavascriptEngine()
    }
    catch {
      case throwable: Throwable =>
        if (Play.maybeApplication.isEmpty || throwable.isInstanceOf[Globals.NoStateError]) {
          if (Globals.wasTest) {
            logger.debug("Server gone, tests done? Cancelling script engine creation. [EsM6MK4]")
          }
          else {
            logger.error("Error creating Javascript engine: No server [EsE6JY22]", throwable)
          }
        }
        else if (isVeryFirstEngine) {
          logger.error("Error creating the very first Javascript engine: [DwE6KG25Z]", throwable)
          firstCreateEngineError = Some(throwable)
          javascriptEngines.putLast(BrokenEngine)
          die("DwE5KEF50", "Broken server side Javascript, this won't work")
        }
        else {
          // Deadlock risk because a thread that needs an engine blocks until one is available.
          // Use error code DwEDEADLOCK which DeadlockDetector also does.
          logger.error(o"""Error creating additional Javascript engine, ignoring it,
              DEADLOCK RISK: [DwEDEADLOCKR0]""", throwable)
        }
        return
    }
    javascriptEngines.putLast(engine)
  }


  def renderPage(initialStateJson: String): Option[String] = {
    if (Globals.isTestDisableScripts)
      return Some("Scripts disabled [EsM6YKW2]")
    withJavascriptEngine(engine => {
      val timeBefore = (new ju.Date).getTime

      engine.invokeFunction("setInitialStateJson", initialStateJson)
      val pageHtml = engine.invokeFunction("renderReactServerSide").asInstanceOf[String]
      if (pageHtml == ErrorRenderingReact) {
        logger.error(s"Error rendering page with React server side [DwE5KGW2]")
        return None
      }

      def timeElapsed = (new ju.Date).getTime - timeBefore
      def threadId = java.lang.Thread.currentThread.getId
      def threadName = java.lang.Thread.currentThread.getName
      logger.trace(s"Done rendering: $timeElapsed ms, thread $threadName  (id $threadId)")

      Some(pageHtml)
    })
  }


  override def renderAndSanitizeCommonMark(commonMarkSource: String,
        allowClassIdDataAttrs: Boolean, followLinks: Boolean): String = {
    if (Globals.isTestDisableScripts)
      return "Scripts disabled [EsM5GY52]"
    val oneboxRenderer = new InstantOneboxRendererForNashorn
    val resultNoOneboxes = withJavascriptEngine(engine => {
      // The onebox renderer needs a Javascript engine to sanitize html (via Caja JsHtmlSanitizer)
      // and we'll reuse `engine` so we won't have to create any additional engine.
      oneboxRenderer.javascriptEngine = Some(engine)
      val safeHtml = engine.invokeFunction("renderAndSanitizeCommonMark", commonMarkSource,
          // SECURITY SHOULD use another sanitizer and whitelist/blacklist classes, and IDs? [7FPKE02]
          true.asInstanceOf[Object], // allowClassIdDataAttrs.asInstanceOf[Object],
          followLinks.asInstanceOf[Object],
          oneboxRenderer, Globals.config.cdn.uploadsUrlPrefix getOrElse "")
      oneboxRenderer.javascriptEngine = None
      safeHtml.asInstanceOf[String]
    })
    // Before commenting in: Make all render functions async so we won't block when downloading.
    //oneboxRenderer.waitForDownloadsToFinish()
    val resultWithOneboxes = oneboxRenderer.replacePlaceholders(resultNoOneboxes)
    resultWithOneboxes
  }


  override def sanitizeHtml(text: String): String = {
    sanitizeHtmlReuseEngine(text, None)
  }


  def sanitizeHtmlReuseEngine(text: String, javascriptEngine: Option[js.Invocable]): String = {
    if (Globals.isTestDisableScripts)
      return "Scripts disabled [EsM44GY0]"
    def sanitizeWith(engine: js.Invocable): String = {
      val safeHtml = engine.invokeFunction("sanitizeHtmlServerSide", text)
      safeHtml.asInstanceOf[String]
    }
    javascriptEngine match {
      case Some(engine) =>
        sanitizeWith(engine)
      case None =>
        withJavascriptEngine(engine => {
          sanitizeWith(engine)
        })
    }
  }


  override def slugifyTitle(title: String): String = {
    if (Globals.isTestDisableScripts)
      return "scripts-disabled-EsM28WXP45"
    withJavascriptEngine(engine => {
      val slug = engine.invokeFunction("debikiSlugify", title)
      slug.asInstanceOf[String]
    })
  }


  def calcPasswordStrength(password: String, username: String, fullName: Option[String],
        email: String)
        : PasswordStrength = {
    if (!passwordStrengthCheckEnabled) {
      return PasswordStrength(entropyBits = 0, crackTimeSeconds = 0,
        crackTimeDisplay = "unknown", score = (password.length >= 8) ? 999 | 0)
    }

    withJavascriptEngine(engine => {
      val resultAsAny = engine.invokeFunction(
        "checkPasswordStrength", password, username, fullName.getOrElse(""), email)
      val resultString = resultAsAny.asInstanceOf[String]
      val parts = resultString.split('|')
      dieIf(parts.length != 4, "DwE4KEJ72")
      val result = PasswordStrength(
        entropyBits = Try { parts(0).toFloat } getOrElse die("DwE4KEP78"),
        crackTimeSeconds = Try { parts(1).toFloat } getOrElse die("DwE5KEP2"),
        crackTimeDisplay = parts(2),
        score = Try { parts(3).toInt } getOrElse die("DwE6KEF28"))
      result
    })
  }


  private def withJavascriptEngine[R](fn: (js.Invocable) => R): R = {
    dieIf(Globals.isTestDisableScripts, "EsE4YUGw")

    def threadId = Thread.currentThread.getId
    def threadName = Thread.currentThread.getName

    val mightBlock = javascriptEngines.isEmpty
    if (mightBlock) {
      logger.debug(s"Thread $threadName (id $threadId), waits for JS engine...")
      // Create one more engine, so we won't block forever below, if some weird? reason we
      // need more engines than cores.
      Future {
        createOneMoreJavascriptEngine()
      }
    }

    val engine = javascriptEngines.takeFirst()

    if (mightBlock) {
      logger.debug(s"...Thread $threadName (id $threadId) got a JS engine.")
      if (engine eq BrokenEngine) {
        logger.debug(s"...But it is broken; I'll throw an error. [DwE4KEWV52]")
      }
    }

    if (engine eq BrokenEngine) {
      javascriptEngines.addFirst(engine)
      die("DwE5KGF8", "Could not create Javascript engine; cannot render page",
        firstCreateEngineError getOrDie "DwE4KEW20")
    }

    try fn(engine.asInstanceOf[js.Invocable])
    finally {
      javascriptEngines.addFirst(engine)
    }
  }


  private def makeJavascriptEngine(): js.ScriptEngine = {
    val timeBefore = (new ju.Date).getTime
    def threadId = java.lang.Thread.currentThread.getId
    def threadName = java.lang.Thread.currentThread.getName
    logger.debug(s"Initializing Nashorn engine, thread id: $threadId, name: $threadName...")

    // Pass 'null' so that a class loader that finds the Nashorn extension will be used.
    // Otherwise the Nashorn engine won't be found and `newEngine` will be null.
    // See: https://github.com/playframework/playframework/issues/2532
    val newEngine = new js.ScriptEngineManager(null).getEngineByName("nashorn")
    val scriptBuilder = new StringBuilder

    // React expects `window` or `global` to exist, and my React code sometimes
    // load React components from `window['component-name']`.
    scriptBuilder.append("var global = window = this;")

    scriptBuilder.append(i"""
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
        |    return debiki2.renderTitleBodyCommentsToString();
        |  }
        |  catch (e) {
        |    printStackTrace(e);
        |  }
        |  return '$ErrorRenderingReact';
        |}
        |""")

    val min = if (Play.isDev) "" else ".min"

    var javascriptStream: jio.InputStream = null
    try {
      val path = s"/public/res/server-bundle$min.js"
      javascriptStream = getClass.getResourceAsStream(path)
      if (javascriptStream eq null) {
        val message = s"Script not found: $path, 'gulp build' has not been run or isn't done?"
        logger.error(message + " [EsE7JKV2]")
        throw new DebikiException("EsE7JKV3", message)
      }
      val rendererScript = scala.io.Source.fromInputStream(
        javascriptStream)(scala.io.Codec.UTF8).mkString
      scriptBuilder.append(rendererScript)
    }
    finally {
      IOUtils.closeWhileHandlingException(javascriptStream)
    }

    if (passwordStrengthCheckEnabled) {
      try {
        javascriptStream = getClass.getResourceAsStream("/public/res/zxcvbn.min.js")
        val zxcvbnScript = scala.io.Source.fromInputStream(javascriptStream).mkString
        scriptBuilder.append(zxcvbnScript)
      }
      finally {
        IOUtils.closeWhileHandlingException(javascriptStream)
      }
    }

    scriptBuilder.append(i"""
        |$RenderAndSanitizeCommonMark
        |$CheckPasswordStrength
        |""")

    // Output the script so we can lookup line numbers if there's an error.
    val script = scriptBuilder.toString()
    if (!Play.isProd) {
      val where = "target/nashorn-ok-delete.js"
      logger.debug(o"""... Here's the server side Javascript: $where""")
      new jio.PrintWriter(where) {
        write(script)
        close()
      }
    }

    newEngine.eval(script)

    def timeElapsed = (new ju.Date).getTime - timeBefore
    logger.debug(o"""... Done initializing Nashorn engine, took: $timeElapsed ms,
         thread id: $threadId, name: $threadName""")

    newEngine
  }


  private val ErrorRenderingReact = "__error_rendering_react_5KGF25X8__"


  private val RenderAndSanitizeCommonMark = i"""
    |var md;
    |try {
    |  md = markdownit({ html: true, linkify: true, breaks: true });
    |  md.use(debiki.internal.MentionsMarkdownItPlugin());
    |  md.use(debiki.internal.oneboxMarkdownItPlugin);
    |  ed.editor.CdnLinkifyer.replaceLinks(md);
    |}
    |catch (e) {
    |  printStackTrace(e);
    |  console.error("Error creating CommonMark renderer [DwE5kFEM9]");
    |}
    |
    |function renderAndSanitizeCommonMark(source, allowClassIdDataAttrs, followLinks,
    |       instantOneboxRenderer, uploadsUrlPrefix) {
    |  try {
    |    debiki.uploadsUrlPrefix = uploadsUrlPrefix;
    |    debiki.internal.oneboxMarkdownItPlugin.instantRenderer = instantOneboxRenderer;
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
    |// (Don't name this function 'sanitizeHtml' because it'd then get overwritten by
    |// a function with that same name from a certain sanitize-html npm module.)
    |function sanitizeHtmlServerSide(source) {
    |  try {
    |    source = source.replace(/<a /, "<a rel='nofollow' ")
    |    // This function calls both Google Caja and the sanitize-html npm module. RENAME.
    |    return googleCajaSanitizeHtml(source, false, false);
    |  }
    |  catch (e) {
    |    printStackTrace(e);
    |  }
    |  return "Error sanitizing HTML on server [DwE5GBCU6]";
    |}
    |"""


  private val CheckPasswordStrength = i"""
    |function checkPasswordStrength(password, username, userFullName, email) {
    |  var passwordStrength = zxcvbn(password, [
    |      userFullName, email, username, 'debiki', 'effectivediscussions']);
    |  return '' +
    |      passwordStrength.entropy + '|' +
    |      passwordStrength.crack_time + '|' +
    |      passwordStrength.crack_time_display + '|' +
    |      passwordStrength.score;
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
    |// If line and column numbers aren't defined, the exception might be a Nashorn bug.
    |// For example, if the exception.toString is: 'java.lang.ArrayIndexOutOfBoundsException: 10'.
    |function printStackTrace(exception) {
    |  console.error('File: nashorn-ok-delete.js');
    |  console.error('Line: ' + exception.lineNumber);
    |  console.error('Column: ' + exception.columnNumber);
    |  console.error('Stack trace: ' + exception.stack);
    |  console.error('Exception as is: ' + exception);
    |  console.error('Exception as JSON: ' + JSON.stringify(exception));
    |}
    |"""


  private def ServerSideDebikiModule = i"""
    |var debiki = {
    |  store: {},
    |  v0: { util: {} },
    |  internal: {},
    |  secure: ${Globals.secure}
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
    |  },
    |  getPageTitle: function() { // dupl code [5GYK2]
    |    var titlePost = initialStateJson.postsByNr[TitleNr];
    |    return titlePost ? titlePost.sanitizedHtml : "(no title)";
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
