/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package controllers

import com.debiki.v0._
import com.debiki.v0.Prelude._
import debiki._
import java.{util => ju}
import net.liftweb.common.{Box, Full, Empty, Failure}
import play.api._
import play.api.data._
import play.api.data.Forms._
import play.api.mvc.{Action => _, _}
import xml.{Node, NodeSeq}
import Actions._
import DebikiHttp._
import Prelude._
import Utils.ValidationImplicits._


object Application extends mvc.Controller {


  def showActionLinks(pathIn: PagePath, pageRoot: PageRoot, postId: String) =
    PageGetAction(pathIn) { pageReq =>
      val links = Utils.formHtml(pageReq, pageRoot).actLinks(postId)
      Ok(links) as HTML
    }


  def viewPost(pathIn: PagePath, postId: String) = PageGetAction(pathIn) {
        pageReq =>
    val pageHtml =
      Debiki.TemplateEngine.renderPage(pageReq, PageRoot.Real(postId))
    Ok(pageHtml).as(HTML)
  }


  def rawBody(pathIn: PagePath) = PageGetAction(pathIn) { pageReq =>
    val pageBody = pageReq.page_!.body_!
    val contentType = (pageReq.pagePath.suffix match {
      case "css" => CSS
      case _ => unimplemented
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
        = PagePostAction(MaxCommentSize)(pathIn) { pageReq =>

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
        = PagePostAction(MaxCommentSize)(pathIn) { pageReq =>

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


  def listPages(pathIn: PagePath) = PageGetAction(pathIn) { pageReq =>
    val pagePaths = Debiki.Dao.listPagePaths(
      withFolderPrefix = pageReq.pagePath.folder,
      tenantId = pageReq.tenantId,
      include = PageStatus.All,
      sortBy = PageSortOrder.ByPath,
      limit = Int.MaxValue,
      offset = 0)
    Ok(PageListHtml.renderPageList(pagePaths)) as HTML
  }


  def feed(pathIn: PagePath) = PageGetAction(pathIn) { pageReq =>
     import pageReq.{pagePath}

    // The tenant's name will be included in the feed.
    val tenant: Tenant = Debiki.Dao.loadTenants(List(pageReq.tenantId)).head

    val feedPagePaths =
      if (!pagePath.isFolderPath) List(pagePath)
      else Debiki.Dao.listPagePaths(
        withFolderPrefix = pagePath.folder,
        tenantId = pageReq.tenantId,
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
        val page: Option[Debate] =
          Debiki.Dao.loadPage(pagePath.tenantId, pageId)
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

    Ok(feedXml) as "application/atom+xml"
  }

}
