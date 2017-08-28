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


  /*
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
        |    return debiki2.renderTitleBodyCommentsToString();
        |  }
        |  catch (e) {
        |    printStackTrace(e);
        |  }
        |  return '$ErrorRenderingReact';
        |}
        |""")

    val min = ".min"  // change to "" if need to debug

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


  private def warmupJavascriptEngine(engine: js.ScriptEngine) {
    logger.debug(o"""Warming up Nashorn engine...""")
    val timeBefore = System.currentTimeMillis()
    // Warming up with three laps seems enough, let's do 3 + 1.
    for (i <- 1 to 4) {
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


  private def serverSideDebikiModule(secure: Boolean) = i"""
    |var debiki = {
    |  store: {},
    |  v0: { util: {} },
    |  internal: {},
    |  secure: $secure
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

  /** A test page I (KajMagnus) created long ago.
    */
  private val WarmUpReactStoreJsonString = """{"appVersion":"0.00.40","pageVersion":36,"siteId":3,"siteStatus":2,"userMustBeAuthenticated":false,"userMustBeApproved":false,"settings":{"allowGuestLogin":true,"requireVerifiedEmail":false,"showExperimental":true},"pageId":"30","pageMemberIds":[],"categoryId":8,"forumId":"4jqu3","ancestorsRootFirst":[{"categoryId":1,"title":"Home","path":"/forum/latest","unlisted":false},{"categoryId":8,"title":"Unlisted","path":"/forum/latest/unlisted","unlisted":true}],"pageRole":12,"pagePath":{"value":"/for/hacker-news","folder":"/for/","showId":false,"slug":"hacker-news"},"pageLayout":0,"pageHtmlTagCssClasses":"","pageHtmlHeadTitle":"","pageHtmlHeadDescription":"","pinOrder":null,"pinWhere":null,"pageAnsweredAtMs":null,"pageAnswerPostUniqueId":null,"pagePlannedAtMs":null,"pageDoneAtMs":null,"pageClosedAtMs":null,"pageLockedAtMs":null,"pageFrozenAtMs":null,"pageHiddenAtMs":null,"pageDeletedAtMs":null,"numPosts":16,"numPostsRepliesSection":14,"numPostsChatSection":0,"numPostsExclTitle":15,"maxUploadSizeBytes":100111222,"isInEmbeddedCommentsIframe":false,"categories":[{"id":7,"name":"Support","slug":"support","defaultTopicType":12,"newTopicTypes":[12],"unlisted":false,"position":1,"description":"Here you can ask about EffectiveDiscussions, and tell us if something seems broken.","isDefaultCategory":true},{"id":6,"name":"Ideas","slug":"ideas","defaultTopicType":15,"newTopicTypes":[15],"unlisted":false,"position":2,"description":"Suggest new features, or things to change, or remove."},{"id":5,"name":"Uncategorized","slug":"uncategorized","defaultTopicType":12,"newTopicTypes":[],"unlisted":false,"position":4,"description":"__uncategorized__"},{"id":4,"name":"Old Sandbox","slug":"sandbox","defaultTopicType":12,"newTopicTypes":[],"unlisted":false,"position":7,"description":"Sandbox moved. Go here instead:http://try.effectivediscussions.org/latest"}],"topics":[],"me":{"rolePageSettings":{},"notifications":[],"watchbar":{"1":[],"2":[],"3":[{"pageId":"31","url":"","title":"support-chat","private":false,"numMembers":0,"unread":false},{"pageId":"43","url":"","title":"welcome-chat","private":false,"numMembers":0,"unread":false}],"4":[]},"votes":{},"unapprovedPosts":{},"unapprovedPostAuthors":[],"postNrsAutoReadLongAgo":[],"postNrsAutoReadNow":[],"marksByPostId":{},"closedHelpMessages":{},"permsOnPages":[{"id":80,"forPeopleId":10,"onCategoryId":8,"mayEditOwn":true,"mayCreatePage":false,"mayPostComment":true,"maySee":true,"maySeeOwn":true},{"id":50,"forPeopleId":10,"onCategoryId":5,"mayEditOwn":true,"mayCreatePage":true,"mayPostComment":true,"maySee":true,"maySeeOwn":true},{"id":60,"forPeopleId":10,"onCategoryId":6,"mayEditOwn":true,"mayCreatePage":true,"mayPostComment":true,"maySee":true,"maySeeOwn":true},{"id":30,"forPeopleId":10,"onCategoryId":3,"mayEditOwn":true,"mayCreatePage":false,"mayPostComment":true,"maySee":true,"maySeeOwn":true},{"id":70,"forPeopleId":10,"onCategoryId":7,"mayEditOwn":true,"mayCreatePage":true,"mayPostComment":true,"maySee":true,"maySeeOwn":true},{"id":40,"forPeopleId":10,"onCategoryId":4,"mayEditOwn":true,"mayCreatePage":true,"mayPostComment":true,"maySee":true,"maySeeOwn":true}]},"rootPostId":1,"usersByIdBrief":{"226":{"id":226,"username":"KajMagnus","fullName":"KajMagnus","avatarUrl":"/-/uploads/public/v/c/boq4fjs46w7n7axf77qq42f4yz4b4vo.jpg","isAuthenticated":true,"isAdmin":true}},"postsByNr":{"0":{"uniqueId":915,"nr":0,"parentNr":null,"multireplyPostNrs":[],"postType":null,"authorId":226,"createdAtMs":1475310361760,"lastApprovedEditAtMs":null,"numEditors":1,"numLikeVotes":0,"numWrongVotes":0,"numBuryVotes":0,"numUnwantedVotes":0,"numPendingEditSuggestions":0,"summarize":false,"summary":null,"squash":false,"isTreeDeleted":false,"isPostDeleted":false,"isTreeCollapsed":false,"isPostCollapsed":false,"isTreeClosed":false,"isApproved":true,"pinnedPosition":null,"branchSideways":null,"likeScore":0.18,"childIdsSorted":[],"sanitizedHtml":"EffectiveDiscussions for Hacker News","tags":[]},"2":{"uniqueId":917,"nr":2,"parentNr":1,"multireplyPostNrs":[],"postType":null,"authorId":226,"createdAtMs":1475310970502,"lastApprovedEditAtMs":null,"numEditors":1,"numLikeVotes":0,"numWrongVotes":0,"numBuryVotes":0,"numUnwantedVotes":0,"numPendingEditSuggestions":0,"summarize":false,"summary":null,"squash":false,"isTreeDeleted":false,"isPostDeleted":false,"isTreeCollapsed":false,"isPostCollapsed":false,"isTreeClosed":false,"isApproved":true,"pinnedPosition":null,"branchSideways":null,"likeScore":0.18,"childIdsSorted":[3,4,7,10,15],"sanitizedHtml":"&lt;p&gt;The parent comment, far, far, oh so far away.&lt;/p&gt;\n","tags":[]},"3":{"uniqueId":918,"nr":3,"parentNr":2,"multireplyPostNrs":[],"postType":null,"authorId":226,"createdAtMs":1475310988678,"lastApprovedEditAtMs":null,"numEditors":1,"numLikeVotes":0,"numWrongVotes":0,"numBuryVotes":0,"numUnwantedVotes":0,"numPendingEditSuggestions":0,"summarize":false,"summary":null,"squash":false,"isTreeDeleted":false,"isPostDeleted":false,"isTreeCollapsed":false,"isPostCollapsed":false,"isTreeClosed":false,"isApproved":true,"pinnedPosition":null,"branchSideways":null,"likeScore":0.18,"childIdsSorted":[5,16],"sanitizedHtml":"&lt;p&gt;Text text text text text text text text text text text text text text. Text text text text text text text text text text text text text text. Text text text text text text text text text text text text text text. Text text text text text text text text text text text text text text. Text text text text text text text text text text text text text text.&lt;/p&gt;\n&lt;p&gt;Text text text text text text text text text text text text text text. Text text text text text text text text text text text text text text. Text text text text.&lt;/p&gt;\n","tags":[]},"4":{"uniqueId":919,"nr":4,"parentNr":2,"multireplyPostNrs":[],"postType":null,"authorId":226,"createdAtMs":1475311011659,"lastApprovedEditAtMs":null,"numEditors":1,"numLikeVotes":0,"numWrongVotes":0,"numBuryVotes":0,"numUnwantedVotes":0,"numPendingEditSuggestions":0,"summarize":false,"summary":null,"squash":false,"isTreeDeleted":false,"isPostDeleted":false,"isTreeCollapsed":false,"isPostCollapsed":false,"isTreeClosed":false,"isApproved":true,"pinnedPosition":null,"branchSideways":null,"likeScore":0.18,"childIdsSorted":[6,11],"sanitizedHtml":"&lt;p&gt;Text text text text text text text text text text text text text text. Text text text text text text text text text text text text text text. Text text text text text text text text text text text text text text.&lt;/p&gt;\n","tags":[]},"5":{"uniqueId":920,"nr":5,"parentNr":3,"multireplyPostNrs":[],"postType":null,"authorId":226,"createdAtMs":1475311041924,"lastApprovedEditAtMs":null,"numEditors":1,"numLikeVotes":0,"numWrongVotes":0,"numBuryVotes":0,"numUnwantedVotes":0,"numPendingEditSuggestions":0,"summarize":false,"summary":null,"squash":false,"isTreeDeleted":false,"isPostDeleted":false,"isTreeCollapsed":false,"isPostCollapsed":false,"isTreeClosed":false,"isApproved":true,"pinnedPosition":null,"branchSideways":null,"likeScore":0.18,"childIdsSorted":[],"sanitizedHtml":"&lt;p&gt;Text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text.&lt;/p&gt;\n&lt;p&gt;Text text text text text text text text text.&lt;/p&gt;\n&lt;p&gt;Text text text text text text text text text text text text text text. Text text text text text text text text text text text text text text. Text text text text text text text text text text text text text text.&lt;/p&gt;\n","tags":[]},"6":{"uniqueId":921,"nr":6,"parentNr":4,"multireplyPostNrs":[],"postType":null,"authorId":226,"createdAtMs":1475311102985,"lastApprovedEditAtMs":null,"numEditors":1,"numLikeVotes":0,"numWrongVotes":0,"numBuryVotes":0,"numUnwantedVotes":0,"numPendingEditSuggestions":0,"summarize":false,"summary":null,"squash":false,"isTreeDeleted":false,"isPostDeleted":false,"isTreeCollapsed":false,"isPostCollapsed":false,"isTreeClosed":false,"isApproved":true,"pinnedPosition":null,"branchSideways":null,"likeScore":0.18,"childIdsSorted":[12,13],"sanitizedHtml":"&lt;p&gt;Text text text text text text text text text text text text text text. Text text text text text text text text text text text text text text. Text text text text text text text text text text text text text text. Text text text text text text text text text text text text text text. Text text text text text text text text text text text text text text. Text text text text text text text text text text text text text text. Text text text text text text text text text text text text text text. Text text text text text text text text text text text text text text. Text text text text text text text text text text text text text text.&lt;/p&gt;\n","tags":[]},"7":{"uniqueId":922,"nr":7,"parentNr":2,"multireplyPostNrs":[],"postType":null,"authorId":226,"createdAtMs":1475311126060,"lastApprovedEditAtMs":null,"numEditors":1,"numLikeVotes":0,"numWrongVotes":0,"numBuryVotes":0,"numUnwantedVotes":0,"numPendingEditSuggestions":0,"summarize":false,"summary":null,"squash":false,"isTreeDeleted":false,"isPostDeleted":false,"isTreeCollapsed":false,"isPostCollapsed":false,"isTreeClosed":false,"isApproved":true,"pinnedPosition":null,"branchSideways":null,"likeScore":0.18,"childIdsSorted":[8,14],"sanitizedHtml":"&lt;p&gt;Text text text text text text text text text text text text text text. Text text text text text text text text text text text text text text. Text text text text text text text text text text text text text text.&lt;/p&gt;\n&lt;p&gt;Text? Text. Text text. Text!&lt;/p&gt;\n","tags":[]},"8":{"uniqueId":923,"nr":8,"parentNr":7,"multireplyPostNrs":[],"postType":null,"authorId":226,"createdAtMs":1475311173032,"lastApprovedEditAtMs":null,"numEditors":1,"numLikeVotes":0,"numWrongVotes":0,"numBuryVotes":0,"numUnwantedVotes":0,"numPendingEditSuggestions":0,"summarize":false,"summary":null,"squash":false,"isTreeDeleted":false,"isPostDeleted":false,"isTreeCollapsed":false,"isPostCollapsed":false,"isTreeClosed":false,"isApproved":true,"pinnedPosition":null,"branchSideways":null,"likeScore":0.18,"childIdsSorted":[9],"sanitizedHtml":"&lt;p&gt;Text, text. Tex. Tex? Text! Tex. Text! Text text text. Tex? Text! Text text text text. Text.&lt;/p&gt;\n","tags":[]},"10":{"uniqueId":925,"nr":10,"parentNr":2,"multireplyPostNrs":[],"postType":null,"authorId":226,"createdAtMs":1475311250464,"lastApprovedEditAtMs":null,"numEditors":1,"numLikeVotes":0,"numWrongVotes":0,"numBuryVotes":0,"numUnwantedVotes":0,"numPendingEditSuggestions":0,"summarize":false,"summary":null,"squash":false,"isTreeDeleted":false,"isPostDeleted":false,"isTreeCollapsed":false,"isPostCollapsed":false,"isTreeClosed":false,"isApproved":true,"pinnedPosition":null,"branchSideways":null,"likeScore":0.18,"childIdsSorted":[],"sanitizedHtml":"&lt;p&gt;So much text everywhere&lt;/p&gt;\n&lt;p&gt;Click the arrow to this comment, to jump to the parent. Then a &lt;strong&gt;Back&lt;/strong&gt; button appears at the bottom.&lt;/p&gt;\n","tags":[]},"9":{"uniqueId":924,"nr":9,"parentNr":8,"multireplyPostNrs":[],"postType":null,"authorId":226,"createdAtMs":1475311189400,"lastApprovedEditAtMs":null,"numEditors":1,"numLikeVotes":0,"numWrongVotes":0,"numBuryVotes":0,"numUnwantedVotes":0,"numPendingEditSuggestions":0,"summarize":false,"summary":null,"squash":false,"isTreeDeleted":false,"isPostDeleted":false,"isTreeCollapsed":false,"isPostCollapsed":false,"isTreeClosed":false,"isApproved":true,"pinnedPosition":null,"branchSideways":null,"likeScore":0.18,"childIdsSorted":[],"sanitizedHtml":"&lt;p&gt;Text.&lt;/p&gt;\n","tags":[]},"11":{"uniqueId":926,"nr":11,"parentNr":4,"multireplyPostNrs":[],"postType":null,"authorId":226,"createdAtMs":1475311321389,"lastApprovedEditAtMs":null,"numEditors":1,"numLikeVotes":0,"numWrongVotes":0,"numBuryVotes":0,"numUnwantedVotes":0,"numPendingEditSuggestions":0,"summarize":false,"summary":null,"squash":false,"isTreeDeleted":false,"isPostDeleted":false,"isTreeCollapsed":false,"isPostCollapsed":false,"isTreeClosed":false,"isApproved":true,"pinnedPosition":null,"branchSideways":null,"likeScore":0.18,"childIdsSorted":[],"sanitizedHtml":"&lt;p&gt;Text text text text text text text text text text text text text text. Text text text text text text text text text text text text text text. Text text text text text text text text text text text text text text. Text text text text text text text text text text text text text text. Text text text text text text text text text text text text text text. Text text text text text text text text text text text text text text.&lt;/p&gt;\n&lt;p&gt;Text text text text text text.&lt;/p&gt;\n&lt;p&gt;Text text text text text text text text text text, text, text, text text text text text text text text. Text text text text text text text text text.&lt;/p&gt;\n","tags":[]},"12":{"uniqueId":929,"nr":12,"parentNr":6,"multireplyPostNrs":[],"postType":null,"authorId":226,"createdAtMs":1475312050223,"lastApprovedEditAtMs":null,"numEditors":1,"numLikeVotes":0,"numWrongVotes":0,"numBuryVotes":0,"numUnwantedVotes":0,"numPendingEditSuggestions":0,"summarize":false,"summary":null,"squash":false,"isTreeDeleted":false,"isPostDeleted":false,"isTreeCollapsed":false,"isPostCollapsed":false,"isTreeClosed":false,"isApproved":true,"pinnedPosition":null,"branchSideways":null,"likeScore":0.18,"childIdsSorted":[],"sanitizedHtml":"&lt;p&gt;Text text text text text text text text text text text text text text. Text text text text text text text text text text text text text text text text text text text text text text text. Text.&lt;/p&gt;\n","tags":[]},"13":{"uniqueId":930,"nr":13,"parentNr":6,"multireplyPostNrs":[],"postType":null,"authorId":226,"createdAtMs":1475312054710,"lastApprovedEditAtMs":null,"numEditors":1,"numLikeVotes":0,"numWrongVotes":0,"numBuryVotes":0,"numUnwantedVotes":0,"numPendingEditSuggestions":0,"summarize":false,"summary":null,"squash":false,"isTreeDeleted":false,"isPostDeleted":false,"isTreeCollapsed":false,"isPostCollapsed":false,"isTreeClosed":false,"isApproved":true,"pinnedPosition":null,"branchSideways":null,"likeScore":0.18,"childIdsSorted":[],"sanitizedHtml":"&lt;p&gt;Text text text text text text text text text text text text text text. Text text text text text text text text text text text text text text. Text.&lt;/p&gt;\n","tags":[]},"14":{"uniqueId":931,"nr":14,"parentNr":7,"multireplyPostNrs":[],"postType":null,"authorId":226,"createdAtMs":1475312066241,"lastApprovedEditAtMs":null,"numEditors":1,"numLikeVotes":0,"numWrongVotes":0,"numBuryVotes":0,"numUnwantedVotes":0,"numPendingEditSuggestions":0,"summarize":false,"summary":null,"squash":false,"isTreeDeleted":false,"isPostDeleted":false,"isTreeCollapsed":false,"isPostCollapsed":false,"isTreeClosed":false,"isApproved":true,"pinnedPosition":null,"branchSideways":null,"likeScore":0.18,"childIdsSorted":[],"sanitizedHtml":"&lt;p&gt;Text text text text text text text text text text text text text text. Text text text text text text text text text text text text text text. Text. Text text text text text text text text text text text text text text. Text text text text text text text text text text text text text text. Text.&lt;/p&gt;\n","tags":[]},"16":{"uniqueId":933,"nr":16,"parentNr":3,"multireplyPostNrs":[],"postType":null,"authorId":226,"createdAtMs":1475312103009,"lastApprovedEditAtMs":null,"numEditors":1,"numLikeVotes":0,"numWrongVotes":0,"numBuryVotes":0,"numUnwantedVotes":0,"numPendingEditSuggestions":0,"summarize":false,"summary":null,"squash":false,"isTreeDeleted":false,"isPostDeleted":false,"isTreeCollapsed":false,"isPostCollapsed":false,"isTreeClosed":false,"isApproved":true,"pinnedPosition":null,"branchSideways":null,"likeScore":0.18,"childIdsSorted":[],"sanitizedHtml":"&lt;p&gt;Text text text text text text text text text text text text text text. Text text text text text text text text text text text text text text. Text text text text text text text text text text text text text text. Text text text text text text text text text text text text text text.&lt;/p&gt;\n","tags":[]},"1":{"uniqueId":916,"nr":1,"parentNr":null,"multireplyPostNrs":[],"postType":null,"authorId":226,"createdAtMs":1475310361760,"lastApprovedEditAtMs":1475427096405,"numEditors":1,"numLikeVotes":0,"numWrongVotes":0,"numBuryVotes":0,"numUnwantedVotes":0,"numPendingEditSuggestions":0,"summarize":false,"summary":null,"squash":false,"isTreeDeleted":false,"isPostDeleted":false,"isTreeCollapsed":false,"isPostCollapsed":false,"isTreeClosed":false,"isApproved":true,"pinnedPosition":null,"branchSideways":null,"likeScore":0.18,"childIdsSorted":[2],"sanitizedHtml":"&lt;p&gt;Hi people from Hacker News,&lt;/p&gt;\n&lt;ol&gt;\n&lt;li&gt;\n&lt;p&gt;How do you find comments added whilst you went for a coffee, or during the night?&lt;br&gt;\nLike so: Open the right hand sidebar: Click &lt;strong&gt;&lt;code&gt;&amp;lt;&lt;/code&gt;&lt;/strong&gt; int the upper right corner.  Now you should see a list of recent comments.&lt;/p&gt;\n&lt;p&gt;Do that now :- )&lt;/p&gt;\n&lt;/li&gt;\n&lt;li&gt;\n&lt;p&gt;When you're reading a comment, and wonder &amp;quot;what does it reply to?&amp;quot;, how do you quickly scroll up to the parent comment, if it's far away?&lt;br&gt;\nLike so: Click the &lt;strong&gt;arrow&lt;/strong&gt; towards the comment. Then the whole page jumps upwards and shows the parent comment.&lt;br&gt;\nOnce you've jumped to the parent, a &lt;strong&gt;Back&lt;/strong&gt; button appears at the bottom of the browser window. Click it.&lt;/p&gt;\n&lt;p&gt;Try this now:  Click the blue &lt;code&gt;Scroll&lt;/code&gt; button at the bottom of the window, then click &lt;code&gt;Bottom&lt;/code&gt; then click an arrow. ... Then click Back. Then Back again — and you're back here reading this :- )&lt;/p&gt;\n&lt;/li&gt;\n&lt;li&gt;\n&lt;p&gt;Downvote because disagree? With EffectiveDiscussions, there is the Like vote, plus &lt;strong&gt;three&lt;/strong&gt; other types of votes:&lt;/p&gt;\n&lt;ul&gt;\n&lt;li&gt;&lt;strong&gt;Disagree&lt;/strong&gt;. Results in a &amp;quot;Many people disagree with this post&amp;quot; text shown above the post. Does not affect the author's trust level. Does not affect the comment sort order (unless there are lots of &lt;em&gt;Disagree&lt;/em&gt; and no &lt;em&gt;Like&lt;/em&gt;). — Let's assume there's a post with many &lt;em&gt;Like&lt;/em&gt; votes. If lots of people have also voted &lt;em&gt;Disagree&lt;/em&gt; — that makes the post &lt;em&gt;even more&lt;/em&gt; interesting?&lt;/li&gt;\n&lt;li&gt;&lt;strong&gt;Bury&lt;/strong&gt;. Moves the post downwards, for whatever reason (e.g. &amp;quot;getting rid of&amp;quot; well intended but not so interesting &amp;quot;Thanks&amp;quot; and &amp;quot;Me too&amp;quot; comments). Does &lt;em&gt;not&lt;/em&gt; affect the post author's trust level, and only forum staff can see that you've bury-voted (so the author won't feel sad). If there's one or a few Like votes, then any Bury votes are mostly &lt;em&gt;ignored&lt;/em&gt;.&lt;/li&gt;\n&lt;li&gt;&lt;strong&gt;Unwanted&lt;/strong&gt; (not available to you). Slightly reduces the author's trust level. And moves the post downwards. I think &lt;em&gt;Unwanted&lt;/em&gt; is how downvotes work at Hacker News. Via &lt;em&gt;Unwanted&lt;/em&gt; votes + Like votes, core members &amp;amp; staff can shape the contents and nature of the forum.&lt;/li&gt;\n&lt;/ul&gt;\n&lt;/li&gt;\n&lt;li&gt;\n&lt;p&gt;Mobile phones. On small screens, some of the indentation, will be replaced with &lt;em&gt;&amp;quot;In reply to: (name)&amp;quot;&lt;/em&gt;  links to the parent posts (because there's not enough space to indent). Click the links, to jump to the parent post, and then click &lt;em&gt;Back&lt;/em&gt;.&lt;br&gt;\n&lt;br&gt;&lt;/p&gt;\n&lt;/li&gt;\n&lt;/ol&gt;\n&lt;p&gt;Now, feel free to talk with people here, or post test comments. Then have a look at &lt;a href=\"https://www.effectivediscussions.org/-31/support-chat\"&gt;the chat&lt;/a&gt;. Or &lt;a href=\"https://try.effectivediscussions.org/-6/can-penguins-fly\"&gt;this question/answers topic&lt;/a&gt; (that topic is at another website — the demo website).&lt;/p&gt;\n&lt;p&gt;All this is under development. Feel free to make change/improve/remove suggestions.&lt;/p&gt;\n","tags":[]}},"topLevelCommentIdsSorted":[],"siteSections":[{"pageId":"4jqu3","path":"/forum/","pageRole":7,"name":"(?? [EsU2UWY0]"}],"horizontalLayout":false,"is2dTreeDefault":false,"socialLinksHtml":""}"""

}
