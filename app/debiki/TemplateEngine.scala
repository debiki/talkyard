/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import controllers.Actions.PageRequest
import _root_.net.liftweb.common._
//import _root_.net.liftweb.http._
import _root_.net.liftweb.util._
import xml.{Node, NodeSeq, Text}
import Prelude._
import TemplateEngine._


class TemplateEngine(val pageCache: PageCache, val dao: Dao) {

  def renderPage(pageReq: PageRequest[_], pageRoot: PageRoot): NodeSeq = {

    // Fetch or render page and comments.
    val textAndComments = pageCache.get(pageReq, pageRoot)

    // if (the page says it extends any non default template)
    //   templates-to-load = that-template :: Nil
    // else
    val templates: List[TemplateSource] =
      _findTemplatesFor(pageReq.pagePath, pageRoot)
    // later:
    // /some/very-nice/page would try to use these templates:
    //   /some/very-nice/page.template,
    //   /some/very-nice/.folder.template,
    //   /some/very-nice/.tree.template,
    //   /some/.tree.template,
    //   /.tree.template
    // /some/-38638945-nice-page would use:
    //   /some/-38638945-nice-page.template,
    //   /some/-.template,  ?? -- no, too complicated.. ??
    //   /some/.folder.template,
    //   /some/.tree.template,
    //   /.tree.template
    // So you can edit /about-.template to layout all these pages:
    // /about-tech  /about-people  /about-mission
    // Or?? /prefix-.tree.template  -- applied to  /prefix-tail/every/thing
    // and: /prefix-.folder.template -- applied to /prefix-this-folder-only
    // (I don't think templates should depend on tags and categories?
    // Because users see the url folders in the nav bar, but no trees/
    // categories. So better make the template depend on the path only?)

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
        <body class='dw-ui-simple'>{bodyTags}</body>
      </html>

    page
  }

  private def _findTemplatesFor(pagePath: PagePath, pageRoot: PageRoot)
        : List[TemplateSource] = {

    if (pagePath.isTemplatePage || pageRoot.isPageTemplate) {
      // Don't use templates, when editing a template. Otherwise, if the
      // user writes a html / template bug, it might no longer be possible to
      // view or edit the template, or any page that uses it.
      return TemplateForTemplates::Nil
    }

    val page = dao.loadPage(pagePath.tenantId, pagePath.pageId.get).get

    // Load parent folder templates, for pagePath.
    var templPaths: List[PagePath] = _parentTemplPathsFor(pagePath)

    // Add the page's own template, if any.
    if (pageRoot.id != Page.TemplateId) {
      templPaths ::= pagePath
    } else {
      // We're viewing the page's template itself --
      // then don't apply that template. (In case it's buggy,
      // it would otherwise never be possible to fix the bug.)
    }

    import TemplateToExtend._

    var templates = List[TemplateSource]()
    var next: TemplateToExtend = ExtendParentFolderTmpl
    templPaths takeWhile { templPath =>
      val templOpt = {
        if (templPath == pagePath) page.pageTemplateSrc
        else dao.loadTemplate(templPath)
      }
      templOpt match {
        case Some(templ: TemplateSource) =>
          templates ::= templ
          next = templ.params.templateToExtend getOrElse ExtendParentFolderTmpl
        case None =>  // skip non existing templates
      }
      // Continue takeWhile loop if we need another parent folder template.
      next == ExtendParentFolderTmpl
    }

    // Continue handling any specifically requested templates.
    if (next.isInstanceOf[ExtendSpecificTmpl])
      unimplemented("Extending specific template [error DwE9012k35]")

    assert(next == ExtendParentFolderTmpl || next == ExtendNoTemplate)

    if (templates isEmpty)
      unimplemented // was: return LiftUtil.defaultTemplate_tmpTest::Nil

    templates.reverse
  }

  /**
   * Returns paths to parent folder and tree templates for `pagePath',
   */
  private def _parentTemplPathsFor(pagePath: PagePath): List[PagePath] = {
    // For now, add only 3 -- no 2, see below --
    // locations: 1) the root template, "/.tree.template",
    // which is applied to all pages, and 2) a folder specific template,
    // "folder/.folder.template", which is applied to all pages in that
    // folder (but not child folders).
    val folderTmpl = pagePath.copy(pageId = None, showId = false,
      pageSlug = ".folder.template")
    // For now, add this "tree" template, for testing. It works for 1
    // folder only!
    val folderTreeTmpl =
      if (folderTmpl.folder == "/") Nil
      else List(folderTmpl.copy(pageSlug = ".tree.template"))
    val rootTmpl = PagePath(tenantId = pagePath.tenantId, folder = "/",
      pageId = None, showId = false,
      pageSlug = ".tree.template")
    folderTmpl::folderTreeTmpl:::rootTmpl::Nil
  }

}


object TemplateEngine {

  val HeadHtml: NodeSeq =
    <div>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
    {/* svg.js must the first script on the page. Skip for IE 8 (and 7),
    otherwise an error "'undefined' is null or not an object" happens
    in svg.js on line 56 (the minified version). */}
    { xml.Unparsed("<![if !IE]>") }
    <script data-path="/classpath/js" type="text/javascript" src="/classpath/js/svg.js"/>
    { xml.Unparsed("<![endif]>") }
    <!--[if gte IE 9]>
    <script data-path="/classpath/js" type="text/javascript" src="/classpath/js/svg.js"></script>
    <![endif]-->
    <!-- Could:
    <script type="text/javascript" src="http://ajax.googleapis.com/ajax/libs/jquery/1.X.Y/jquery.min.js"></script>
    <script type="text/javascript">
    if (!window.jQuery) document.write(unescape("%3Cscript src='/path/to/your/jquery' type='text/javascript'%3E%3C/script%3E"));
    </script>
    See:
    http://stackoverflow.com/questions/1014203/best-way-to-use-googles-hosted-jquery-but-fall-back-to-my-hosted-library-on-goo
    COULD: Rename /classpath/js/... to /lib/, since contains CSS & imgs too.
    -->
    <script type="text/javascript" src="/classpath/js/modernizr-2.0.6.js"></script>
    <script type="text/javascript" src="/classpath/js/jquery-1.6.4.js"></script>
    <script type="text/javascript" src="/classpath/js/jquery.cookie.js"></script>
    <script type="text/javascript" src="/classpath/js/wmd/showdown.js"></script>
    <script type="text/javascript" src="/classpath/js/jquery-ui-1.8.16.custom.min.js"></script>
    <script type="text/javascript" src="/classpath/js/debiki.js"></script>
    <script type="text/javascript" src="/classpath/js/debiki-utterscroll.js"></script>
    <script type="text/javascript" src="/classpath/js/debiki-lift.js"></script>
    <script type="text/javascript" src="/classpath/js/diff_match_patch.js"></script>
    <script type="text/javascript" src="/classpath/js/html-sanitizer-minified.js"></script>
    <script type="text/javascript" src="/classpath/js/tagdog.js"></script>
    <script type="text/javascript" src="/classpath/lib/openid-selector/js/openid-jquery.js"></script>
    <script type="text/javascript" src="/classpath/lib/openid-selector/js/openid-en.js"></script>
    <script type="text/javascript" src="/classpath/js/popuplib.js"></script>
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


  object TemplateForTemplates extends TemplateSource {
    val params = TemplateParams.Default
    val html: Node =
      <html>
      <head>
        <title>Debiki</title>
          <meta name="description" content=""/>
          <meta name="keywords" content=""/>
          <link type="text/css" rel="stylesheet" href="/classpath/css/debiki-lift.css"/>
        <style type="text/css">
          #template-info {{
          font-style: italic;
          margin: 1ex 0 2em;
          max-width: 40em;
          }}
        </style>
        <!-- CodeMirror editor -->
          <link rel="stylesheet" href="/classpath/lib/codemirror/lib/codemirror.css"/>
        <script type="text/javascript" src="/classpath/lib/codemirror/lib/codemirror.js"></script>
        <script type="text/javascript" src="/classpath/lib/codemirror/mode/css/css.js"></script>
        <script type="text/javascript" src="/classpath/lib/codemirror/mode/javascript/javascript.js"></script>
        <script type="text/javascript" src="/classpath/lib/codemirror/mode/xml/xml.js"></script>
        <script type="text/javascript" src="/classpath/lib/codemirror/mode/htmlmixed/htmlmixed.js"></script>
        <style type="text/css">
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
            <div id='template-info'>This is a template page.</div>
            {/*
          When you view or edit a template, all your other templates,
          stylesheets and javascripts are disabled. Otherwise,
          if you accidentally break the template (e.g. malformed HTML),
          you could end up in a situation where you could neither view
          any page, nor view or edit the template again.</div>
          */}
            <article>
              <div id='debiki-page'></div>
            </article>
          </div>
        </div>
      </body>
      </html>
  }

}
