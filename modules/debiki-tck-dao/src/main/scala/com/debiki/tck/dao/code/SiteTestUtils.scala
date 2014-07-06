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

import com.debiki.core._
import com.debiki.core.{PostActionPayload => PAP}
import com.debiki.core.Prelude._
import java.{util => ju}


class SiteTestUtils(site: Tenant, val daoFactory: DbDaoFactory) {

  val dao = daoFactory.newSiteDbDao(QuotaConsumers(tenantId = site.id))

  val defaultPagePath = PagePath(site.id, "/", None, showId = true, pageSlug = "slug")
  val defaultPassword = "ThePassword"

  def defaultBody(loginGrant: LoginGrant, text: String) = RawPostAction.forNewPageBody(
    text = text,
    creationDati = new ju.Date,
    userIdData = loginGrant.testUserIdData,
    pageRole = PageRole.Generic,
    approval = Some(Approval.WellBehavedUser))


  def defaultComment(loginGrant: LoginGrant, text: String = "Comment text") =
    RawPostAction.forNewPost(
      id = PageParts.UnassignedId, creationDati = new ju.Date,
      userIdData = loginGrant.testUserIdData,
      parentPostId = Some(PageParts.BodyId),
      text = text, markup = "para", approval = None)


  val DefaultPasswordUserName = "PasswordUser"

  def createPasswordRole(): (PasswordIdentity, User) = {
    val email = "pswd-test@ex.com"
    val hash = DbDao.saltAndHashPassword(defaultPassword)
    val identityNoId = PasswordIdentity(
      id = "?", userId = "?", email = email, passwordSaltHash = hash)
    val userNoId = User(
      id = "?", displayName = DefaultPasswordUserName, email = email,
      emailNotfPrefs = EmailNotfPrefs.Receive)
    dao.createPasswordIdentityAndRole(identityNoId, userNoId)
  }


  val defaultGuestLoginAttempt = GuestLoginAttempt(
    ip = "1.1.1.1", date = new ju.Date, prevLoginId = None,
    name = "GuestName", email = "guest-email@ex.com", location = "", website = "")


  def loginAsGuest(name: String) = {
    dao.saveLogin(defaultGuestLoginAttempt.copy(name = name))
  }


  def login(identity: Identity): LoginGrant = {
    identity match {
      case passwordIdentity: PasswordIdentity =>
        dao.saveLogin(PasswordLoginAttempt(
          ip = "11.12.13.14", date = new ju.Date(), prevLoginId = None,
          email = passwordIdentity.email, password = defaultPassword))
      case _ =>
        ???
    }
  }


  def createPageAndBody(loginGrant: LoginGrant, pageRole: PageRole, text: String): Page = {
    val pagePartsNoId = PageParts(guid = "?", rawActions = defaultBody(loginGrant, text)::Nil)
    val page = dao.createPage(Page.newPage(
      pageRole, defaultPagePath, pagePartsNoId, publishDirectly = true,
      author = loginGrant.user))
    page
  }


  def addComment(loginGrant: LoginGrant, page: PageNoPath, text: String): (PageNoPath, Post) = {
    val postNoId = defaultComment(loginGrant, text)
    val (pageAfter, rawPost::Nil) = dao.savePageActions(page, postNoId::Nil)
    val post = pageAfter.parts.getPost(rawPost.id) getOrElse assErr("Dw7FK91R", "New post missing")
    (pageAfter, post)
  }


  def review(loginGrant: LoginGrant, page: PageNoPath, postId: PostId,
        approval: Approval): PageNoPath = {
    val reviewNoId = RawPostAction.toApprovePost(
      id = PageParts.UnassignedId, postId = postId, userIdData = loginGrant.testUserIdData,
      ctime = new ju.Date(), approval = approval)
    val (updatedPage, review) = dao.savePageActions(page + loginGrant.user, reviewNoId::Nil)
    updatedPage
  }


  def vote(loginGrant: LoginGrant, pageNoVote: PageNoPath, postId: PostId, voteType: PAP.Vote)
        : (PageNoPath, RawPostAction[PAP.Vote]) = {
    val voteNoId = RawPostAction(
      id = PageParts.UnassignedId,
      postId = postId,
      creationDati = new ju.Date(),
      userIdData = loginGrant.testUserIdData,
      payload = voteType)
    val (pageWithVote, List(vote)) = dao.savePageActions(pageNoVote, voteNoId::Nil)
    (pageWithVote, vote.asInstanceOf[RawPostAction[PAP.Vote]])
  }
}

