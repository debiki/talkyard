/**
 * Copyright (C) 2013 Kaj Magnus Lindberg (born 1979)
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

package controllers

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.EdHttp._
import talkyard.server.{TyContext, TyController}
import talkyard.server.api
import talkyard.server.http._
import talkyard.server.security.WhatApiSecret.ServerSecretFor
import javax.inject.Inject
import org.owasp.encoder.Encode
import play.api.libs.json._
import play.api.mvc.{Action, ControllerComponents, Result => p_Result}
import scala.util.Try


/** Creates new empty sites, for forums, blogs or embedded comments.
  */
class CreateSiteController @Inject()(cc: ControllerComponents, edContext: TyContext)
  extends TyController(cc, edContext) {

  import context.security._
  import context.globals

  // Let people use hostnames that start with 'test-' — good to know which sites are
  // in fact just people's test sites.
  // But reserve 'test--' (see if statement further below [7UKPwF2]) and these prefixes:
  private val TestSitePrefixes =
    Seq("smoke-test-", "smoketest-", "delete-", "e2e-", "comments-for-e2e-")

  // Don't allow names like x2345.example.com — x2345 is shorter than 6 chars (x23456 is ok though).
  private val MinLocalHostnameLength = 6


  // 200 OK means "Yes, generate a cert", and also, GetAction might try to redirect
  // to a new location ofr this site — that is, return a 30X; that also means "Yes".
  // Anything else means "No don't".
  def intReq_hostnameShouldHaveCert: Action[U] = GetAction { req: GetRequest =>
    val site = req.dao.getSite()
    val shouldHaveCert = site.exists(_.status != SiteStatus.Purged)
    if (shouldHaveCert) Ok else NotFound
  }


  def showPage(isTest: String): Action[Unit] = GetAction { request: GetRequest =>
    val isTestBool = Try(isTest.toBoolean).toOption getOrElse throwBadArgument("EsE5JUM2", "isTest")
    throwIfMayNotCreateSite(request, isTestBool)

    if (!hasOkForbiddenPassword(request)) {
      val numSites = globals.systemDao.countSites(isTestBool, request.theBrowserIdData)
      val conf = globals.config.createSite

      val (maxPerPerson, maxTotal, test) =
        if (isTestBool) (conf.maxTestSitesPerPerson, conf.maxTestSitesTotal, "test")
        else (conf.maxSitesPerPerson, conf.maxSitesTotal, "")

      if (numSites.byYou >= maxPerPerson)
        throwForbidden("EsE7KU20W", s"You have created too many $test forums already, sorry.")

      if (numSites.total >= maxTotal) {
        globals.config.createSite.tooManyTryLaterPagePath match {
          case None =>
            throwForbidden("EsE8VK2F4", s"People have created too many $test forums already, sorry.")
          case Some(path) =>
            throwTemporaryRedirect(path)
        }
      }
    }

    CSP_MISSING
    Ok(views.html.createsite.createSitePage(isTestBool, SiteTpi(request)).body) as HTML
  }


  def apiV0_createSite: Action[JsValue] = ApiSecretPostJsonAction(
        ServerSecretFor("createsite"), RateLimits.CreateSite, maxBytes = 500) { req =>
    createSiteImpl(req, isPubApi = true)
  }


  def createSite: Action[JsValue] = PostJsonAction(RateLimits.CreateSite, maxBytes = 500) {
        request =>
    createSiteImpl(request, isPubApi = false)
  }


  private def createSiteImpl(request: JsonPostRequest, isPubApi: Bo): p_Result = {
    import JsonUtils.{parseBo, parseOptBo, parseOptSt, parseSt, asJsObject}

    val isTestSiteOkayToDelete = parseOptBo(request.body, "testSiteOkDelete") is true
    throwIfMayNotCreateSite(request, isTestSiteOkayToDelete)

    // In case we're running end-to-end tests:
    globals.testResetTime()

    // Note! These fields are part of Ty's public API. Don't change!
    val body: JsObject = asJsObject(request.body, "The request body")
    val acceptTermsAndPrivacy = parseBo(body, "acceptTermsAndPrivacy")
    val anyLocalHostname = parseOptSt(body, "localHostname").trimNoneIfBlank
    val anyEmbeddingSiteAddress = parseOptSt(body, "embeddingSiteAddress").trimNoneIfBlank
    val organizationName = parseSt(body, "organizationName").trim
    val makePublic = parseOptBo(body, "makePublic")
    val okForbiddenPassword = hasOkForbiddenPassword(request)
    val okE2ePassword = hasOkE2eTestPassword(request.request)

    // Let's [remove_not_allowed_feature_flags], rather than replying Error. Otherwise,
    // a typo in create-site external code, could totally prevent creation of new sites.
    // (Allowing any feature flags, might let hackers configure [sites they create]
    // in funny ways.)
    val anyFeatureFlagsMaybeBad: Opt[St] = parseOptSt(body, "featureFlags")
    val featureFlagsOk: St =
          anyFeatureFlagsMaybeBad.map(api.FeatureFlags.removeBadNewSiteFlags) getOrElse ""

    val (
        ownerUsername,
        ownerFullName,
        ownerEmailAddr,
        ownerEmailAddrVerified,
        newSiteTitle,
        createForum,
        createEmbComs) =
          if (!isPubApi) (None, None, None, false, None, false, false)
          else (
            // Ty's public API, don't change!
            JsonUtils.parseOptSt(body, "ownerUsername").trimNoneIfBlank,
            JsonUtils.parseOptSt(body, "ownerFullName").trimNoneIfBlank,
            JsonUtils.parseOptSt(body, "ownerEmailAddr").trimNoneIfBlank,
            JsonUtils.parseOptBo(body, "ownerEmailAddrVerified") getOrElse false,
            JsonUtils.parseOptSt(body, "newSiteTitle").trimNoneIfBlank,
            JsonUtils.parseOptBo(body, "createForum") getOrElse false,
            JsonUtils.parseOptBo(body, "createEmbeddedComments") getOrElse false)

    if (createForum || createEmbComs) {
      throwForbiddenIf(createForum && createEmbComs, "TyE4MWE20R",
            "Don't specify both createForum and createEmbeddedComments")

      throwForbiddenIf(ownerUsername.isEmpty || ownerEmailAddr.isEmpty,
            "TyE4MWE207", o"""Please specify the new site owner's username and email
              (fields 'ownerUsername' and 'ownerEmailAddr'),
              since createForum or createEmbeddedComments is specified""")
    }
    else {
      throwForbiddenIf(newSiteTitle.isDefined,
            "TyE3MWE202", o"""Don't specify new site title, without setting one of
              'createForum' or 'createEmbeddedComments' to true""")

      throwForbiddenIf(ownerUsername.isDefined,
            "TyE8ME24SRM", """Creating an owner account, but no forum or emb comments, has not
              been tested, isn't allowed. But you can set 'createForum: true', that'll work""")
    }

    throwForbiddenIf(ownerUsername.isEmpty && (
              ownerEmailAddr.isDefined || ownerFullName.isDefined),
          "TyE6MRW4MJ6", o"""Specify owner username too (field 'ownerUsername'),
             not just owner email addr or full name""")

    throwForbiddenIf(ownerEmailAddrVerified && ownerEmailAddr.isEmpty,
          "TyE6MRW4MJ7", o"""Owner email address missing (field 'ownerEmailAddr'),
            but 'ownerEmailAddrVerified' is true""")

    val localHostname = anyLocalHostname getOrElse {
      val embAddr = anyEmbeddingSiteAddress getOrElse {
        throwForbidden("EdE2FGHS0", "No local hostname and no embedding address")
      }
      val hostnameWithDashes = Utils.makeLocalHostnameFromEmbeddingAdr(embAddr)
      Hostname.EmbeddedCommentsHostnamePrefix + hostnameWithDashes
    }

    if (!acceptTermsAndPrivacy)
      throwForbidden("DwE877FW2", "You need to accept the terms of use and privacy policy")

    Site.findNameProblem(localHostname) foreach { problem =>
      throwForbidden("TyE5YU70", s"Bad site name: '$localHostname', problem: $problem")
    }

    if (localHostname.length < MinLocalHostnameLength && !okForbiddenPassword)
      // This "cannot" happen — JS makes this impossible. So need not be a user friendly message.
      throwForbidden("DwE2JYK8", "The local hostname should be at least six chars")

    if (talkyard.server.security.ReservedNames.isSubdomainReserved(localHostname))
      throwForbidden("TyE5KWW02", s"Subdomain is reserved: '$localHostname'; choose another please")

    // Test sites have a certain prefix, so I know it's okay to delete them. [7UKPwF2]
    if (TestSitePrefixes.exists(localHostname.startsWith) && !isTestSiteOkayToDelete)
      throwForbidden("DwE48WK3", o"""Please choose another hostname; it must not
          start with any of: ${ TestSitePrefixes.mkString(", ") }""")
    if (localHostname.contains("--") && !isTestSiteOkayToDelete)
      throwForbidden("DwE5JKP3", "Please choose another hostname; it must not contain: --")

    if (organizationName.isEmpty)
      throwForbidden("DwE4KEWW5", "No organization name specified")
    if (organizationName.length > 100)
      throwForbidden("DwE7KEP36", "Too long organization name: more than 100 characters")

    val hostname = s"$localHostname.${globals.baseDomainNoPort}"
    val newSiteOrigin = globals.originOf(hostname)

    throwForbiddenIf(isTestSiteOkayToDelete && !Hostname.isE2eTestHostname(localHostname),
      "TyE502TKUTDY2", o"""Not a test site hostname: '$localHostname',
        should start with: ${Hostname.E2eTestPrefix}""")

    if (isTestSiteOkayToDelete && Hostname.isE2eTestHostname(hostname)) {
      globals.systemDao.deleteSitesWithNameOrHostnames(
          siteName = localHostname, hostnames = Set(hostname))
    }

    val (goToUrl: St, newSite: SiteInclDetails) =
      try {
        COULD_OPTIMIZE // maybe can skip lock?
        var staleStuff: talkyard.server.dao.StaleStuff = null
        var newSiteDao: debiki.dao.SiteDao = null
        val newSite: SiteInclDetails = globals.systemDao.writeTxLockAllSites { sysTx =>
          val newSite = globals.systemDao.createAdditionalSite(
            anySiteId = None,
            pubId = Site.newPubId(),
            name = localHostname,
            SiteStatus.NoAdmin,
            featureFlags = featureFlagsOk,
            hostname = Some(hostname),
            embeddingSiteUrl = anyEmbeddingSiteAddress,
            creatorId = request.user.map(_.id) getOrElse UnknownUserId,
            browserIdData = request.theBrowserIdData,
            organizationName = organizationName,
            makePublic = makePublic,
            isTestSiteOkayToDelete = isTestSiteOkayToDelete,
            skipMaxSitesCheck = okE2ePassword || okForbiddenPassword,
            createdFromSiteId = Some(request.siteId),
            anySysTx = Some(sysTx))

          newSiteDao = request.dao.copyWithNewSiteId(newSite.id)

          staleStuff = new talkyard.server.dao.StaleStuff()
          val newSiteTx = sysTx.siteTransaction(newSite.id)

          ownerEmailAddr map { ownerEmail =>
            val ownerUserData = NewPasswordUserData.create(
                  name = ownerFullName,
                  username = ownerUsername.getOrDie("TyE70MWQNT24"),
                  email = ownerEmail,
                  emailVerifiedAt = if (ownerEmailAddrVerified) Some(newSiteTx.now) else None,
                  password = None,  // must set oneself
                  createdAt = newSiteTx.now,
                  isAdmin = true,
                  isOwner = true).get
            newSiteDao.createPasswordUserImpl(ownerUserData, request.theBrowserIdData,
                  newSiteTx).briefUser
          }

          val title = newSiteTitle getOrElse "Your Site"
          val newSiteWho = Who(TrueId(SystemUserId), request.theBrowserIdData)
          if (createForum) {
            val options = debiki.dao.CreateForumOptions(
                  isForEmbeddedComments = false,
                  title = title,
                  folder = "/",
                  // For now, let's always create these default categories.  [NODEFCATS]
                  useCategories = true,
                  createSupportCategory = true,
                  createIdeasCategory = true,
                  createSampleTopics = true,
                  topicListStyle = com.debiki.core.TopicListLayout.ExcerptBelowTitle)
            newSiteDao.createForum2(options, newSiteWho, Some((newSiteTx, staleStuff)))
          }

          if (createEmbComs) {
            newSiteDao.createForum(title = title, folder = "/", isForEmbCmts = true, newSiteWho,
                  Some((newSiteTx, staleStuff)))
          }

          staleStuff.clearStaleStuffInDatabase(newSiteTx)
          // Also see: [cache_race_counter] but maybe not important here, since the
          // site is completely new, no one can interact with it yet.

          sysTx.loadSiteInclDetailsById(newSite.id) getOrDie "TyE2MSEJG0673"
        }

        staleStuff.clearStaleStuffInMemory(newSiteDao)

        if (!isTestSiteOkayToDelete) {
          val now = globals.now()
          globals.config.superAdmin.emailAddresses foreach { superAdminEmailAddress =>
            val email = Email.newWithId(
              Email.generateRandomId(),
              EmailType.SiteCreatedSuperAdminNotf,
              createdAt = now,
              sendTo = superAdminEmailAddress,
              toUserId = None,
              subject = s"[Talkyard] New site created",
              bodyHtmlText = i"""
                |newSiteOrigin: ${ Encode.forHtmlContent(newSiteOrigin) }<br>
                |embeddingUrl: ${ anyEmbeddingSiteAddress map Encode.forHtmlContent }<br>
                |organizationName: ${ Encode.forHtmlContent(organizationName) }<br>
                |createdAt: ${ toIso8601T(now.toJavaDate) }<br>
                |""")
            globals.sendEmail(email, request.siteId)
          }
        }

        (newSiteOrigin, newSite)
      }
      catch {
        case DbDao.SiteAlreadyExistsException(site, details) =>
          // Sometimes people in some way submit the create site dialog twice,
          // e.g. for their own blog. So it's good to include a link
          // (here in plain text) to any already existing site — then they can
          // go there and login.
          val isEmbCmts = anyEmbeddingSiteAddress.isDefined
          throwForbidden("TyE4ZKTP02",    // INFO_LOG
              "There is already a Talkyard site with that address.\n" +
              "\n" +
              (isEmbCmts ? (
                    "Is it for your blog? Go there and log in:\n" +
                    "\n" +
                    s"    $newSiteOrigin\n" +
                    "\n" +
                    "\n" +
                    "\nOr try ") | "Try ") +
              "again, but with a different site address?\n" +
              (!isEmbCmts ? (
                    "\n" +
                    "\n" +
                    s"Or go to that site and log in:\n" +
                    s"\n" +
                    s"  $newSiteOrigin   (if you created it)\n") | "") +
              s"\n\n\n" +
              s"Details: $details")
        case _: DbDao.TooManySitesCreatedByYouException =>
          throwForbidden("DwE7IJ08", "You have created too many sites already, sorry.")
        case DbDao.TooManySitesCreatedInTotalException =>
          globals.config.createSite.tooManyTryLaterPagePath match {
            case None =>
              throwForbidden("EsE3YK5U8", "People have created too many forums already, sorry.")
            case Some(path) =>
              path
          }
      }

    if (isPubApi) {
      dieIf(goToUrl != newSiteOrigin, "TyE6B03MRE7")
      OkSafeJson(Json.obj("newSite" -> Json.obj(
        "id" -> newSite.id,
        "origin" -> goToUrl,
        )))
    }
    else {
      OkSafeJson(Json.obj("nextUrl" -> goToUrl))
    }
  }


  def deleteTestSite: Action[JsValue] = PostJsonAction(RateLimits.CreateSite, maxBytes = 500) {
        request =>
    val localHostname = (request.body \ "localHostname").as[String]
    throwForbiddenUnless(Hostname.isE2eTestHostname(localHostname), "EdE7UKFW2", "Not a test site")
    request.systemDao.writeTxLockAllSites { tx =>
      tx.deleteAnyHostname(localHostname)
    }
    request.systemDao.forgetHostname(localHostname)
    Ok
  }


  private def throwIfMayNotCreateSite(request: DebikiRequest[_], isTest: Boolean): Unit = {
    import talkyard.server.Whatever
    if (isTest && (
        globals.anyCreateTestSiteHostname.contains(Whatever) ||
        globals.anyCreateTestSiteHostname.contains(request.hostname))) {
      // We're creating a test site with a test address, fine.
      return
    }
    globals.anyCreateSiteHostname match {
      case None =>
        throwForbidden("DwE4KEGG0", s"This server is not configured to allow creation of new sites: config value '${Globals.CreateSiteHostnameConfValName}' missing")
      case Some(createSiteHostname) =>
        if (createSiteHostname != Whatever && createSiteHostname != request.hostname)
          throwForbidden("DwE093AQ2", "You cannot create new sites from this address")
    }
  }

}
