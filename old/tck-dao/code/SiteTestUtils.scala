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


package com.debiki.tck.dao.code

/*
import com.debiki.core._
import com.debiki.core.{PostActionPayload => PAP}
import com.debiki.core.Prelude._
import java.{util => ju}


class SiteTestUtils(site: Site, val daoFactory: DbDaoFactory) {

  val dao = daoFactory.newSiteDbDao(site.id)

  val defaultPagePath = PagePath(site.id, "/", None, showId = true, pageSlug = "slug")
  val defaultPassword = "ThePassword"

  def defaultBody(userIdData: UserIdData, text: String) = RawPostAction.forNewPageBody(
    text = text,
    creationDati = new ju.Date,
    userIdData = userIdData,
    pageRole = PageRole.WebPage,
    approval = Some(Approval.WellBehavedUser))


  def defaultComment(userIdData: UserIdData, text: String = "Comment text") =
    RawPostAction.forNewPost(
      id = PageParts.UnassignedId, creationDati = new ju.Date,
      userIdData = userIdData,
      parentPostId = Some(PageParts.BodyId),
      text = text, approval = None)


  val DefaultPasswordFullName = "PasswordUserFullName"
  val DefaultPasswordUsername = "PasswordUserUsername"
  val DefaultPasswordEmail = "pswd-test@ex.com"

  def createPasswordRole(nameEmailBase: String = null): User = {
    val (name, username, email) =
      if (nameEmailBase ne null) {
        (nameEmailBase + "-FullName", nameEmailBase + "Username", nameEmailBase + "@ex.com")
      }
      else {
        (DefaultPasswordFullName, DefaultPasswordUsername, DefaultPasswordEmail)
      }
    val user = dao.createPasswordUser(NewPasswordUserData.create(name = name,
      username = username, email = email, password = defaultPassword, isAdmin = false,
      isOwner = false).get)
    val verifiedAt = Some(new ju.Date)
    dao.configRole(user.id, emailVerifiedAt = Some(verifiedAt))
    user.copy(emailVerifiedAt = verifiedAt)
  }


  val defaultGuestLoginAttempt = GuestLoginAttempt(
    ip = "1.1.1.1", date = new ju.Date,
    name = "GuestName", email = "guest-email@ex.com", guestCookie = "", website = "")


  def loginAsGuest(name: String, ip: String = "0.0.0.1"): User = {
    dao.loginAsGuest(defaultGuestLoginAttempt.copy(name = name, ip = ip)).user
  }


  def login(user: User, ip: String = "0.0.1.0"): LoginGrant = {
    dao.tryLogin(PasswordLoginAttempt(
      ip = ip, date = new ju.Date(),
      email = user.email, password = defaultPassword))
  }


  def loginViaEmail(emailId: EmailId): LoginGrant  = {
    dao.tryLogin(
      EmailLoginAttempt(ip = "?.?.?.?", date = new ju.Date(), emailId = emailId))
  }


  def createPageAndBody(loginGrant: LoginGrant, pageRole: PageRole, text: String): Page =
    createPageAndBody(loginGrant.user, pageRole, text)


  def createPageAndBody(user: User, pageRole: PageRole, text: String): Page = {
    val pagePartsNoId = PageParts(
      guid = "?", rawActions = defaultBody(UserIdData.newTest(user.id), text)::Nil)
    val page = dao.createPage(Page.newPage(
      pageRole, defaultPagePath, pagePartsNoId, publishDirectly = true,
      author = user))
    page
  }


  def addComment(loginGrant: LoginGrant, page: PageNoPath, text: String): (PageNoPath, Post) =
    addComment(loginGrant.user, page, text: String)


  def addComment(user: User, page: PageNoPath, text: String): (PageNoPath, Post) = {
    val postNoId = defaultComment(UserIdData.newTest(user.id), text)
    val (pageAfter, rawPost::Nil) = dao.savePageActions(page, postNoId::Nil)
    val post = pageAfter.parts.getPost(rawPost.id) getOrElse assErr("Dw7FK91R", "New post missing")
    (pageAfter, post)
  }


  def review(loginGrant: LoginGrant, page: PageNoPath, postId: PostId, approval: Approval)
        : PageNoPath =
    review(loginGrant.user, page, postId, approval)


  def review(user: User, page: PageNoPath, postId: PostId,
        approval: Approval): PageNoPath = {
    val reviewNoId = RawPostAction.toApprovePost(
      id = PageParts.UnassignedId, postId = postId, userIdData = UserIdData.newTest(user.id),
      ctime = new ju.Date(), approval = approval)
    val (updatedPage, review) = dao.savePageActions(page + user, reviewNoId::Nil)
    updatedPage
  }


  def vote(loginGrant: LoginGrant, pageNoVote: PageNoPath, postId: PostId, voteType: PAP.Vote)
        : (PageNoPath, RawPostAction[PAP.Vote]) =
    vote(loginGrant.user, pageNoVote, postId, voteType)


  def vote(user: User, pageNoVote: PageNoPath, postId: PostId, voteType: PAP.Vote)
        : (PageNoPath, RawPostAction[PAP.Vote]) = {
    val voteNoId = RawPostAction(
      id = PageParts.UnassignedId,
      postId = postId,
      creationDati = new ju.Date(),
      userIdData = UserIdData.newTest(userId = user.id),
      payload = voteType)
    val (pageWithVote, List(vote)) = dao.savePageActions(pageNoVote, voteNoId::Nil)
    val voteWithId = voteNoId.copy(id = vote.id)
    assert(voteWithId == vote)
    (pageWithVote, vote.asInstanceOf[RawPostAction[PAP.Vote]])
  }
}
*/
