/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import controllers.Actions.PageRequest
import play.api.Play
import play.api.Play.current
import Prelude._
import TemplateEngine._
import xml.{MetaData, Node, NodeSeq, Text}


/**
 * The template engine adds stuff around a page, that is,
 * around a blog article / forum question / whatever-page and subsequent
 * comments. The added stuff could be e.g. a navigation bar
 * or a page footer and header.
 *
 * The template engine starts with the page itself, then finds all its
 * parent templates, and applies them one at a time. The very first
 * template is the child-page?view=template post, if it exists.
 * Otherwise it's the .template file closest to the page.
 * A template specifies which template is its parent template
 * via its extend-template config value.
 *
 * Here's how the template engine works, when merging a child template
 * with its parent template:
 *
 * 1. Any child template <head> <title> or <meta name='description'> or
 * <meta name='keywords'> elems replace corresponding elems in the parent
 * template. Other elems inside the child's <head> are appended to
 * the parent template's <head>.
 *
 * 2. If a direct child of the <head> or <body> in the child template
 * has an attribute `data-replace='#X'`, then it replaces any elem
 * in the parent template with id 'X'.
 *
 * 3. Elems inside <body> replace the first elem in the parent template
 * that has an attribute `data-replace-with='child-body'` (not implemented
 * though!), or, if there is no such parent elem, the child body contents
 * is appended to the parent template's <body>.
 *
 * Thread safe.
 */
class TemplateEngine(val pageCache: PageCache) {


  def renderPage(pageReq: PageRequest[_], pageRoot: PageRoot,
        appendToBody: NodeSeq = Nil): NodeSeq = {

    // Load page and all templates needed.
    val textAndComments = pageCache.get(pageReq, pageRoot)
    val templates: List[TemplateSource] = {
      // Don't use custom templates, when editing a template. Otherwise, if
      // the user writes a html / template bug, it might no longer be
      // possible to view or edit the template, or any page that uses it.
      if (pageReq.pagePath.isTemplatePage || pageRoot.isPageTemplate)
        TemplateForTemplates::Nil
      else
        _loadTemplatesFor(pageReq.page_!, at = pageReq.pagePath,
           use = pageReq.dao)
    }

    // Create initial template data.
    var curHtmlAttrs: MetaData = xml.Null
    var curBodyAttrs: MetaData = xml.Null
    var curHeadTags: NodeSeq = Nil
    var curBodyTags: NodeSeq =
      <div data-replace='#debiki-page'>{textAndComments}</div>
    var templParams = TemplateParams.Default

    // COULD rewrite, loop from outer to most specific template instead.
    // Then the more specific templs would see all ids of all outer
    // templates, even if I add a insert-child-<body>-here
    // tag. If however you loop from the most specific to the outmost
    // template, then once you've insted the child-<body> inside
    // a nested elem in a parent template, all ids-that-were-intended-to
    // -replace-something-in-an-ancestor-template are now hidden deply
    // nested in the page and aren't considered for replacement.
    // Perhaps do this:
    // Loop from outmost to most specific template.
    // Insert child template <body> at <div data-insert='child-body'/>.
    // Insert the specified templ into <t1 data-insert='/page-footer.template'>.
    // Replace a <t1 id='X'> w/ child templ tag like: <t2 data-replace='#X'>
    // Insert into <t1 id='X'> child tag like: <t2 data-insert-into='#X'>
    templates foreach { templ: TemplateSource =>
    //this.logger.debug("About to apply template:\n"+ t)
    //this.logger.debug("To head:\n"+ headTags)
    //this.logger.debug("To body:\n"+ bodyTags)
    // It seems the html5 parser adds empty <head> and <body> tags,
    // if they're missing.
      val prntHtmlTagOpt = templ.html.headOption.filter(_.label == "html")
      val prntBodyTagOpt = templ.html \ "body"

      val prntHeadTagsBeforeRepl =
         (templ.html \ "head").headOption.map(_.child).getOrElse(Nil)
      val prntBodyTagsBeforeRepl =
         prntBodyTagOpt.headOption.map(_.child).getOrElse(Nil)

      // Merge parent head and body attributes.
      prntHtmlTagOpt foreach { prntHtmlTag =>
        curHtmlAttrs = curHtmlAttrs append prntHtmlTag.attributes
      }
      prntBodyTagOpt foreach { prntBodyTag =>
        curBodyAttrs = curBodyAttrs append prntBodyTag.attributes
      }

      // Replace parent template head tags with any corresponding tags found
      // in the more specific child and successor templates.
      val (prntHeadTagsTemp, curHeadTagsTemp) =
         replaceMatchingHeadTags(
           in = prntHeadTagsBeforeRepl, vith = curHeadTags)

      // Also replace head tags by id.
      // This makes it possible for the parent template to [assign ids
      // to <script> and <link> tags], to make it possible for the
      //child template to replace such tags?
      val (prntHeadTagsAfterRepl, curHeadTagsAfterRepl) =
         replaceTagsWithMatchingId(
           in = prntHeadTagsTemp, vith = curHeadTagsTemp)

      // Replace body tags by id only.
      val (prntBodyTagsAfterRepl, curBodyTagsAfterRepl) =
         replaceTagsWithMatchingId(
           in = prntBodyTagsBeforeRepl, vith = curBodyTags)

      // Prepend parent template tags and replaced tags to remaining
      // child template tags.
      curHeadTags = prntHeadTagsAfterRepl ++ curHeadTagsAfterRepl
      curBodyTags = prntBodyTagsAfterRepl ++ curBodyTagsAfterRepl

      templParams = templ.params.mergeOverride(templParams)
    }

    // Handle template param values.
    val DH = DebateHtml
    templParams.commentVisibility.getOrElse(assErr("DwE0kDf9")) match {
      case CommentVisibility.Visible => // fine, already visible
      case CommentVisibility.ShowOnClick =>
        curHeadTags = curHeadTags ++ DH.tagsThatHideShowInteractions
    }

    // Replace magic body tags.
    // currently doesn't work because loginInfo is a NodeSeq:
    curBodyTags = transform(curBodyTags,
       replacements = Map("debiki-login" -> DH.loginInfo(userName = None)))

    // Prepend scripts, stylesheets and a charset=utf-8 meta tag.
    curHeadTags = HeadHtml ++ curHeadTags
    val classes =
       "DW "+
       "dw-pri "+
       "dw-ui-simple "+
       "dw-render-actions-pending "+
       "dw-render-layout-pending "
    // COULD merge class attributes from all templates?
    val page =
      <html class={classes}>
        <head>{curHeadTags}</head>
        {<body>{curBodyTags ++ appendToBody}</body> % curBodyAttrs}
      </html> % curHtmlAttrs
    page
  }


  /**
   * Returns the most specific template first (the page's own template if any).
   *
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
  private def _loadTemplatesFor(page: Debate, at: PagePath, use: TenantDao)
        : List[TemplateSource] = {
    val pagePath = at
    val dao = use
    import TemplateToExtend._

    var templates = List[TemplateSource]()
    var nextTemplAndPath =
       _loadOwnOrClosestTemplateFor(page, pagePath, dao)
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
        case ExtendClosestTemplate => _loadClosestTemplateFor(curPath, dao)
        case ExtendNoTemplate => None
        case ExtendSpecificTmpl(url) =>
          _loadTemplateAt(url, basePage = pagePath, dao)
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
  def _loadOwnOrClosestTemplateFor(page: Debate, pagePath: PagePath,
        dao: TenantDao): Option[(TemplateSource, PagePath)] = {
    require(!pagePath.isTemplatePage)
    page.pageTemplateSrc foreach { templ =>
      return Some((templ, pagePath))
    }
    _loadClosestTemplateFor(pagePath, dao)
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
  private def _loadClosestTemplateFor(pagePath: PagePath, dao: TenantDao)
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
  private def _loadTemplateAt(url: String, basePage: PagePath, dao: TenantDao)
        : Option[(TemplateSource, PagePath)] = {

    // Parse URL, resolve host name to tenant id.
    val parsedUrl = _parseUrl(url)
    val tenantId = parsedUrl.schemeHostOpt match {
      case None => basePage.tenantId
      case Some((scheme, host)) =>
        dao.lookupOtherTenant(scheme, host) match {
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


  /**
   * Replaces tags in `in` with any corresponding tags in
   * `vith`. Returns `in` but with tags replaced, and `vith`,
   * but with all tags-that-replaced-other-tags-in-`in` removed.
   */
  def replaceMatchingHeadTags(in: NodeSeq, vith: NodeSeq)
        : (NodeSeq, NodeSeq) = {

    var replacersLeft = vith
    val replaced = in map { parentTag =>
      // Check if a corresponding tag is present in any successor template.
      // If so, let the successor template tag overwrite the parent tag,
      // and remove the successor tag from curHeadTags.
      var replacementTag: Option[Node] = None
      replacersLeft = replacersLeft filter { testTag =>
        def sameAttrVal(attrName: String) =
          testTag.attribute(attrName).isDefined &&
             testTag.attribute(attrName) ==  parentTag.attribute(attrName)
        //def sameIdAttr = sameAttrVal("id")
        def sameNameAttr = sameAttrVal("name")
        def sameLabel = testTag.label == parentTag.label
        def bothAreMeta = parentTag.label == "meta" && sameLabel
        def bothAreTitle = parentTag.label == "title" && sameLabel
        // This works for all of <meta name="description" ...> and
        // <div id="..." ...> and <title>.
        if (//sameIdAttr ||
            (bothAreMeta && sameNameAttr) || bothAreTitle) {
          // Replace the parent tag with the child tag.
          replacementTag = Some(testTag)
          // Remove this child tag from the child tag list.
          // (If there are many matching tags, they're all removed
          // and only the last one replaces the tag in `in`.)
          false
        } else {
          // Keep child tag.
          true
        }
      }
      replacementTag getOrElse parentTag
    }

    (replaced, replacersLeft)
  }


  def replaceTagsWithMatchingId(in: NodeSeq, vith: NodeSeq)
        : (NodeSeq,  NodeSeq) = {

    def idToReplaceWith(node: Node): Option[String] =
      node.attribute("data-replace") match {
        case Some(Text(attrVal)) =>
          // In the future, could allow people to specify many ids,
          // by splitting them via ',':  data-replace='#a, #b, #c'.
          if (attrVal startsWith "#") Some(attrVal.tail)
          else None
        case _ => None
      }

    // Find ids of elems that could be replaced.
    val idsCouldBeReplaced: Set[String] = (in \\ "@id").map(_.text).toSet

    // Find matching replacers.
    val (actualReplacers, replacersLeft) =
      vith partition {  replacer =>
        idToReplaceWith(replacer) match {
          case None => false
          case Some(replacerId) => idsCouldBeReplaced.contains(replacerId)
        }
      }

    // Transform `in`.
    val replacementMap: Map[String, NodeSeq] =
      actualReplacers.groupBy(node => idToReplaceWith(node).get)
    val replaced = transform(in, replacements = replacementMap)

    (replaced, replacersLeft)
  }


  /**
   * Transforms `nodeSeq` according to the specified transformations.
   */
  def transform(nodeSeq: NodeSeq, replacements: Map[String, NodeSeq])
        : NodeSeq = {
    // Deep-traverse all nodes and apply transformations.
    def transformNode(node: Node): NodeSeq = node match {
      case xml.Group(ns) => xml.Group(ns.flatMap(transformNode))
      case elem: xml.Elem =>
        def copyAndTransformChildren = elem.copy(
           child = elem.child.flatMap(transformNode))
        elem.attribute("id") match {
          case None => copyAndTransformChildren
          case Some(id) =>
            replacements.get(id.text) match {
              case None => copyAndTransformChildren
              case Some(replacementNodes) => replacementNodes
            }
        }
      case x => x
    }
    nodeSeq.flatMap(transformNode)
  }


  val minMaxJs = if (Play.isProd) ".min.js" else ".js"


  private val debikiNamespaceAndScriptLoad = """
    |var debiki = { v0: { util: {} }, internal: { $: jQuery } };
    |debiki.scriptLoad = $.Deferred();
    |""".stripMargin

  val HeadHtml: NodeSeq =
    <div>
    {/* Some other viewport values, and the absence of a value,
    trigger Android bugs that report the wrong screen.width,
    window.innerWidth, document.documentElement.clientWidth and heights,
    breaking dwScrollIntoView (and other stuff?) in debiki.js.
    See: http://code.google.com/p/android/issues/detail?id=10775#c20   */}
    <meta name="viewport" content="initial-scale=1.0, minimum-scale=0.01"/>
    <meta charset="utf-8"/>
    {/* Concerning when/how to use a CDN for Modernizr, see:
      http://www.modernizr.com/news/modernizr-and-cdns
    And: "For best performance, you should have them follow after your
    stylesheet references", http://modernizr.com/docs/#installing  */}
    <script src="http://cdnjs.cloudflare.com/ajax/libs/modernizr/2.5.3/modernizr.min.js"></script>
    <script src={"https://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery"+ minMaxJs}></script>
    <script src={"http://ajax.googleapis.com/ajax/libs/jqueryui/1.8.19/jquery-ui"+ minMaxJs}></script>{/*
    <!-- Could:
    <script>
    if (!window.jQuery) document.write(unescape("%3Cscript src='/path/to/your/jquery' %3E%3C/script%3E"));
    </script>
    See:
    http://stackoverflow.com/questions/1014203/best-way-to-use-googles-hosted-jquery-but-fall-back-to-my-hosted-library-on-goo
    */}
    {
      // The debiki.scriptLoad $.Deferred is resolved later by debiki.js.
      if (Play.isProd) {
        <script>
        { debikiNamespaceAndScriptLoad }
        Modernizr.load({{
          test: Modernizr.touch,
          yep: '/-/res/combined-debiki-touch.min.js',
          nope: '/-/res/combined-debiki-desktop.min.js'
        }});
        </script>
      } else {
        <script>
        { debikiNamespaceAndScriptLoad }
        // Play doesn't make `require` and `exports` available in dev builds.
        window.require = function() {{}};
        window.exports = {{}};

        Modernizr.load({{
          test: Modernizr.touch,
          yep: [
            '/-/res/android-zoom-bug-workaround.js'],
          nope: [
            '/-/res/jquery-scrollable.js',
            '/-/res/debiki-utterscroll.js',
            '/-/res/debiki-utterscroll-init-tips.js',
            '/-/res/debiki-keyboard-shortcuts.js',
            '/-/res/bootstrap-tooltip.js'],
          both: [
            '/-/res/diff_match_patch.js',
            '/-/res/html-sanitizer-bundle.js',
            '/-/res/jquery-cookie.js',
            '/-/res/tagdog.js',
            '/-/res/javascript-yaml-parser.js',
            '/-/res/debiki-util.js',
            '/-/res/debiki-util-play.js',
            '/-/res/debiki-jquery-find.js',
            '/-/res/debiki-resize.js',
            '/-/res/debiki-scroll-into-view.js',
            '/-/res/debiki-show-and-highlight.js',
            '/-/res/debiki-merge-changes.js',
            '/-/res/debiki-arrows-png.js',
            '/-/res/debiki-arrows-svg.js',
            '/-/res/debiki-jquery-dialogs.js',
            '/-/res/debiki-form-anims.js',
            '/-/res/debiki-http-dialogs.js',
            '/-/res/debiki-cur-user.js',
            '/-/res/debiki-login.js',
            '/-/res/debiki-login-guest.js',
            '/-/res/debiki-login-openid.js',
            '/-/res/debiki-logout-dialog.js',
            '/-/res/debiki-markup.js',
            '/-/res/debiki-inline-threads.js',
            '/-/res/debiki-actions-inline.js',
            '/-/res/debiki-action-links.js',
            '/-/res/debiki-action-reply.js',
            '/-/res/debiki-action-rate.js',
            '/-/res/debiki-action-edit.js',
            '/-/res/debiki-action-flag.js',
            '/-/res/debiki-action-delete.js',
            '/-/res/debiki-edit-history.js',
            '/-/res/debiki-show-interactions.js',
            '/-/res/debiki-show-location-in-nav.js',
            '/-/res/debiki-post-header.js',
            '/-/res/debiki.js']
        }});
        </script>
      }
    }
      <link rel="stylesheet" href="/-/res/jquery-ui/jquery-ui-1.8.16.custom.css"/>
      <link rel="stylesheet" href="/-/res/debiki.css"/>
    <!--[if IE 7]>
    <link rel="stylesheet" href="/-/res/debiki-lift-ie7.css"/>
    <![endif]-->
    <!-- Make this webapp a Weinre debug target, see:
         http://pmuellr.github.com/weinre/Running.html
         (The ip addr is my desktop, where the Weinre debug server runs.) -->
    <!-- <script src="http://192.168.0.100:8081/target/target-script-min.js"></script> -->
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
          <link rel="stylesheet" href="/-/res/debiki-lift.css"/>
        <style>
          #template-info {{
          font-style: italic;
          margin: 1ex 0 2em;
          max-width: 40em;
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
