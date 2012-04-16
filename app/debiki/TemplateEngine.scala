/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import controllers.Actions.PageRequest
import play.api.Play
import play.api.Play.current
import xml.{Node, NodeSeq, Text}
import Prelude._
import TemplateEngine._


class TemplateEngine(val pageCache: PageCache, val dao: Dao) {

  def renderPage(pageReq: PageRequest[_], pageRoot: PageRoot,
        appendToBody: NodeSeq = Nil): NodeSeq = {

    // Fetch or render page and comments.
    val textAndComments = pageCache.get(pageReq, pageRoot)

    val templates: List[TemplateSource] = {
      // Don't use custom templates, when editing a template. Otherwise, if
      // the user writes a html / template bug, it might no longer be
      // possible to view or edit the template, or any page that uses it.
      if (pageReq.pagePath.isTemplatePage || pageRoot.isPageTemplate)
        TemplateForTemplates::Nil
      else
        _loadTemplatesFor(pageReq.page_!, at = pageReq.pagePath)
    }

    // Import CSS Selector Tranforms classes and implicit conversions.
    import net.liftweb.util._
    import Helpers._
    // Apply templates. Merge all <head> stuff from all templates together
    // into one single list, inserted into the final <head>.
    // Recursively wrap page <body> stuff inside the parent template's
    // <div id='debiki-page'/>.
    var headTags: NodeSeq = Nil
    var bodyTags: NodeSeq = textAndComments
    var templParams = TemplateParams.Default

    templates foreach { templ: TemplateSource =>
    //this.logger.debug("About to apply template:\n"+ t)
    //this.logger.debug("To head:\n"+ headTags)
    //this.logger.debug("To body:\n"+ bodyTags)
    // It seems the html5 parser adds empty <head> and <body> tags,
    // if they're missing.
      val t = templ.html
      val tmplHeadTags = (t \ "head").headOption.map(_.child).getOrElse(Nil)
      var tmplBodyTags = (t \ "body").headOption.map(_.child).getOrElse(Nil)
      headTags = tmplHeadTags ++ headTags
      // In case someone specifies a <head> tag only, the <body> will be
      // empty. Allow this -- simply pass on the current body, unchanged
      // (rather than discarding it to serve an empty page).
      if (tmplBodyTags isEmpty) tmplBodyTags = <div id='debiki-page'/>
      bodyTags = ("#debiki-page" #> bodyTags)(tmplBodyTags)
      templParams = templ.params.mergeOverride(templParams)
    }

    // Handle template param values.
    val DH = DebateHtml
    templParams.commentVisibility.getOrElse(assErr("DwE0kDf9")) match {
      case CommentVisibility.Visible => // fine, already visible
      case CommentVisibility.ShowOnClick =>
        headTags = headTags ++ DH.tagsThatHideShowInteractions
    }

    // Replace magic body tags.
    bodyTags = (
       "#debiki-login" #> DH.loginInfo(userName = None) // &
          // "#debiki-inbox" #> _renderInbox(pageReq)
       )(bodyTags)

    // Prepend scripts, stylesheets and a charset=utf-8 meta tag.
    headTags = HeadHtml ++ headTags
    val page =
      <html>
        <head>{headTags}</head>
        <body class='dw-ui-simple'>{bodyTags ++ appendToBody}</body>
      </html>

    page
  }


  /**
   * Which template will be loaded? Consider this:
   * /some/very-nice/page would use the first one available of:
   *   /some/very-nice/page?view=template
   *   /some/very-nice/.folder.template,
   *   /some/very-nice/.tree.template,
   *   /some/.tree.template,
   *   /.tree.template
   *
   * (Crazy...?: What about /some/very-.tree.template ?
   * Then you could edit /about-.template to layout all these pages:
   * /about-tech  /about-people  /about-mission
   * Or?? /prefix-.tree.template  -- applied to  /prefix-tail/every/thing
   * and: /prefix-.folder.template -- applied to /prefix-this-folder-only
   * (I don't think templates should depend on tags and categories?
   * Because users see the url folders in the nav bar, but no trees/
   * categories. So better make the template depend on the path only?)
   */
  private def _loadTemplatesFor(page: Debate, at: PagePath)
        : List[TemplateSource] = {
    val pagePath = at
    import TemplateToExtend._

    var templates = List[TemplateSource]()
    var nextTemplAndPath = _loadOwnOrClosestTemplateFor(page, pagePath)
    while (nextTemplAndPath isDefined) {
      val curPath = nextTemplAndPath.get._2
      val curTempl = nextTemplAndPath.get._1 
      
      // Check for cycles. (Only check recursion depth right now; cannot
      // compare two TemplateSrc:s with each other, and paths forgotten.)
      if (10 < templates.size)
        runErr("DwE091KQ3", "Too long template extension chain, a cycle?")

      templates ::= curTempl
      nextTemplAndPath = (curTempl.params.templateToExtend getOrElse
         TemplateToExtend.ExtendClosestTemplate) match {
        case ExtendClosestTemplate => _loadClosestTemplateFor(curPath)
        case ExtendNoTemplate => None
        case ExtendSpecificTmpl(url) =>
          _loadTemplateAt(url, basePage = pagePath)
      }
    }

    if (templates isEmpty)
      templates ::= DefaultTemplate

    templates.reverse
  }


  /**
   * Returns the page's own template, if any. Otherwise
   * returns the closest template, or None, if none found.
   */
  def _loadOwnOrClosestTemplateFor(page: Debate, pagePath: PagePath)
        : Option[(TemplateSource, PagePath)] = {
    require(!pagePath.isTemplatePage)
    page.pageTemplateSrc foreach { templ =>
      return Some((templ, pagePath))
    }
    _loadClosestTemplateFor(pagePath)
  }


  /**
   * The closest template is the first one of any .folder.template or
   * .tree.template in the closest folder.
   *
   * (If pagePath is itself a template, its parent folder is ignored though,
   * so pagePath itself won't be found again.)
   * 
   * (The closest folder of
   * /some/folder/subfolder/ is /some/folder/, and for
   * /some/folder/page it is /some/folder/. )
   */
  private def _loadClosestTemplateFor(pagePath: PagePath)
        : Option[(TemplateSource, PagePath)] = {

    // If pagePath is /folder/subfolder/.tree.template or .folder.template,
    // don't check /folder/subfolder/*.template again.
    // Instead only search for .tree.template:s in the parent parent folder,
    // i.e. /folder/.tree.template and /.tree.template. // Write TEST case?
    var (parentFolderOpt, checkFolderTempl) = {
      if (pagePath isTemplatePage)
        (pagePath.parentFolder.get.parentFolder, false)
      else
        (pagePath.parentFolder, true)
    }

    while (parentFolderOpt isDefined) {
      val parentFolder = parentFolderOpt.get
      val folderTemplPath = parentFolder.copy(pageSlug = ".folder.template")
      val treeTemplPath = parentFolder.copy(pageSlug = ".tree.template")

      if (checkFolderTempl) dao.loadTemplate(folderTemplPath) foreach { templ =>
        return Some((templ, folderTemplPath))
      }

      dao.loadTemplate(treeTemplPath) foreach { templ =>
        return Some((templ, treeTemplPath))
      }

      // Continue checking ancestor folders.
      checkFolderTempl = false
      parentFolderOpt = parentFolder.parentFolder
    }
    None
  }


  /**
   * Loads the template located at `url`, which might point to another tenant,
   * e.g. `http://other-tenant.com/templates/nice.template`.
   */
  private def _loadTemplateAt(url: String, basePage: PagePath)
        : Option[(TemplateSource, PagePath)] = {

    // Parse URL, resolve host name to tenant id.
    val parsedUrl = _parseUrl(url)
    val tenantId = parsedUrl.schemeHostOpt match {
      case None => basePage.tenantId
      case Some((scheme, host)) =>
        dao.lookupTenant(scheme, host) match {
          case found: FoundChost => found.tenantId
          case found: FoundAlias => found.tenantId
          case FoundNothing =>
            // COULD throw some exception that can be converted
            // to a 400 Bad Request?
            illArgErr("DwE0qx3", "Template not found: `"+ url +
               "', bad host name?")
        }
    }

    // Handle relative folder paths.
    var folder =
      if (parsedUrl.folder startsWith "/") parsedUrl.folder
      else basePage.parentFolder + parsedUrl.folder

    val templPath =  PagePath(tenantId = tenantId, folder = folder,
       pageId = None, showId = false, pageSlug = parsedUrl.page)

    dao.loadTemplate(templPath) match {
      case Some(templ) => Some((templ, templPath))
      case None => None
    }
  }


  private case class ParsedUrl(
    schemeHostOpt: Option[(String, String)],
    folder: String,
    page: String)


  /**
   * Extracts any scheme and host from an url, and parses the path component
   * into a PagePath. Verifies that any host name contains only valid chars.
   *
   * Examples:
   * _parseUrl("http://server/folder/page")
   * gives: ParsedUrl(Some((http,server)),/folder/,page)
   *
   * _parseUrl("http://server/folder/")
   * gives: ParsedUrl(Some((http,server)),/folder/,)
   *
   * _parseUrl("http://server/page")
   * gives: ParsedUrl(Some((http,server)),/,page)
   *
   * _parseUrl("http://server/")
   * gives: ParsedUrl(Some((http,server)),/,)
   *
   * _parseUrl("http://server")  throws error.
   *
   * _parseUrl("folder/")  gives: ParsedUrl(None,folder/,)
   *
   * _parseUrl("/page")  gives: ParsedUrl(None,/,page)
   *
   * _parseUrl("page")  gives: ParsedUrl(None,,page)
   *
   */
  private def _parseUrl(url: String): ParsedUrl = {
    // Reject urls with query string or hash.
    require(!url.contains("#") && !url.contains("?"))
    val parsedUrl = url match {
      case _OriginFoldrPageRegex(scheme, host, relFolder_?, page) =>
        val folder = (relFolder_? eq null) ? "/" | "/"+ relFolder_?
        if (!isValidHostAndPort(host))
          illArgErr("DwE7IJz5", "Invalid host name: "+ host)
        ParsedUrl(Some((scheme, host)), folder, page)
      case _AbsFolderPageRegex(folder, _, page) =>
        assert(page ne null)
        ParsedUrl(None, folder, page)
      case _RelFolderPageRegex(folder_?, page) =>
        val folder = (folder_? eq null) ? "" | folder_?
        assert(page ne null)
        ParsedUrl(None, folder, page)
      case _ =>
        // COULD throw some exception that can be converted
        // to a 400 Bad Request?
        illArgErr("DwE3KQg3", "Bad template URL: "+ url)
    }

    // "http://server" is parsed incorrectly, reject it.
    if (parsedUrl.folder contains "://")
      illArgErr("DwE0KGf4", "Bad template URL: "+ url)
    if (parsedUrl.page contains "://")
      illArgErr("DwE4GZk2", "Bad template URL: "+ url)

    parsedUrl
  }

  private val _OriginFoldrPageRegex = """^(https?)://([^/]+)/(.*/)?([^/]*)$""".r
  private val _AbsFolderPageRegex = """^(/(.*/)?)([^/]*)$""".r
  private val _RelFolderPageRegex = """([^/].*/)?([^/]*)""".r

}


object TemplateEngine {

  // Play Framework RCX is very very tricky to use right now, I think,
  // w.r.t. the Google Closure Compiler and CommonJS and "require" and
  // "export". I'd better wait with minifying stuff, until the Play
  // people have fixed all the open tickets etcetera.
  val minMaxJs = ".js" // later: if (Play.isProd) ".min.js" else ".js"

  val HeadHtml: NodeSeq =
    <div>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>{/*
    Concerning when/how to use a CDN for Modernizr, see:
      http://www.modernizr.com/news/modernizr-and-cdns  */}
    <script src="http://cdnjs.cloudflare.com/ajax/libs/modernizr/2.5.3/modernizr.min.js"></script>
    <script src={"https://ajax.googleapis.com/ajax/libs/jquery/1.7.1/jquery"+ minMaxJs}></script>{/*
    <!-- Could:
    <script>
    if (!window.jQuery) document.write(unescape("%3Cscript src='/path/to/your/jquery' %3E%3C/script%3E"));
    </script>
    See:
    http://stackoverflow.com/questions/1014203/best-way-to-use-googles-hosted-jquery-but-fall-back-to-my-hosted-library-on-goo
    COULD: Rename /classpath/js/... to /lib/, since contains CSS & imgs too.
    */}
    <script src={"/classpath/js/jquery-cookie"+ minMaxJs}></script>
    <script src="/classpath/js/wmd/showdown.js"></script>
    <script src={"http://ajax.googleapis.com/ajax/libs/jqueryui/1.8.18/jquery-ui"+ minMaxJs}></script>
    <script src={"/classpath/js/jquery-scrollable"+ minMaxJs}></script>
    <script src={"/classpath/js/debiki"+ minMaxJs}></script>
    <script src={"/classpath/js/debiki-utterscroll"+ minMaxJs}></script>
    <script src="/classpath/js/diff_match_patch.js"></script>
    <script src="/classpath/js/html-sanitizer-minified.js"></script>
    <script src={"/classpath/js/tagdog"+ minMaxJs}></script>
    <script src="/classpath/lib/openid-selector/js/openid-jquery.js"></script>
    <script src="/classpath/lib/openid-selector/js/openid-en.js"></script>
    <script src={"/classpath/js/popuplib"+ minMaxJs}></script>
    <script src={"/classpath/js/bootstrap-tooltip"+ minMaxJs}></script>
    {/* Could load on demand though. */}
    <script src={"/classpath/js/javascript-yaml-parser"+ minMaxJs}></script>
    <!--[if lt IE 9]>
    <script src="http://html5shiv.googlecode.com/svn/trunk/html5.js"></script>
    <![endif]-->
      <link type="text/css" rel="stylesheet" href="/classpath/lib/openid-selector/css/openid.css" />
      <link type="text/css" rel="stylesheet" href="/classpath/css/debiki/jquery-ui-1.8.16.custom.css"/>
      <link type="text/css" rel="stylesheet" href="/classpath/css/debiki.css"/>
    <!--[if IE 7]>
    <link type="text/css" rel="stylesheet" href="/classpath/css/debiki-lift-ie7.css"/>
    <![endif]-->
    <!-- Make this webapp a Weinre debug target, see:
         http://pmuellr.github.com/weinre/Running.html
         (The ip addr is my desktop, where the Weinre debug server runs.) -->
    <!-- <script src="http://192.168.0.100:8081/target/target-script-min.js"></script> -->
    <!-- <link rel="canonical" - if diffing revisions, point to latest,
              and if using /a35..r3n4+rsn3+...3rs/ syntax.
             see http://searchengineland.com/canonical-tag-16537 -->
    {/* Tenant specific stylesheets might want to include:
    <link type="text/css" rel="stylesheet" href="/classpath/css/debiki-lift.css"/>
     */}
    </div>.child


  object DefaultTemplate extends TemplateSource {
    val params = TemplateParams.Default.copy(
       templateToExtend = Some(TemplateToExtend.ExtendNoTemplate))

    val html: Node = _makeTemplateNode(title = "Your New Website",
      prependToContent = Nil)
  }


  object TemplateForTemplates extends TemplateSource {
    val params = TemplateParams.Default

    val html: Node = _makeTemplateNode(title = "Debiki",
      prependToContent = <div id='template-info'>This is a template page.</div>)
    /* (Old info text.)
    When you view or edit a template, all your other templates,
    stylesheets and javascripts are disabled. Otherwise,
    if you accidentally break the template (e.g. malformed HTML),
    you could end up in a situation where you could neither view
    any page, nor view or edit the template again.</div>  */
  }


  private def _makeTemplateNode(
        title: String, prependToContent: NodeSeq): Node = {
      <html>
      <head>
        <title>{title}</title>
          <meta name="description" content=""/>
          <meta name="keywords" content=""/>
          <link type="text/css" rel="stylesheet" href="/classpath/css/debiki-lift.css"/>
        <style>
          #template-info {{
          font-style: italic;
          margin: 1ex 0 2em;
          max-width: 40em;
          }}
        </style>
        <!-- CodeMirror editor -->
          <link rel="stylesheet" href="/classpath/lib/codemirror/lib/codemirror.css"/>
        <script src="/classpath/lib/codemirror/lib/codemirror.js"></script>
        <script src="/classpath/lib/codemirror/mode/css/css.js"></script>
        <script src="/classpath/lib/codemirror/mode/javascript/javascript.js"></script>
        <script src="/classpath/lib/codemirror/mode/xml/xml.js"></script>
        <script src="/classpath/lib/codemirror/mode/htmlmixed/htmlmixed.js"></script>
        <style>
          .CodeMirror {{
          border: 1px solid #eee;
          font-size: 11px;
          }}
          .CodeMirror-scroll {{
          height: auto;
          overflow-y: hidden;
          overflow-x: auto;
          width: 100%;
          }}
          .cm-tab:after {{
          content: "\21e5";
          display: -moz-inline-block;
          display: -webkit-inline-block;
          display: inline-block;
          width: 0px;
          position: relative;
          overflow: visible;
          left: -1.4em;
          color: #aaa;
          }}
        </style>
      </head>
      <body>
        <nav id="site-nav">
          <span id='dw-loginout'>
            <span id='debiki-login'></span>
          </span>
        </nav>
        <div id='page' class='ui-helper-clearfix'>
          <div id="sidebar">
            <a href='/'>
              <header id="header">
                <h1>Debiki</h1>
                <p id="slogan">— för de givande samtalen</p>
              </header>
            </a>
          </div>
          <div id='content'>
            { prependToContent }
            <article>
              <div id='debiki-page'></div>
            </article>
          </div>
        </div>
      </body>
      </html>
  }

}
