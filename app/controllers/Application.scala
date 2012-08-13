/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package controllers

import com.debiki.v0._
import com.debiki.v0.Prelude._
import debiki._
import java.{util => ju, io => jio}
import play.api._
import play.api.data._
import play.api.data.Forms._
import play.api.mvc.{Action => _, _}
import xml.{Node, NodeSeq}
import Actions._
import DebikiHttp._
import Play.current
import Prelude._
import Utils.ValidationImplicits._
import Utils.{OkHtml, OkXml}


object Application extends mvc.Controller {


  def showActionLinks(pathIn: PagePath, pageRoot: PageRoot, postId: String) =
    PageGetAction(pathIn) { pageReq =>
      val links = Utils.formHtml(pageReq, pageRoot).actLinks(postId)
      OkHtml(links)
    }


  def viewPost(pathIn: PagePath, pageRoot: PageRoot) = PageGetAction(pathIn) {
        pageReq =>
    val pageInfoYaml = pageReq.user.isEmpty ? "" | buildPageInfoYaml(pageReq)
    // If not logged in, then include an empty Yaml tag, so the browser
    // notices that it got that elem, and won't call GET ?page-info.
    val infoNode = <pre class='dw-data-yaml'>{pageInfoYaml}</pre>
    val pageHtml =
      Debiki.TemplateEngine.renderPage(pageReq, pageRoot,
         appendToBody = infoNode)
    OkHtml(pageHtml)
  }


  def rawBody(pathIn: PagePath) = PageGetAction(pathIn) { pageReq =>
    val pageBody = pageReq.page_!.body_!
    val contentType = (pageReq.pagePath.suffix match {
      case "css" => CSS
      case "js" => JAVASCRIPT
    })
    Ok(pageBody.text) as contentType
  }


  def handleRateForm(pathIn: PagePath, pageRoot: PageRoot, postId: String)
        = PagePostAction(maxUrlEncFormBytes = 1000)(pathIn) { pageReq =>

    val ratingTags =
      pageReq.listSkipEmpty(FormHtml.Rating.InputNames.Tag)
      .ifEmpty(throwBadReq("DwE84Ef6", "No rating tags"))

    var rating = Rating(
      id = "?", postId = postId, ctime = pageReq.ctime,
      loginId = pageReq.loginId_!, newIp = pageReq.newIp,
      // COULD use a Seq not a List, and get rid of the conversion
      tags = ratingTags.toList)

    Debiki.savePageActions(pageReq, rating::Nil)
    Utils.renderOrRedirect(pageReq, pageRoot)
  }


  def handleFlagForm(pathIn: PagePath, pageRoot: PageRoot, postId: String)
        = PagePostAction(MaxDetailsSize)(pathIn) { pageReq =>

    import FormHtml.FlagForm.{InputNames => Inp}

    val reasonStr = pageReq.getEmptyAsNone(Inp.Reason) getOrElse
      throwBadReq("DwE1203hk10", "Please select a reason")
    val reason = try { FlagReason withName reasonStr }
      catch {
        case _: NoSuchElementException =>
          throwBadReq("DwE93Kf3", "Invalid reason")
      }
    val details = pageReq.getNoneAsEmpty(Inp.Details)

    val flag = Flag(id = "?", postId = postId,
      loginId = pageReq.loginId_!, newIp = pageReq.newIp,
      ctime = pageReq.ctime, reason = reason, details = details)

    Debiki.savePageActions(pageReq, flag::Nil)

    // COULD include the page html, so Javascript can update the browser.
    OkDialogResult("Thanks", "", // (empty summary)
      "You have reported it. Someone will review it and"+
      " perhaps delete it or remove parts of it.")
  }


  def handleDeleteForm(pathIn: PagePath, pageRoot: PageRoot, postId: String)
        = PagePostAction(MaxDetailsSize)(pathIn) { pageReq =>

    import FormHtml.Delete.{InputNames => Inp}
    val wholeTree = "t" == pageReq.getNoneAsEmpty(Inp.DeleteTree).
       ifNotOneOf("tf", throwBadReq("DwE93kK3", "Bad whole tree value"))
    val reason = pageReq.getNoneAsEmpty(Inp.Reason)

    if (!pageReq.permsOnPage.deleteAnyReply)
      throwForbidden("DwE0523k1250", "You may not delete that comment")

    val deletion = Delete(
      id = "?", postId = postId, loginId = pageReq.loginId_!,
      newIp = pageReq.newIp, ctime = pageReq.ctime, wholeTree = wholeTree,
      reason = reason)

    Debiki.savePageActions(pageReq, deletion::Nil)

    // COULD include the page html, so Javascript can update the browser.
    OkDialogResult("Deleted", "", // (empty summary)
      "You have deleted it. Sorry but you need to reload the"+
      " page, to notice that it is gone.")
  }


  def parsePathScope(value: Option[String]) = value match {
    case Some("folder") => PathScope.Folder
    case Some("tree") => PathScope.Tree
    case Some("page") => PathScope.Page
    case Some(x) => throwBadParamValue("DwE093ki6", "in")
    case None => throwParamMissing("DwE86IG1", "in")
  }

  def listPages(pathIn: PagePath,
        contentType: DebikiHttp.ContentType) =
        PageGetAction(pathIn, pageMustExist = false) { pageReq =>
    val pathScope = parsePathScope(pageReq.queryString.getFirst("in"))
    val pagePaths = pageReq.dao.listPagePaths(
      withFolderPrefix = pageReq.pagePath.folder,
      pathScope = pathScope,
      include = PageStatus.All,
      sortBy = PageSortOrder.ByPath,
      limit = Int.MaxValue,
      offset = 0)
    contentType match {
      case DebikiHttp.ContentType.Html =>
        val pageNode = PageListHtml.renderPageList(pagePaths)
        OkHtml(<html><body>{pageNode}</body></html>)
      case DebikiHttp.ContentType.Json =>
        unimplemented
    }
  }


  def listActions(pathIn: PagePath,
        contentType: DebikiHttp.ContentType) =
        PageGetAction(pathIn, pageMustExist = false) { pageReq =>
    val pathScope = parsePathScope(pageReq.queryString.getFirst("in"))
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


  def feed(pathIn: PagePath) = PageGetAction(pathIn, pageMustExist = false) {
        pageReq =>

    import pageReq.{pagePath}
    val pathScope = parsePathScope(pageReq.queryString.getFirst("for"))

    // The tenant's name will be included in the feed.
    val tenant: Tenant = pageReq.dao.loadTenant()

    val feedPagePaths =
      if (!pagePath.isFolderOrIndexPage) List(pagePath)
      else pageReq.dao.listPagePaths(
        withFolderPrefix = pagePath.folder,
        pathScope = pathScope,
        include = List(PageStatus.Published),
        sortBy = PageSortOrder.ByPublTime,
        limit = Int.MaxValue,
        offset = 0
      ). map(_._1)  // discards PageDetails, ._2

    val pathsAndPages: Seq[(PagePath, Debate)] = feedPagePaths flatMap {
      feedPagePath =>
        val pageId: String = feedPagePath.pageId.getOrElse {
          errDbgDie("[error DwE012210u9]")
          "GotNoGuid"
        }
        val page = pageReq.dao.loadPage(pageId)
        page.map(p => List(feedPagePath -> p)).getOrElse(Nil)
    }

    val mostRecentPageCtime: ju.Date =
      pathsAndPages.headOption.map(pathAndPage =>
        pathAndPage._2.vipo_!(Debate.PageBodyId).ctime
      ).getOrElse(new ju.Date)

    // The feed concerns all pages below pagePath.path, so the URL to
    // that location should be a reasonable ID.
    val feedUrl = "http://"+ pageReq.request.host + pagePath.path

    val feedXml = AtomFeedXml.renderFeed(
      hostUrl = "http://"+ pageReq.request.host,
      feedId = feedUrl,
      feedTitle = tenant.name +", "+ pagePath.path,
      feedUpdated = mostRecentPageCtime,
      pathsAndPages)

    OkXml(feedXml, "application/atom+xml")
  }


  /**
   * Lists e.g. all posts and ratings by a certain user, on a page.
   *
   * Initially, on page load, all (?) this info is already implicitly included
   * in the html sent by the server, e.g. the user's own posts are highlighted.
   * However, the user might logout and login, without refreshing the page,
   * so we need a way for the browser to fetch authorship info
   * dynamically.
   */
  // COULD rename to listUserPageData?
  def showPageInfo(pathIn: PagePath) = PageGetAction(pathIn) { pageReq =>
    if (!pageReq.request.rawQueryString.contains("&user=me"))
      throwBadReq("DwE0GdZ22", "Right now you need to specify ``&user=me''.")
    val yaml = buildPageInfoYaml(pageReq)
    Ok(yaml)
  }


  // COULD move to separate file? What file? DebikiYaml.scala?
  def buildPageInfoYaml(pageReq: PageRequest[_]): String = {
    import pageReq.{permsOnPage => perms}
    val page = pageReq.page_!
    val my = pageReq.user_!
    val reply = new StringBuilder

    // List permissions.
    reply ++=
       "\npermsOnPage:" ++=
       "\n accessPage: " ++= perms.accessPage.toString ++=
       "\n createPage: " ++= perms.createPage.toString ++=
       "\n moveRenamePage: " ++= perms.moveRenamePage.toString ++=
       "\n hidePageIdInUrl: " ++= perms.hidePageIdInUrl.toString ++=
       "\n editPageTemplate: " ++= perms.editPageTemplate.toString ++=
       "\n editPage: " ++= perms.editPage.toString ++=
       "\n editAnyReply: " ++= perms.editAnyReply.toString ++=
       "\n editUnauReply: " ++= perms.editUnauReply.toString ++=
       "\n deleteAnyReply: " ++= perms.deleteAnyReply.toString

    // List posts by this user, so they can be highlighted.
    reply ++= "\nauthorOf:"
    for (post <- page.postsByUser(withId = my.id)) {
      reply ++= "\n - " ++= post.id
    }

    // List the user's ratings so they can be highlighted so the user
    // won't rate the same post again and again and again each day.
    // COULD list only the very last rating per post (currently all old
    // overwritten ratings are included).
    reply ++= "\nratings:"
    for (rating <- page.ratingsByUser(withId = my.id)) {
      reply ++= "\n " ++= rating.postId ++= ": [" ++=
         rating.tags.mkString(",") ++= "]"
    }

    // (COULD include HTML for any notifications to the user.
    // Not really related to the current page only though.)
    // reply ++= "\nnotfs: ..."

    reply.toString
  }


  private val _adminPageFile = Play.getFile("/public/admin/index.html")


  def viewAdminPage() = CheckSidActionNoBody { (sidOk, xsrfOk, request) =>

    val tenantId = DebikiHttp.lookupTenantIdOrThrow(request, Debiki.SystemDao)

    val dao = Debiki.tenantDao(tenantId = tenantId,
      ip = request.remoteAddress, sidOk.roleId)

    val (identity, user) = Utils.loadIdentityAndUserOrThrow(sidOk, dao)

    if (user.map(_.isSuperAdmin) != Some(true))
      Ok(views.html.login(xsrfToken = xsrfOk.value,
        returnToUrl = request.uri, title = "Login", message = Some(
          "Login with an administrator account to access this page.")))
    else
      Ok.sendFile(_adminPageFile, inline = true)
  }

}
