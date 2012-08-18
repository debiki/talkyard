/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package controllers

import com.debiki.v0._
import com.debiki.v0.Prelude._
import debiki._
import java.{util => ju}
import play.api._
import play.api.data._
import play.api.data.Forms._
import play.api.libs.json.Json
import play.api.libs.json.Json.toJson
import play.api.mvc.{Action => _, _}
import xml.{Node, NodeSeq}
import Actions._
import DebikiHttp._
import Prelude._
import Utils.ValidationImplicits._
import Utils.{OkHtml, OkXml}


/**
 * Lists folders, pages and actions.
 *
 * Usage examples: (replies in Yaml, although the server actually uses JSON)
 *
 * ?list=folders&in-trees|folders=/prefix-1/+/prefix-2/   # unsupported
 * ?list=folders&in-tree=/   # the only list=folders request supported
 *   -->
 *   foldersByFullPath:
 *    /prefix-1/some/folder/: {}   # allPagesIncluded is undefined, i.e. false
 *    /prefix-1/other/folder/: {}
 *    /prefix-2/third/folder/: {}
 *    /more-folders/blabla/: {}
 *
 * ?list=pages&in-folders=(path, path)
 *   -->
 *   foldersByFullPath:
 *    /some/folder/:
 *     allPagesIncluded: true
 *     pagesById:
 *       039rf5:                # allActionsIncluded is undefined, i.e. false
 *         slug: page-slug
 *         showId: false
 *       039rf5:
 *         slug: page-slug
 *         showId: true
 *
 * ?list=actions&of-types=(article,comment,rating,
 *  etc)&in-trees=/some/folder/+/other/folder/
 * ?list=actions&of-types=(article,comment,rating,etc)&in-pages=1234+5678
 *
 * foldersByFullPath:
 *   /some/folder/:
 *     allPagesIncluded: true
 *     pagesById:
 *       039rf5:
 *         slug: page-slug
 *         allActionsIncluded: true
 *         actionsById:
 *           90kj31:
 *             type: Post
 *             authorId: 93kr21
 *             loginId: 03df51
 *           2351k1:
 *             ...
 *       039rf5:
 *         ...
 *   /other/folder/:
 *     allPagesIncluded: true
 *     pagesById:
 *       ...
 *
 * Whenever you ask the server to list more stuff, you can use jQuery to
 *  recursively merge in the new stuff:
 *  $.extend(true, foldersByFullPath, moreStuffFromServer)
 * This works since the stuff is keyed by id.
 *
 * When you're about to use some stuff, e.g. list all pages in a folder,
 * then: (in Coffeescript — and probably with lots of bugs)
 *
 *   unless foldersByPath[someFolder].allPagesIncluded
 *     foldersAndPages debiki.v0.server.listPages inFolder = someFolder
 *     $.extend true, foldersByPath, pages
 *     $.extend true, pages page for page in _(foldersAndPages).pluck 'pages'
 *   # Now use foldersByPath[someFolder].
 *
 * An when you're listing all comments on a page:
 *
 *   unless pages[pageId].allActionsIncluded
 *     foldersPagesAndActions = debiki.v0.server.listActions inPage = pageId
 *     $.extend true, foldersByPath, foldersPagesAndActions
 *     $.extend true, pages page for page in _(foldersPagesAndActions).pluck
 *  'pages'
 *   # Now use pages[pageId]
 *
 */
object AppList extends mvc.Controller {


  def listPages(pathIn: PagePath, contentType: DebikiHttp.ContentType) =
        PageGetAction(pathIn, pageMustExist = false) { pageReq =>
    val pathScope = Utils.parsePathScope(pageReq.queryString.getFirst("in"))
    val pagePaths = pageReq.dao.listPagePaths(
      withFolderPrefix = pageReq.pagePath.folder,
      pathScope = pathScope,
      include = PageStatus.All,
      sortBy = PageSortOrder.ByPath,
      limit = Int.MaxValue,
      offset = 0)

    def renderPageListHtml(pagePathsDetails: Seq[(PagePath, PageDetails)]) =
      <ol>{
        for ((pagePath, details) <- pagePathsDetails) yield {
          <li><a href={pagePath.path}>{pagePath.path}</a></li>
        }
      }</ol>

    contentType match {
      case DebikiHttp.ContentType.Html =>
        val pageNode = renderPageListHtml(pagePaths)
        OkHtml(<html><body>{pageNode}</body></html>)
      case DebikiHttp.ContentType.Json =>
        unimplemented
    }
  }


  def listActions(pathIn: PagePath, contentType: DebikiHttp.ContentType) =
        PageGetAction(pathIn, pageMustExist = false) { pageReq =>
    val pathScope = Utils.parsePathScope(pageReq.queryString.getFirst("in"))
    val actionLocators = pageReq.dao.listActions(
      folderPrefix = pageReq.pagePath.path,
      pathScope = pathScope,
      includePages = PageStatus.All,
      limit = 700, offset = 0)
    contentType match {
      case DebikiHttp.ContentType.Html =>
        Ok(views.html.listActions(actionLocators))
      case DebikiHttp.ContentType.Json =>
        unimplemented
    }
  }

}

