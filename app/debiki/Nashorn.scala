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
import debiki.onebox.{LinkPreviewRendererForNashorn, LinkPreviewRenderer}
import org.apache.lucene.util.IOUtils
import scala.concurrent.Future
import Nashorn._
import jdk.nashorn.api.scripting.ScriptObjectMirror
import org.scalactic.{Bad, ErrorMessage, Good, Or}
import talkyard.server.TyLogging
import scala.collection.mutable.ArrayBuffer



case class RenderCommonmarkResult(safeHtml: String, mentions: Set[String])


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
class Nashorn(
  // CLEAN_UP don't expose. Barely matters.
  val globals: Globals) extends TyLogging {

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

  private def secure = globals.secure
  private def cdnOrigin: Option[String] = globals.anyCdnOrigin
  private def isTestSoDisableScripts = globals.isTestDisableScripts


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
  def startCreatingRenderEngines(): Unit = {
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


  private def createOneMoreJavascriptEngine(isVeryFirstEngine: Boolean = false): Unit = {
    val engine = try {
      val engine = makeJavascriptEngine()
      warmupJavascriptEngine(engine)
      engine
    }
    catch {
      case throwable: Throwable =>
        if (// [PLAY28] ?? Play.maybeApplication.isEmpty ||
            throwable.isInstanceOf[Globals.NoStateError]) {
          if (!Globals.isProd) {
            logger.debug(
              "Server gone, tests done? Fine, cancelling script engine creation. [TyM6MK4]")
          }
          else {
            logger.error("Error creating Javascript engine: No server [TyE6JY22]", throwable)
          }
        }
        else if (isVeryFirstEngine) {
          logger.error("Error creating the very first Javascript engine: [TyE6KG25Z]", throwable)
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


  def renderPage(reactStoreJsonString: String): String Or ErrorMessage = {
    if (isTestSoDisableScripts)
      return Good("Scripts disabled [EsM6YKW2]")
    withJavascriptEngine(engine => {
      renderPageImpl(engine, reactStoreJsonString)
    })
  }


  private def renderPageImpl[R](engine: js.Invocable, reactStoreJsonString: String)
        : String Or ErrorMessage = {
    val timeBefore = System.currentTimeMillis()

    val htmlOrError = engine.invokeFunction(
          "renderReactServerSide", reactStoreJsonString,
          // CLEAN_UP REMOVE  cdnOrigin not needd here any more?
          // Instead: theStore.anyCdnOrigin
          cdnOrigin.getOrElse("")).asInstanceOf[String]
    if (htmlOrError.startsWith(ErrorRenderingReact)) {
      logger.error(s"Error rendering page with React server side [DwE5KGW2]")
      return Bad(htmlOrError)
    }

    def timeElapsed = System.currentTimeMillis() - timeBefore
    def threadId = java.lang.Thread.currentThread.getId
    def threadName = java.lang.Thread.currentThread.getName
    logger.trace(s"Done rendering: $timeElapsed ms, thread $threadName  (id $threadId)")

    Good(htmlOrError)
  }


  def renderAndSanitizeCommonMark(
        commonMarkSource: String,
        siteIdHostnames: SiteIdHostnames,
        embeddedOriginOrEmpty: String,
        allowClassIdDataAttrs: Boolean,
        followLinks: Boolean): RenderCommonmarkResult = {

    val siteId = siteIdHostnames.id
    val pubSiteId = siteIdHostnames.pubId

    if (isTestSoDisableScripts)
      return RenderCommonmarkResult("Scripts disabled [EsM5GY52]", Set.empty)

    // For <iframe> embedded discussions, need include the full link to the
    // Talkyard server — because relative links would be interpreted
    // relative the embedd*ing* website's origin, and thus point to the
    // wrong server. That's why we need embeddedOriginOrEmpty.
    //
    // However, on non-embedded pages, use local upload links. So will work also if
    // moves server to other address.
    //
    // The uploadsUrlPrefix will be wrong, if 1) a CDN is in use but the CDN moves to
    // a new address, or 2) no CDN so the links point to the Talkyard server,
    // but the Talkyard server moves to a new address.
    //
    // The Talkyard server knows if it moves to a different address,
    // and could scan all comments lazily before showing them again — and
    // re-generate them as needed, with a new and correct CDN origin or embedded origin.
    // If takes long (like, a second) to re-render, then, can show the old broken
    // links until done, should look fine a second later after page reload.
    // [lazy-upd-link-origins]

    // For @mentions: [6JKD2A] ok hack for now — COULD start using
    // embeddedOriginOrEmpty for mentions too?

    val uploadsUrlPrefix =
      cdnOrigin.getOrElse(
        embeddedOriginOrEmpty) +
          ed.server.UploadsUrlBasePath + pubSiteId + '/'

    // This link preview renderer fetches previews from the database,
    // link_previews_t, but makes no external requests — cannot do that from inside
    // a Nashorn script.
    val prevwRenderer = new LinkPreviewRendererForNashorn(
          new LinkPreviewRenderer(
              globals, siteId = siteId,
              // Cannot do external requests from inside Nashorn.
              mayHttpFetch = false,
              // The requester doesn't matter — won't fetch external data.
              requesterId = SystemUserId))

    val (safeHtmlNoPreviews, mentions) = withJavascriptEngine(engine => {
      val resultObj: Object = engine.invokeFunction("renderAndSanitizeCommonMark",
            commonMarkSource,
            true.asInstanceOf[Object], // allowClassIdDataAttrs.asInstanceOf[Object],
            followLinks.asInstanceOf[Object],
            prevwRenderer, uploadsUrlPrefix)

      val result: ScriptObjectMirror = resultObj match {
        case scriptObjectMirror: ScriptObjectMirror =>
          scriptObjectMirror
        case errorDetails: ErrorMessage =>
          // Don't use Die — the stack trace to here isn't interesting? Instead, it's the
          // errorDetails from the inside-Nashorn exception that matters.
          debiki.EdHttp.throwInternalError(
            "TyERCMEX", "Error rendering CommonMark, server side in Nashorn", errorDetails)
        case unknown =>
          die("TyERCMR01", s"Bad class: ${classNameOf(unknown)}, thing as string: ``$unknown''")
      }

      dieIf(!result.isArray, "TyERCMR02", "Not an array")
      dieIf(!result.hasSlot(0), "TyERCMR03A", "No slot 0")
      dieIf(!result.hasSlot(1), "TyERCMR03B", "No slot 1")
      dieIf(result.hasSlot(2), "TyERCMR03C", "Has slot 2")

      val elem0 = result.getSlot(0)
      dieIf(!elem0.isInstanceOf[String], "TyERCMR04", s"Bad safeHtml class: ${classNameOf(elem0)}")
      val safeHtml = elem0.asInstanceOf[String]

      val elem1 = result.getSlot(1)
      dieIf(!elem1.isInstanceOf[ScriptObjectMirror],
          "TyERCMR05", s"Bad mentionsArray class: ${classNameOf(elem1)}")
      val mentionsArrayMirror = elem1.asInstanceOf[ScriptObjectMirror]

      val mentions = ArrayBuffer[String]()
      var nextSlotIx = 0
      while (mentionsArrayMirror.hasSlot(nextSlotIx)) {
        val elem = mentionsArrayMirror.getSlot(nextSlotIx)
        dieIf(!elem.isInstanceOf[String], "TyERCMR06", s"Bad mention class: ${classNameOf(elem)}")
        mentions.append(elem.asInstanceOf[String])
        nextSlotIx += 1
      }

      (safeHtml, mentions.toSet)
    })

    val safeHtmlWithLinkPreviews = prevwRenderer.replacePlaceholders(safeHtmlNoPreviews)
    RenderCommonmarkResult(safeHtmlWithLinkPreviews, mentions)
  }


  def sanitizeHtml(text: String, followLinks: Boolean): String = {
    sanitizeHtmlReuseEngine(text, followLinks, None)
  }


  private def sanitizeHtmlReuseEngine(text: St, followLinks: Bo,
        javascriptEngine: Opt[js.Invocable]): St = {
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


  /** Might return an empty slug ("") if the title contains only "weird" chars,
    * (currently only ASCII allowed [30BDAH256]) that's fine (gets converted
    * to and from '-' in Postgres [274RKNQ2])
    */
  def slugifyTitle(title: String): String = {
    if (isTestSoDisableScripts)
      return "scripts-disabled-EsM28WXP45"
    withJavascriptEngine(engine => {
      val slug = engine.invokeFunction("debikiSlugify", title)
      slug.asInstanceOf[String]
    })
  }


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

    val languageCode = AllSettings.makeDefault(globals).languageCode

    // Pass 'null' so that a class loader that finds the Nashorn extension will be used.
    // Otherwise the Nashorn engine won't be found and `newEngine` will be null.
    // See: https://github.com/playframework/playframework/issues/2532
    val newEngine = new js.ScriptEngineManager(null).getEngineByName("nashorn")
    val scriptBuilder = new StringBuilder

    scriptBuilder.append(i"""
        |// React expects `window` or `global` to exist, and my React code sometimes
        |// load React components from `window['component-name']`.
        |var global = window = this;
        |
        |$DummyConsoleLogFunctions
        |
        |var eds = {
        |  secure: $secure
        |};
        |// CLEAN_UP remove debiki.v0 & .internal [4KSWPY]
        |var debiki = {
        |  v0: { util: {} },
        |  internal: {},
        |};
        |
        |var debiki2 = debiki2 || {};
        |var theStore; // Hack. Used here and there directly [4AGLH2], works fine ... and fragile?
        |
        |/**
        | * A React store for server side rendering. No event related functions; no events happen
        | * when rendering server side.
        | */
        |debiki2.ReactStore = {
        |  allData: function() {
        |    return theStore;
        |  },
        |  getUser: function() {
        |    return theStore.me;
        |  },
        |  getPageTitle: function() { // dupl code [5GYK2]
        |    var titlePost = theStore.currentPage.postsByNr[TitleNr];
        |    return titlePost ? titlePost.sanitizedHtml : "(no title)";
        |  }
        |};
        |
        |// React-Router calls setTimeout(), but it's not available in Nashorn.
        |function setTimeout(callback) {
        |  callback();
        |}
        |
        |function renderReactServerSide(reactStoreJsonString, cdnOriginOrEmpty) {
        |  var exceptionAsString;
        |  try {
        |    theStore = JSON.parse(reactStoreJsonString);
        |    theStore.currentPage = theStore.pagesById[theStore.currentPageId];
        |
        |    // Fill in no-page-data to avoid null errors. Dupl code. [4FBR20]
        |    theStore.me.myCurrentPageData = {
        |      pageId: '0', // EmptyPageId, but isn't defined here
        |      myPageNotfPref: undefined,
        |      groupsPageNotfPrefs: [],
        |      votes: {},
        |      unapprovedPosts: {},
        |      unapprovedPostAuthors: [],
        |      postNrsAutoReadLongAgo: [],
        |      postNrsAutoReadNow: [],
        |      marksByPostId: {},
        |    };
        |
        |    // Each language file creates a 't_(lang-code)' global variable, e.g. 't_en_US' for English.
        |    // And they all set a global 'var t' to themselves (t is declared in those files).
        |    // Update 't' here; it gets used during rendering. If language missing (that'd be a bug),
        |    // fallback to English.
        |    var langCode = theStore.settings.languageCode || '$languageCode';
        |    t = global['t_' + langCode] || t_en_US;
        |
        |    // The React store should be used instead, when running React.
        |    eds.uploadsUrlPrefixCommonmark = 'TyEFORCOMMONMARK';  // [7AKBQ2]
        |
        |    var html = debiki2.renderPageServerSideToString();
        |    return html;
        |  }
        |  catch (e) {
        |    printStackTrace(e);
        |    exceptionAsString = exceptionToString(e);
        |  }
        |  finally {
        |    // Reset things to error codes, to fail fast, if attempts to access these,
        |    // when using this same Nashorn engine to render Markdown to HTML.
        |    t = 'TyEBADACCESSLANG';
        |    theStore = 'TyEBADACCESSSTORE';
        |  }
        |  return '$ErrorRenderingReact\n\n' + exceptionAsString;
        |}
        |""")

    // Sometimes use .min when testing, because in prod builds, the non-.min
    // files are deleted (so Docker images smaller).  [del_non_min_js]
    val dotMin =
          if (globals.isProd || sys.env.get("IS_PROD_TEST").is("true")) ".min"
          else ""

    var javascriptStream: jio.InputStream = null
    try {
      // Add translations, required by the render-page-code later when it runs.
      def addTranslation(langCode: String): Unit = {
        val translScript = loadAssetAsString(
          s"translations/$langCode/i18n$dotMin.js", isTranslation = true)
        scriptBuilder.append(translScript)
      }

      // Sync w languages in /translations/, the admin UI language selector, and the Makefile. [5JUKQR2]
      addTranslation("en_US")
      addTranslation("es_CL")  // Spanish, Chile
      addTranslation("he_IL")  // Hebrew
      addTranslation("lv_LV")  // Latvian
      addTranslation("pl_PL")  // Polish
      addTranslation("pt_BR")  // Portuguese, Brazilian
      addTranslation("ru_RU")  // Russian
      addTranslation("sv_SE")  // Swedish

      // Add render page code.
      val rendererScript = loadAssetAsString(s"server-bundle$dotMin.js", isTranslation = false)
      scriptBuilder.append(rendererScript)
    }
    finally {
      IOUtils.closeWhileHandlingException(javascriptStream)
    }

    scriptBuilder.append(i"""
        |$RenderAndSanitizeCommonMark
        |""")

    // Output the script so we can lookup line numbers if there's an error.
    val script = scriptBuilder.toString()
    if (!Globals.isProd) {
      val where = "target/nashorn-ok-delete.js"   // RENAME to -auto-generated.js? sounds more serious
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


  private def loadAssetAsString(path: String, isTranslation: Boolean): String = {
    def whatFile = if (isTranslation) "Language" else "Script"
    def gulpTarget = if (isTranslation) "transl_dev_bundles" else "build"
    def makeMissingMessage =
        s"$whatFile file not found: $path, 'gulp $gulpTarget' not run or isn't done?"

    // Load file directly from disk — otherwise, if using getClass.getResourceAsStream(path),
    // Play Framework for some reason won't pick it up any changes, until after
    // 'sbt clean', which can be confusing and waste time.
    var source: scala.io.Source = null
    try {
      source = scala.io.Source.fromFile(  // [Scala_213] Using(...) { ... }
            "/opt/talkyard/app/assets/" + path)(scala.io.Codec.UTF8)
      source.mkString  // [APPJSPATH]
    }
    catch {
      case ex: Exception =>
        val message = makeMissingMessage
        logger.error(message + " [TyELOADJS1]")
        throw new DebikiException("TyELOADJS2", message)
    }
    finally {
      if (source ne null) source.close()
    }
  }


  private def warmupJavascriptEngine(engine: js.ScriptEngine): Unit = {
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



object Nashorn {

  /** Initializing engines takes rather long, so create only two in dev mode:
    * one for the RenderContentService background actor, and one for
    * http request handler threads that need to render content directly.
    */
  val MinNumEngines = 2

  private val ErrorRenderingReact = "__error_rendering_react_5KGF25X8__"


  private val RenderAndSanitizeCommonMark = i"""
    |var md;
    |try {
    |  // Dupl code browser side: [9G03MSRMW2].
    |  md = markdownit({ html: true, linkify: true, breaks: true });
    |  md.use(debiki.internal.MentionsMarkdownItPlugin());
    |  md.use(debiki.internal.LinkPreviewMarkdownItPlugin);
    |  ed.editor.CdnLinkifyer.replaceLinks(md);
    |}
    |catch (e) {
    |  console.error("Error creating CommonMark renderer: [TyECMARKRENDR]");
    |  printStackTrace(e);
    |}
    |
    |// Returns [html, mentions] if ok, else a string with an error message
    |// and exception stack trace.
    |function renderAndSanitizeCommonMark(source, allowClassIdDataAttrs, followLinks,
    |       instantLinkPreviewRenderer, uploadsUrlPrefixCommonmark) {
    |  var exceptionAsString;
    |  try {
    |    theStore = null; // Fail fast. Don't use here, might not have been inited.
    |    eds.uploadsUrlPrefixCommonmark = uploadsUrlPrefixCommonmark;  // [7AKBQ2]
    |    debiki.internal.serverSideLinkPreviewRenderer = instantLinkPreviewRenderer;
    |    debiki.mentionsServerHelp = [];
    |    var unsafeHtml = md.render(source);
    |    var mentionsThisTime = debiki.mentionsServerHelp;
    |    delete debiki.mentionsServerHelp;
    |    var allowClassAndIdAttr = allowClassIdDataAttrs;
    |    var allowDataAttr = allowClassIdDataAttrs;
    |    var html = googleCajaSanitizeHtml(
    |          unsafeHtml, allowClassAndIdAttr, allowDataAttr, followLinks);
    |    // Fail fast — simplify detection of reusing without reinitialzing:
    |    eds.uploadsUrlPrefixCommonmark = 'TyE4GKFWB0';
    |    debiki.internal.serverSideLinkPreviewRenderer = 'TyE56JKW20';
    |    return [html, mentionsThisTime];
    |  }
    |  catch (e) {
    |    console.error("Error in renderAndSanitizeCommonMark: [TyERNDRCM02A]");
    |    printStackTrace(e);
    |    exceptionAsString = exceptionToString(e);
    |  }
    |  return "Error in renderAndSanitizeCommonMark: [TyERNDRCM02B]\n\n" + exceptionAsString;
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
    |
    |// CLEAN_UP DO_AFTER 2018-11-01 use this + console.error(), instead of printStackTrace(exception) ?
    |// — just wait for a short while, in case there's some surprising problem with this fn:
    |// Could actually remove printStackTrace() and always log the error from Scala instead? since
    |// needs to return the error to Scala anyway, so can show in the browser.
    |function exceptionToString(exception) {
    |  return (
    |      'File: nashorn-ok-delete.js\n' +
    |      'Line: ' + exception.lineNumber  + '\n' +
    |      'Column: ' + exception.columnNumber  + '\n' +
    |      'Exception message: ' + exception + '\n' +
    |      'Exception as JSON: ' + JSON.stringify(exception) + '\n' +
    |      // It's useful to include the 2 lines above, not only `.stack` below, because
    |      // sometimes, e.g. if doing `throw 'text'`, then `.stack` will be `undefined`.
    |      // However, `exception.toString()` will be 'text'.
    |      'Stack trace: ' + exception.stack  + '\n');
    |}
    |"""


  /** The page-type-question e2e test, run it like so:
    * s/wdio target/e2e/wdio.2chrome.conf.js --only page-type-question-closed.2browsers --da
    * and then open the source, and copy the json inside the #thePageJson script elem.
    */
  private val WarmUpReactStoreJsonString = """{"dbgSrc":"PgToJ","widthLayout":3,"isEmbedded":false,"embeddedOriginOrEmpty":"","anyCdnOrigin":null,"appVersion":"0.00.63","pubSiteId":"1k5gn0fkc3","siteId":-277,"siteCreatedAtMs":1556265635284,"siteStatus":2,"userMustBeAuthenticated":false,"userMustBeApproved":false,"settings":{"enableGoogleLogin":true,"enableFacebookLogin":true,"enableTwitterLogin":true,"enableGitHubLogin":true,"enableGitLabLogin":true,"enableLinkedInLogin":true,"enableVkLogin":true,"enableInstagramLogin":true,"enableTags":false},"publicCategories":[{"id":2,"name":"Uncategorized","slug":"uncategorized","defaultTopicType":12,"newTopicTypes":[],"unlistCategory":false,"unlistTopics":false,"includeInSummaries":0,"position":50,"description":"The default category.","isDefaultCategory":true}],"topics":null,"me":{"dbgSrc":"2FBS6Z8","trustLevel":0,"notifications":[],"watchbar":{"1":[],"2":[],"3":[],"4":[]},"myGroupIds":[],"myDataByPageId":{},"marksByPostId":{},"closedHelpMessages":{},"tourTipsSeen":[],"uiPrefsOwnFirst":[],"permsOnPages":[{"id":1,"forPeopleId":10,"onCategoryId":2,"mayEditOwn":true,"mayCreatePage":true,"mayPostComment":true,"maySee":true,"maySeeOwn":true}]},"rootPostId":1,"usersByIdBrief":{"101":{"id":101,"username":"maria","fullName":"Maria","isAuthenticated":true},"102":{"id":102,"username":"michael","fullName":"Michael","isAuthenticated":true},"104":{"id":104,"username":"owen_owner","fullName":"Owen Owner","isAuthenticated":true,"isAdmin":true}},"pageMetaBriefById":{},"siteSections":[{"pageId":"fmp","path":"/","pageRole":7}],"socialLinksHtml":"","currentPageId":"1","pagesById":{"1":{"pageId":"1","pageVersion":14,"pageMemberIds":[],"forumId":"fmp","ancestorsRootFirst":[{"categoryId":1,"title":"Home","path":"/latest","unlistCategory":false,"unlistTopics":false},{"categoryId":2,"title":"Uncategorized","path":"/latest/uncategorized","unlistCategory":false,"unlistTopics":false}],"categoryId":2,"pageRole":10,"pagePath":{"value":"/-1/which-pet","folder":"/","pageId":"1","showId":true,"slug":"which-pet"},"pageLayout":0,"pageHtmlTagCssClasses":"","pageHtmlHeadTitle":"","pageHtmlHeadDescription":"","pinOrder":null,"pinWhere":null,"pageAnsweredAtMs":"2019-04-26 08:01Z","pageAnswerPostUniqueId":106,"pageAnswerPostNr":3,"doingStatus":1,"pagePlannedAtMs":null,"pageStartedAtMs":null,"pageDoneAtMs":null,"pageClosedAtMs":"2019-04-26 08:01Z","pageLockedAtMs":null,"pageFrozenAtMs":null,"pageHiddenAtMs":null,"pageDeletedAtMs":null,"numPosts":8,"numPostsRepliesSection":6,"numPostsChatSection":0,"numPostsExclTitle":7,"postsByNr":{"0":{"uniqueId":103,"nr":0,"parentNr":null,"multireplyPostNrs":[],"postType":1,"authorId":101,"createdAtMs":1556265641181,"approvedAtMs":1556265641181,"lastApprovedEditAtMs":null,"numEditors":1,"numLikeVotes":0,"numWrongVotes":0,"numBuryVotes":0,"numUnwantedVotes":0,"numPendingEditSuggestions":0,"summarize":false,"summary":null,"squash":false,"isTreeDeleted":false,"isPostDeleted":false,"isTreeCollapsed":false,"isPostCollapsed":false,"isTreeClosed":false,"isApproved":true,"pinnedPosition":null,"branchSideways":null,"likeScore":0.18,"childNrsSorted":[],"sanitizedHtml":"Which pet?","tags":[],"unsafeSource":"Which pet?"},"1":{"uniqueId":104,"nr":1,"parentNr":null,"multireplyPostNrs":[],"postType":1,"authorId":101,"createdAtMs":1556265641181,"approvedAtMs":1556265641181,"lastApprovedEditAtMs":null,"numEditors":1,"numLikeVotes":0,"numWrongVotes":0,"numBuryVotes":0,"numUnwantedVotes":0,"numPendingEditSuggestions":0,"summarize":false,"summary":null,"squash":false,"isTreeDeleted":false,"isPostDeleted":false,"isTreeCollapsed":false,"isPostCollapsed":false,"isTreeClosed":false,"isApproved":true,"pinnedPosition":null,"branchSideways":null,"likeScore":0.18,"childNrsSorted":[2,3,4,6,7],"sanitizedHtml":"&lt;p&gt;Should I get a cat or an otter?&lt;/p&gt;\n","tags":[]},"2":{"uniqueId":105,"nr":2,"parentNr":1,"multireplyPostNrs":[],"postType":1,"authorId":102,"createdAtMs":1556265646266,"approvedAtMs":1556265646266,"lastApprovedEditAtMs":null,"numEditors":1,"numLikeVotes":0,"numWrongVotes":0,"numBuryVotes":0,"numUnwantedVotes":0,"numPendingEditSuggestions":0,"summarize":false,"summary":null,"squash":false,"isTreeDeleted":false,"isPostDeleted":false,"isTreeCollapsed":false,"isPostCollapsed":false,"isTreeClosed":false,"isApproved":true,"pinnedPosition":null,"branchSideways":null,"likeScore":0.18,"childNrsSorted":[],"sanitizedHtml":"&lt;p&gt;Yes, a cat&lt;/p&gt;\n","tags":[]},"3":{"uniqueId":106,"nr":3,"parentNr":1,"multireplyPostNrs":[],"postType":1,"authorId":102,"createdAtMs":1556265648222,"approvedAtMs":1556265648222,"lastApprovedEditAtMs":null,"numEditors":1,"numLikeVotes":0,"numWrongVotes":0,"numBuryVotes":0,"numUnwantedVotes":0,"numPendingEditSuggestions":0,"summarize":false,"summary":null,"squash":false,"isTreeDeleted":false,"isPostDeleted":false,"isTreeCollapsed":false,"isPostCollapsed":false,"isTreeClosed":false,"isApproved":true,"pinnedPosition":null,"branchSideways":null,"likeScore":0.18,"childNrsSorted":[5],"sanitizedHtml":"&lt;p&gt;Yes, an otter&lt;/p&gt;\n","tags":[]},"4":{"uniqueId":107,"nr":4,"parentNr":1,"multireplyPostNrs":[],"postType":31,"authorId":104,"createdAtMs":1556265660455,"approvedAtMs":1556265660455,"lastApprovedEditAtMs":null,"numEditors":1,"numLikeVotes":0,"numWrongVotes":0,"numBuryVotes":0,"numUnwantedVotes":0,"numPendingEditSuggestions":0,"summarize":false,"summary":null,"squash":false,"isTreeDeleted":false,"isPostDeleted":false,"isTreeCollapsed":false,"isPostCollapsed":false,"isTreeClosed":false,"isApproved":true,"pinnedPosition":null,"branchSideways":null,"likeScore":0.18,"childNrsSorted":[],"sanitizedHtml":" closed this topic","tags":[]},"5":{"uniqueId":108,"nr":5,"parentNr":3,"multireplyPostNrs":[],"postType":1,"authorId":101,"createdAtMs":1556265662755,"approvedAtMs":1556265662755,"lastApprovedEditAtMs":null,"numEditors":1,"numLikeVotes":0,"numWrongVotes":0,"numBuryVotes":0,"numUnwantedVotes":0,"numPendingEditSuggestions":0,"summarize":false,"summary":null,"squash":false,"isTreeDeleted":false,"isPostDeleted":false,"isTreeCollapsed":false,"isPostCollapsed":false,"isTreeClosed":false,"isApproved":true,"pinnedPosition":null,"branchSideways":null,"likeScore":0.18,"childNrsSorted":[],"sanitizedHtml":"&lt;p&gt;Thanks! Such a good idea&lt;/p&gt;\n","tags":[]},"6":{"uniqueId":109,"nr":6,"parentNr":1,"multireplyPostNrs":[],"postType":4,"authorId":101,"createdAtMs":1556265665610,"approvedAtMs":1556265665610,"lastApprovedEditAtMs":null,"numEditors":1,"numLikeVotes":0,"numWrongVotes":0,"numBuryVotes":0,"numUnwantedVotes":0,"numPendingEditSuggestions":0,"summarize":false,"summary":null,"squash":false,"isTreeDeleted":false,"isPostDeleted":false,"isTreeCollapsed":false,"isPostCollapsed":false,"isTreeClosed":false,"isApproved":true,"pinnedPosition":null,"branchSideways":null,"likeScore":0.18,"childNrsSorted":[],"sanitizedHtml":"&lt;p&gt;Thanks everyone! An otter then, a bath tube, and fish.&lt;/p&gt;\n","tags":[]},"7":{"uniqueId":110,"nr":7,"parentNr":1,"multireplyPostNrs":[],"postType":31,"authorId":104,"createdAtMs":1556265666726,"approvedAtMs":1556265666726,"lastApprovedEditAtMs":null,"numEditors":1,"numLikeVotes":0,"numWrongVotes":0,"numBuryVotes":0,"numUnwantedVotes":0,"numPendingEditSuggestions":0,"summarize":false,"summary":null,"squash":false,"isTreeDeleted":false,"isPostDeleted":false,"isTreeCollapsed":false,"isPostCollapsed":false,"isTreeClosed":false,"isApproved":true,"pinnedPosition":null,"branchSideways":null,"likeScore":0.18,"childNrsSorted":[],"sanitizedHtml":" reopened this topic","tags":[]}},"parentlessReplyNrsSorted":[],"progressPostNrsSorted":[4,6,7],"horizontalLayout":false,"is2dTreeDefault":false}}}"""

}
