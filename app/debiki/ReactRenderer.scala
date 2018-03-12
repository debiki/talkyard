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
import java.{io => jio}
import javax.{script => js}
import debiki.onebox.{InstantOneboxRendererForNashorn, Onebox}
import org.apache.lucene.util.IOUtils
import play.api.Play
import scala.concurrent.Future
import scala.util.Try
import ReactRenderer._


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
// RENAME to Nashorn? Because does lots of things, doesn't just render React stuff.
class ReactRenderer(globals: Globals) extends com.debiki.core.CommonMarkRenderer {

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

  @volatile private var firstCreateEngineError: Option[Throwable] = None

  private var secure = true
  private var cdnUploadsUrlPrefix = ""
  private var isTestSoDisableScripts = false

  private var oneboxes: Option[Onebox] = None

  def setOneboxes(oneboxes: Onebox): Unit = {
    dieIf(this.oneboxes.isDefined, "EdE2KQTG0")
    this.oneboxes = Some(oneboxes)
  }


  CLEAN_UP // remove server side pwd strength check.
  // Evaluating zxcvbn.min.js (a Javascript password strength check library) takes almost
  // a minute in dev mode. So enable server side password strength checks in prod mode only.
  // COULD run auto test suite on prod build too so server side pwd strength checks gets tested.
  private val passwordStrengthCheckEnabled = false // Globals.isProd — no, disable for now, toooooo slow

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
  def startCreatingRenderEngines(secure: Boolean, cdnUploadsUrlPrefix: Option[String],
        isTestSoDisableScripts: Boolean) {
    this.secure = secure
    this.cdnUploadsUrlPrefix = cdnUploadsUrlPrefix getOrElse ""
    this.isTestSoDisableScripts = isTestSoDisableScripts
    if (isTestSoDisableScripts)
      return
    if (!javascriptEngines.isEmpty) {
      dieIf(Globals.isProd, "DwE50KFE2")
      // We've restarted the server as part of some tests? but this object lingers? Fine.
      return
    }

    // Don't start the server without being able to render at least some Javascript instantly
    // with a ready-made & warmed-up engine. Otherwise the server might seem extremely slow.
    // In Dev and Test, doesn't matter though, and better wait, because the engines are sometimes
    // not needed at all (e.g. in some test cases).
    val numCreateDirectly = if (Globals.isProd) MinNumEngines else 0
    if (numCreateDirectly > 0) {
      val startMs = System.currentTimeMillis()
      logger.info(s"Creating $numCreateDirectly Javascript engines directly... [EdMJSENGDIRCT]")
      for (i <- 1 to numCreateDirectly) {
        createOneMoreJavascriptEngine(isVeryFirstEngine = i == 1)
      }
      val durationMs = System.currentTimeMillis() - startMs
      logger.info(o"""... Done creating $numCreateDirectly Javascript engines directly,
          took $durationMs ms [EdMJSENGDIRCTDONE]""")
    }

    Future {
      val numEngines = - numCreateDirectly + (
        if (Globals.isProd) math.max(MinNumEngines, Runtime.getRuntime.availableProcessors)
        else MinNumEngines)
      val startMs = System.currentTimeMillis()
      logger.info(s"Creating $numEngines Javascript engines, async... [EdMJSENGSTART]")
      for (i <- 1 to numEngines) {
        createOneMoreJavascriptEngine(isVeryFirstEngine = numCreateDirectly == 0 && i == 1)
      }
      val durationMs = System.currentTimeMillis() - startMs
      logger.info(o"""... Done creating $numEngines Javascript engines, async,
          took $durationMs ms [EdMJSENGDONE]""")
    }(globals.executionContext)
  }


  def numEnginesCreated: RoleId = javascriptEngines.size()


  private def createOneMoreJavascriptEngine(isVeryFirstEngine: Boolean = false) {
    val engine = try {
      val engine = makeJavascriptEngine()
      warmupJavascriptEngine(engine)
      engine
    }
    catch {
      case throwable: Throwable =>
        if (Play.maybeApplication.isEmpty || throwable.isInstanceOf[Globals.NoStateError]) {
          if (!Globals.isProd) {
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
    if (isTestSoDisableScripts)
      return Some("Scripts disabled [EsM6YKW2]")
    withJavascriptEngine(engine => {
      renderPageImpl(engine, initialStateJson)
    })
  }


  private def renderPageImpl[R](engine: js.Invocable, initialStateJson: String): Option[String] = {
    val timeBefore = System.currentTimeMillis()

    engine.invokeFunction("setInitialStateJson", initialStateJson)
    val pageHtml = engine.invokeFunction("renderReactServerSide").asInstanceOf[String]
    if (pageHtml == ErrorRenderingReact) {
      logger.error(s"Error rendering page with React server side [DwE5KGW2]")
      return None
    }

    def timeElapsed = System.currentTimeMillis() - timeBefore
    def threadId = java.lang.Thread.currentThread.getId
    def threadName = java.lang.Thread.currentThread.getName
    logger.trace(s"Done rendering: $timeElapsed ms, thread $threadName  (id $threadId)")

    Some(pageHtml)
  }


  override def renderAndSanitizeCommonMark(commonMarkSource: String,
        allowClassIdDataAttrs: Boolean, followLinks: Boolean): String = {
    if (isTestSoDisableScripts)
      return "Scripts disabled [EsM5GY52]"
    val oneboxRenderer = new InstantOneboxRendererForNashorn(oneboxes getOrDie "EdE2WUHP6")
    val resultNoOneboxes = withJavascriptEngine(engine => {
      // The onebox renderer needs a Javascript engine to sanitize html (via Caja JsHtmlSanitizer)
      // and we'll reuse `engine` so we won't have to create any additional engine.
      oneboxRenderer.javascriptEngine = Some(engine)
      val safeHtml = engine.invokeFunction("renderAndSanitizeCommonMark", commonMarkSource,
          true.asInstanceOf[Object], // allowClassIdDataAttrs.asInstanceOf[Object],
          followLinks.asInstanceOf[Object],
          oneboxRenderer, cdnUploadsUrlPrefix)
      oneboxRenderer.javascriptEngine = None
      safeHtml.asInstanceOf[String]
    })
    // Before commenting in: Make all render functions async so we won't block when downloading.
    //oneboxRenderer.waitForDownloadsToFinish()
    val resultWithOneboxes = oneboxRenderer.replacePlaceholders(resultNoOneboxes)
    resultWithOneboxes
  }


  override def sanitizeHtml(text: String, followLinks: Boolean): String = {
    sanitizeHtmlReuseEngine(text, followLinks, None)
  }


  def sanitizeHtmlReuseEngine(text: String, followLinks: Boolean,
        javascriptEngine: Option[js.Invocable]): String = {
    if (isTestSoDisableScripts)
      return "Scripts disabled [EsM44GY0]"
    def sanitizeWith(engine: js.Invocable): String = {
      val safeHtml = engine.invokeFunction(
          "sanitizeHtmlServerSide", text, followLinks.asInstanceOf[Object])
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
    if (isTestSoDisableScripts)
      return "scripts-disabled-EsM28WXP45"
    withJavascriptEngine(engine => {
      val slug = engine.invokeFunction("debikiSlugify", title)
      slug.asInstanceOf[String]
    })
  }


  CLEAN_UP /* delete all server side pwd strength stuff?
  def calcPasswordStrength(password: String, username: String, fullName: Option[String],
        email: String)
        : PasswordStrength = {
    if (!passwordStrengthCheckEnabled) {
      return PasswordStrength(entropyBits = 0, crackTimeSeconds = 0,
        crackTimeDisplay = "unknown", score = (password.length >= 8) ? 999 | 0)
    }

    CLEAN_UP // remove this server-side JS check of pwd strength — too complicated. Do sth
    // simple in Scala code instead, in app/ed/server/security.scala.
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
  } */


  private def withJavascriptEngine[R](fn: (js.Invocable) => R): R = {
    dieIf(isTestSoDisableScripts, "EsE4YUGw")

    def threadId = Thread.currentThread.getId
    def threadName = Thread.currentThread.getName

    val mightBlock = javascriptEngines.isEmpty
    if (mightBlock) {
      // Important message since, if there are bugs, this might deadlock.
      logger.info(s"Thread $threadName, id $threadId, waits for Javascript engine... [EdMWAITJSENG]")
      // Create one more engine, so we won't block forever below, if some weird? reason we
      // need more engines than cores.
      // No, don't. The most likely reason for this, is that the server was recently started,
      // and then creating engines takes lots of resources. Don't want to make that phase even
      // more-CPU & longer, by creating unneeded engines. Instead, if too many engines are
      // needed — then that's a bug, try to fix it instead.
      // Don't: Future { createOneMoreJavascriptEngine() }
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
    val timeBefore = System.currentTimeMillis()
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
        |${serverSideDebikiModule(secure)}
        |$ServerSideReactStore
        |
        |// React-Router calls setTimeout(), but it's not available in Nashorn.
        |function setTimeout(callback) {
        |  callback();
        |}
        |
        |function renderReactServerSide() {
        |  try {
        |    // Each language file creates a 't_(lang-code)' global variable, e.g. 't_en' for English.
        |    // And they all set a global 'var t' to themselves. Update 't' here; it gets used
        |    // during rendering.
        |    var langCode = initialState.settings.languageCode || '${AllSettings.Default.languageCode}';
        |    t = global['t_' + langCode];
        |    return debiki2.renderTitleBodyCommentsToString();
        |  }
        |  catch (e) {
        |    printStackTrace(e);
        |  }
        |  return '$ErrorRenderingReact';
        |}
        |""")

    // Use .min when testing, because when running tests for a prod build, the non-.min files
    // have been deleted already (to make the Docker image smaller).
    val min = globals.isDev ? "" | ".min"

    var javascriptStream: jio.InputStream = null
    try {
      // Add translations, required by the render-page-code later when it runs.
      def addTranslation(langCode: String) {
        val translScript = loadFileAsString(
          s"/public/res/translations/$langCode/i18n$min.js", isTranslation = true)
        scriptBuilder.append(translScript)
      }

      // Sync with the languages in the /translations/ dir, and the admin UI language selector. [5JUKQR2]
      addTranslation("en")
      addTranslation("sv")

      // Add render page code.
      val rendererScript = loadFileAsString(s"/public/res/server-bundle$min.js", isTranslation = false)
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
    if (!Globals.isProd) {
      val where = "target/nashorn-ok-delete.js"
      logger.debug(o"""... Here's the server side Javascript: $where""")
      new jio.PrintWriter(where) {
        write(script)
        close()
      }
    }

    newEngine.eval(script)

    def timeElapsed = System.currentTimeMillis() - timeBefore
    logger.debug(o"""... Done initializing Nashorn engine, took: $timeElapsed ms,
         thread id: $threadId, name: $threadName""")

    newEngine
  }


  private def loadFileAsString(path: String, isTranslation: Boolean): String = {
    val javascriptStream = getClass.getResourceAsStream(path)
    if (javascriptStream eq null) {
      if (isTranslation) {
        val message = s"Language file not found: $path, 'gulp buildTranslations' not run or isn't done?"
        logger.error(message + " [TyE47UKDW2]")
        throw new DebikiException("TyE47UKDW3", message)
      }
      else {
        val message = s"Script not found: $path, 'gulp build' has not been run or isn't done?"
        logger.error(message + " [TyE7JKV2]")
        throw new DebikiException("TyE7JKV3", message)
      }
    }
    scala.io.Source.fromInputStream(
      javascriptStream)(scala.io.Codec.UTF8).mkString
  }


  private def warmupJavascriptEngine(engine: js.ScriptEngine) {
    logger.debug(o"""Warming up Nashorn engine...""")
    val timeBefore = System.currentTimeMillis()
    // Warming up with three laps seems enough, almost all time is spent in at lap 1.
    for (i <- 1 to 3) {
      val timeBefore = System.currentTimeMillis()
      renderPageImpl(engine.asInstanceOf[js.Invocable], WarmUpReactStoreJsonString)
      def timeElapsed = System.currentTimeMillis() - timeBefore
      logger.info(o"""Warming up Nashorn engine, lap $i done, took: $timeElapsed ms""")
    }
    def timeElapsed = System.currentTimeMillis() - timeBefore
    logger.info(o"""Done warming up Nashorn engine, took: $timeElapsed ms""")
  }

}



object ReactRenderer {

  /** Initializing engines takes rather long, so create only two in dev mode:
    * one for the RenderContentService background actor, and one for
    * http request handler threads that need to render content directly.
    */
  val MinNumEngines = 2

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
    |    return googleCajaSanitizeHtml(unsafeHtml, allowClassAndIdAttr, allowDataAttr, followLinks);
    |  }
    |  catch (e) {
    |    printStackTrace(e);
    |  }
    |  return "Error rendering CommonMark on server [DwE4XMYD8]";
    |}
    |
    |// (Don't name this function 'sanitizeHtml' because it'd then get overwritten by
    |// a function with that same name from a certain sanitize-html npm module.)
    |function sanitizeHtmlServerSide(source, followLinks) {
    |  try {
    |    // This function calls both Google Caja and the sanitize-html npm module. CLEAN_UP RENAME.
    |    return googleCajaSanitizeHtml(source, false, false, followLinks);
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
    |      userFullName, email, username, 'debiki', 'talkyard']);
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


  // CLEAN_UP remove debiki.v0 & .internal [4KSWPY]
  // Needs serverOrigin and isInEmbeddedCommentsIframe, so can generate working links  [7UKWBP4]
  // also for embedded comments pages.
  private def serverSideDebikiModule(secure: Boolean) = i"""
    |var eds = {
    |  secure: $secure
    |};
    |var debiki = {
    |  v0: { util: {} },
    |  internal: {},
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
    |    return initialState;
    |  },
    |  getUser: function() {
    |    return initialState.me;
    |  },
    |  getPageTitle: function() { // dupl code [5GYK2]
    |    var titlePost = initialState.currentPage.postsByNr[TitleNr];
    |    return titlePost ? titlePost.sanitizedHtml : "(no title)";
    |  }
    |};
    |
    |var initialState = {};
    |
    |function setInitialStateJson(jsonString) {
    |  var s = JSON.parse(jsonString);
    |  s.currentPage = s.pagesById[s.currentPageId];
    |  // Fill in no-page-data to avoid null errors. Dupl code. [4FBR20]
    |  s.me.myCurrentPageData = {
    |    rolePageSettings: { notfLevel: NotfLevel.Normal },
    |    votes: {},
    |    unapprovedPosts: {},
    |    unapprovedPostAuthors: [],
    |    postNrsAutoReadLongAgo: [],
    |    postNrsAutoReadNow: [],
    |    marksByPostId: {},
    |  };
    |  initialState = s;
    |}
    |"""


  /** The page-type-question e2e test, run it like so:
    * s/wdio target/e2e/wdio.2chrome.conf.js --only page-type-question-closed.2browsers --da
    * and then open the source, and copy the json inside the #thePageJson script elem.
    */
  private val WarmUpReactStoreJsonString = """{"dbgSrc":"PTJ","appVersion":"0.00.44","siteId":-13,"siteStatus":2,"userMustBeAuthenticated":false,"userMustBeApproved":false,"settings":{},"maxUploadSizeBytes":1326974192,"isInEmbeddedCommentsIframe":false,"categories":[{"id":2,"name":"Uncategorized","slug":"uncategorized","defaultTopicType":12,"newTopicTypes":[],"unlisted":false,"includeInSummaries":0,"position":50,"description":"The default category.","isDefaultCategory":true}],"topics":null,"me":{"dbgSrc":"2FBS6Z8","notifications":[],"watchbar":{"1":[],"2":[],"3":[],"4":[]},"myDataByPageId":{},"marksByPostId":{},"closedHelpMessages":{},"permsOnPages":[{"id":1,"forPeopleId":10,"onCategoryId":2,"mayEditOwn":true,"mayCreatePage":true,"mayPostComment":true,"maySee":true,"maySeeOwn":true}]},"rootPostId":1,"usersByIdBrief":{"101":{"id":101,"username":"maria","fullName":"Maria","isAuthenticated":true},"102":{"id":102,"username":"michael","fullName":"Michael","isAuthenticated":true},"104":{"id":104,"username":"owen_owner","fullName":"Owen Owner","isAuthenticated":true,"isAdmin":true}},"siteSections":[{"pageId":"fmp","path":"/","pageRole":7,"name":"(?? [EsU2UWY0]"}],"socialLinksHtml":"","currentPageId":"1","pagesById":{"1":{"pageId":"1","pageVersion":14,"pageMemberIds":[],"forumId":"fmp","ancestorsRootFirst":[{"categoryId":1,"title":"Home","path":"/latest","unlisted":false},{"categoryId":2,"title":"Uncategorized","path":"/latest/uncategorized","unlisted":false}],"categoryId":2,"pageRole":10,"pagePath":{"value":"/-1/which-pet","folder":"/","showId":true,"slug":"which-pet"},"pageLayout":0,"pageHtmlTagCssClasses":"","pageHtmlHeadTitle":"","pageHtmlHeadDescription":"","pinOrder":null,"pinWhere":null,"pageAnsweredAtMs":"2017-12-17 08:49Z","pageAnswerPostUniqueId":106,"pageAnswerPostNr":3,"pagePlannedAtMs":null,"pageStartedAtMs":null,"pageDoneAtMs":null,"pageClosedAtMs":"2017-12-17 08:49Z","pageLockedAtMs":null,"pageFrozenAtMs":null,"pageHiddenAtMs":null,"pageDeletedAtMs":null,"numPosts":8,"numPostsRepliesSection":6,"numPostsChatSection":0,"numPostsExclTitle":7,"postsByNr":{"0":{"uniqueId":103,"nr":0,"parentNr":null,"multireplyPostNrs":[],"postType":null,"authorId":101,"createdAtMs":1513500521427,"lastApprovedEditAtMs":null,"numEditors":1,"numLikeVotes":0,"numWrongVotes":0,"numBuryVotes":0,"numUnwantedVotes":0,"numPendingEditSuggestions":0,"summarize":false,"summary":null,"squash":false,"isTreeDeleted":false,"isPostDeleted":false,"isTreeCollapsed":false,"isPostCollapsed":false,"isTreeClosed":false,"isApproved":true,"pinnedPosition":null,"branchSideways":null,"likeScore":0.18,"childIdsSorted":[],"sanitizedHtml":"Which pet?","tags":[],"unsafeSource":"Which pet?"},"1":{"uniqueId":104,"nr":1,"parentNr":null,"multireplyPostNrs":[],"postType":null,"authorId":101,"createdAtMs":1513500521427,"lastApprovedEditAtMs":null,"numEditors":1,"numLikeVotes":0,"numWrongVotes":0,"numBuryVotes":0,"numUnwantedVotes":0,"numPendingEditSuggestions":0,"summarize":false,"summary":null,"squash":false,"isTreeDeleted":false,"isPostDeleted":false,"isTreeCollapsed":false,"isPostCollapsed":false,"isTreeClosed":false,"isApproved":true,"pinnedPosition":null,"branchSideways":null,"likeScore":0.18,"childIdsSorted":[2,3,4,6,7],"sanitizedHtml":"&lt;p&gt;Should I get a cat or an otter?&lt;/p&gt;\n","tags":[]},"2":{"uniqueId":105,"nr":2,"parentNr":1,"multireplyPostNrs":[],"postType":null,"authorId":102,"createdAtMs":1513500527872,"lastApprovedEditAtMs":null,"numEditors":1,"numLikeVotes":0,"numWrongVotes":0,"numBuryVotes":0,"numUnwantedVotes":0,"numPendingEditSuggestions":0,"summarize":false,"summary":null,"squash":false,"isTreeDeleted":false,"isPostDeleted":false,"isTreeCollapsed":false,"isPostCollapsed":false,"isTreeClosed":false,"isApproved":true,"pinnedPosition":null,"branchSideways":null,"likeScore":0.18,"childIdsSorted":[],"sanitizedHtml":"&lt;p&gt;Yes, a cat&lt;/p&gt;\n","tags":[]},"3":{"uniqueId":106,"nr":3,"parentNr":1,"multireplyPostNrs":[],"postType":null,"authorId":102,"createdAtMs":1513500528600,"lastApprovedEditAtMs":null,"numEditors":1,"numLikeVotes":0,"numWrongVotes":0,"numBuryVotes":0,"numUnwantedVotes":0,"numPendingEditSuggestions":0,"summarize":false,"summary":null,"squash":false,"isTreeDeleted":false,"isPostDeleted":false,"isTreeCollapsed":false,"isPostCollapsed":false,"isTreeClosed":false,"isApproved":true,"pinnedPosition":null,"branchSideways":null,"likeScore":0.18,"childIdsSorted":[5],"sanitizedHtml":"&lt;p&gt;Yes, an otter&lt;/p&gt;\n","tags":[]},"4":{"uniqueId":107,"nr":4,"parentNr":1,"multireplyPostNrs":[],"postType":31,"authorId":104,"createdAtMs":1513500537744,"lastApprovedEditAtMs":null,"numEditors":1,"numLikeVotes":0,"numWrongVotes":0,"numBuryVotes":0,"numUnwantedVotes":0,"numPendingEditSuggestions":0,"summarize":false,"summary":null,"squash":false,"isTreeDeleted":false,"isPostDeleted":false,"isTreeCollapsed":false,"isPostCollapsed":false,"isTreeClosed":false,"isApproved":true,"pinnedPosition":null,"branchSideways":null,"likeScore":0.18,"childIdsSorted":[],"sanitizedHtml":" closed this topic","tags":[]},"5":{"uniqueId":108,"nr":5,"parentNr":3,"multireplyPostNrs":[],"postType":null,"authorId":101,"createdAtMs":1513500539619,"lastApprovedEditAtMs":null,"numEditors":1,"numLikeVotes":0,"numWrongVotes":0,"numBuryVotes":0,"numUnwantedVotes":0,"numPendingEditSuggestions":0,"summarize":false,"summary":null,"squash":false,"isTreeDeleted":false,"isPostDeleted":false,"isTreeCollapsed":false,"isPostCollapsed":false,"isTreeClosed":false,"isApproved":true,"pinnedPosition":null,"branchSideways":null,"likeScore":0.18,"childIdsSorted":[],"sanitizedHtml":"&lt;p&gt;Thanks! Such a good idea&lt;/p&gt;\n","tags":[]},"6":{"uniqueId":109,"nr":6,"parentNr":1,"multireplyPostNrs":[],"postType":4,"authorId":101,"createdAtMs":1513500541480,"lastApprovedEditAtMs":null,"numEditors":1,"numLikeVotes":0,"numWrongVotes":0,"numBuryVotes":0,"numUnwantedVotes":0,"numPendingEditSuggestions":0,"summarize":false,"summary":null,"squash":false,"isTreeDeleted":false,"isPostDeleted":false,"isTreeCollapsed":false,"isPostCollapsed":false,"isTreeClosed":false,"isApproved":true,"pinnedPosition":null,"branchSideways":null,"likeScore":0.18,"childIdsSorted":[],"sanitizedHtml":"&lt;p&gt;Thanks everyone! An otter then, a bath tube, and fish.&lt;/p&gt;\n","tags":[]},"7":{"uniqueId":110,"nr":7,"parentNr":1,"multireplyPostNrs":[],"postType":31,"authorId":104,"createdAtMs":1513500542229,"lastApprovedEditAtMs":null,"numEditors":1,"numLikeVotes":0,"numWrongVotes":0,"numBuryVotes":0,"numUnwantedVotes":0,"numPendingEditSuggestions":0,"summarize":false,"summary":null,"squash":false,"isTreeDeleted":false,"isPostDeleted":false,"isTreeCollapsed":false,"isPostCollapsed":false,"isTreeClosed":false,"isApproved":true,"pinnedPosition":null,"branchSideways":null,"likeScore":0.18,"childIdsSorted":[],"sanitizedHtml":" reopened this topic","tags":[]}},"topLevelCommentIdsSorted":[],"horizontalLayout":false,"is2dTreeDefault":false}}}"""

}
