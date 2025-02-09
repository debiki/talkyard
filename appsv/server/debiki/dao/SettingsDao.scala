/**
 * Copyright (c) 2014-2016 Kaj Magnus Lindberg
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

package debiki.dao

import scala.collection.Seq
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.EdHttp.throwBadRequest
import debiki.EdHttp.throwBadRequestIf
import play.api.libs.json.JsObject
import scala.collection.{immutable => imm}


/** Loads and saves settings for the whole website, a section of the website (e.g.
  * a forum or a blog) and individual pages.
  */
trait SettingsDao {
  self: SiteDao =>


  def getWholeSiteSettings(tx: Option[SiteTransaction] = None): EffectiveSettings = {
    memCache.lookup(
      siteSettingsKey,
      orCacheAndReturn = {
        readOnlyTransactionTryReuse(tx) { transaction =>
          Some(loadWholeSiteSettings(transaction))
        }
      }) getOrDie "DwE52WK8"
  }


  def loadWholeSiteSettings(transaction: SiteTransaction): EffectiveSettings = {
    SettingsDao.loadWholeSiteSettings(transaction, globals)
  }


  def saveSiteSettings(settingsToSave: SettingsToSave, byWho: Who): U = {
    // COULD test here that settings are valid? No inconsistencies?

    throwBadRequestIf(settingsToSave.orgFullName.exists(_.isEmptyOrContainsBlank),
      "EdE5KP8R2", "Cannot clear the organization name")

    // There're 50 kb db constraints, but 50 is a bit much? Let's say 30.
    // One community has two detailed 10 kb SVG logos — one for wide, one
    // for mobile — so they need 20 kb  (or to move logos to separate files).
    val k = 1000
    val defMaxLength = 30 * k

    def checkLen(name: St, getter: SettingsToSave => Opt[Opt[St]], max: i32 = -1): Unit = {
      val anyOptValue = getter(settingsToSave)
      val maxLen = if (max > 0) max else defMaxLength
      throwBadRequestIf(anyOptValue.exists(_.exists(_.length > maxLen)),
            "TyE406RKTP245", s"Too long: $name")
    }

    def checkJsonLen(name: St, getter: SettingsToSave => Opt[Opt[JsObject]],
          max: i32 = defMaxLength): Unit = {
      val anyOptVal = getter(settingsToSave)
      throwBadRequestIf(anyOptVal.exists(_.exists(_.toString.length > max)),
            "TyE50MRTQJ2", s"Too long: $name")
    }

    // Database: settings_c_featureflags_len: 1 — 10k.
    checkLen("featureFlags", _.featureFlags, max = 9 * k)

    // Db: 1 — 50k,settings_c_headstyleshtml_len and settings_c_headscriptshtml_len.
    // But 50k a bit much for this? 20k enough?
    checkLen("headStylesHtml", _.headStylesHtml, max = 20 * k)
    checkLen("headScriptsHtml", _.headScriptsHtml, max = 20 * k)

    // These are 1 — 50k in the database:
    checkLen("startOfBodyHtml)", _.startOfBodyHtml) // settings_c_startofbodyhtml_len
    checkLen("endOfBodyHtml)", _.endOfBodyHtml)     // settings_c_endofbodyhtml_len
    checkLen("logoUrlOrHtml", _.logoUrlOrHtml)      // settings_c_logourlorhtml_len
    checkLen("headerHtml", _.headerHtml)            // settings_c_headerhtml_len
    checkLen("footerHtml", _.footerHtml)            // settings_c_footerhtml_len
    checkLen("socialLinksHtml", _.socialLinksHtml)  // settings_c_sociallinkshtml_len
    checkJsonLen("navConf", _.navConf)              // settings_c_navconf_len

    // This one is <= 8k (authn_diag_conf_c is jsonb_ste8000_d). Let's subtract 500 so
    // errors will happen in the app server not the database (then, better error messages).
    // But for now: Let's say 750 at most, to save bandwidth.  [authn_diag_bandw]
    // Typically an intro text isn't more than about 100 chars. But image urls can
    // be a bit long, say 200 chars. Anyway, 500 should be enough, let's say 750.
    checkJsonLen("authnDiagConf", _.authnDiagConf, max = 750) // 8000 - 500)

    readWriteTransaction { tx =>
      val oldSettings = loadWholeSiteSettings(tx)

      throwBadRequestIf(oldSettings.enableForum && settingsToSave.enableForum.is(Some(false)),
        "TyE306KMW1Q", "Cannot disable forum features, once enabled")

      tx.upsertSiteSettings(settingsToSave)
      val newSettings = loadWholeSiteSettings(tx)
      newSettings.findAnyErrors foreach { errors: imm.Seq[St] =>
        // This'll rollback the transaction.
        throwBadRequest("TyESETNGS", s"Bad settings, problems:\n - ${errors.mkString("\n - ")}")
      }

      lazy val admins = tx.loadAdmins()
      lazy val adminsAndIdentities: Seq[(User, Seq[Identity])] =
        admins.map(admin => admin -> tx.loadIdentities(admin.id))

      def turnsOff(getEnabled: EffectiveSettings => Bo): Bo =
        !getEnabled(newSettings) && getEnabled(oldSettings)

      def turnsOn(getEnabled: EffectiveSettings => Bo): Bo =
        getEnabled(newSettings) && !getEnabled(oldSettings)

      // Prevent admins from accidentally locking themselves or other admins out.
      def throwIfLogsInWith(loginMethodName: St): U = {
        val loginMethodLowercase = loginMethodName.toLowerCase
        for {
          (admin, identities) <- adminsAndIdentities
          if admin.passwordHash.isEmpty
          // COULD check if there're other login methods this admin can use — that
          // is, if identities.length >= 2, and the other methods aren't disabled.
          if identities.exists(_.loginMethodName.toLowerCase contains loginMethodLowercase)
        } {
          val (whoUses, henHasNot) =
            if (admin.id == byWho.id) ("you use", "you haven't")
            else (s"admin ${admin.idSpaceName} uses", "s/he hasn't")
          throwBadRequest("TyEADM0LGI", o"""Currently you cannot disable login
             with $loginMethodName — $whoUses it to login,
             and $henHasNot configured password login""")
        }
      }

      //import com.mohiva.play.silhouette.impl.providers
      if (turnsOff(_.enableGoogleLogin)) throwIfLogsInWith("google") // providers.oauth2.GoogleProvider.ID)
      if (turnsOff(_.enableFacebookLogin)) throwIfLogsInWith("facebook") // providers.oauth2.FacebookProvider.ID)
      if (turnsOff(_.enableTwitterLogin)) throwIfLogsInWith("twitter") // providers.oauth1.TwitterProvider.ID)
      if (turnsOff(_.enableGitHubLogin)) throwIfLogsInWith("github") // providers.oauth2.GitHubProvider.ID)
      if (turnsOff(_.enableGitLabLogin)) throwIfLogsInWith("gitlab") // providers.oauth2.GitLabProvider.ID)
      if (turnsOff(_.enableLinkedInLogin)) throwIfLogsInWith("linkedin") // providers.oauth2.LinkedInProvider.ID)
      if (turnsOff(_.enableVkLogin)) throwIfLogsInWith("vk") // providers.oauth2.VKProvider.ID)
      if (turnsOff(_.enableInstagramLogin)) throwIfLogsInWith("instagram") // providers.oauth2.InstagramProvider.ID)

      // Don't restrict login to only custom OIDC, unless custom IDPs enabled:
      if (turnsOn(_.useOnlyCustomIdps)) {
        // Enabled?
        // There's a db constraint: settings_c_enable_use_only_custom_idps  [onl_cust_idp]
        throwBadRequestIf(!newSettings.enableCustomIdps,
              "TyE305MRSKD3", "Cannot use only custom IDPs, when custom IDPs not enabled")

        // Admin can login?
        // Check that the current admin can login via a currently enabled IDP,
        // so hen won't lock henself out.
        // Test: oidc-azure-login-required.2br.extidp  TyTE2E60RTE24.TyTOIDCSSO
        val (admin: User, adminsIdentities: Seq[Identity]) =
              adminsAndIdentities.find(_._1.id == byWho.id) getOrDie "TyE5MGRT4"
        dieIf(admin.id != byWho.id, "TyE36KRST743")
        val siteIdps = tx.loadAllSiteCustomIdentityProviders()
        val adminsEnabledIdentity = adminsIdentities find {
          case oau: OpenAuthIdentity =>
            oau.openAuthDetails.idpId match {
              case None =>
                // Then this is probably a server global IDP — not
                // a custom IDP for this site only.
                false
              case Some(adminsIdpId: IdpId) =>
                val anyIdp = siteIdps.find(_.idpId.is(adminsIdpId))
                // The admin uses this IDP — but is it enabled?
                anyIdp.exists(_.enabled)
            }
          case _ =>
            false
        }

        // If the admin hasn't logged in with any now enabled IDP, hen is
        // somewhat likely locking henself out.
        if (adminsEnabledIdentity.isEmpty) {
          throwBadRequest("TyEADM0LGI2_", o"""You cannot restrict login to
               only custom OIDC or OAuth2, before you have logged in yourself
               in that way, so you know it actually works.""")
        }
        else {
          // Still not impossible that the admin is locking henself out,
          // but less likely.
        }
      }

      tx.insertAuditLogEntry(AuditLogEntry(
        siteId = siteId,
        id = AuditLogEntry.UnassignedId,
        didWhat = AuditLogEntryType.SaveSiteSettings,
        doerTrueId = byWho.trueId,
        doneAt = tx.now.toJavaDate,
        browserIdData = byWho.browserIdData))

      // Some settings require clearing all caches (for this site).
      // We do that, by bumping the site version — this invalidates all cached stuff
      // for this site.
      var bumpSiteVersion = false

      // If the language was changed, all cached page html in the database needs
      // to be rerendered, so button titles etc are shown in the new langage.
      SECURITY // DoS attack by evil admin: rerendering everything = expensive. SHOULD add rate limits.
      bumpSiteVersion ||= oldSettings.languageCode != newSettings.languageCode

      // If custom nav conf html got changed, we need to re-render all pages, since
      // such html is included in server side rendered & cached html.
      //
      // However, if  oldSettings.headerHtml  and other custom html fields got changed,
      // or custom CSS, then, need not re-render — that html and CSS isn't cached,
      // isn't included in the page_html_cache_t.  [cust_html_not_db_cached]
      //
      bumpSiteVersion ||= oldSettings.navConf != newSettings.navConf


      if (bumpSiteVersion) {
        tx.bumpSiteVersion()
      }

      memCache.clearThisSite()
    }
  }



  private def siteSettingsKey = MemCacheKey(siteId, "SiteSettingsKey")
  /* Later?
  private def pageTreeSettingsKey(rootId: PageId) = CacheKey(siteId, s"$rootId|PgTrStngsKey")
  private def singlePageSettingsKey(pageId: PageId) = CacheKey(siteId, s"$pageId|SnglPgStngsKey")
  */

}

object SettingsDao {

  def loadWholeSiteSettings(tx: SiteTransaction, globals: Globals): EffectiveSettings = {
    val editedSettings = tx.loadSiteSettings()
    EffectiveSettings(editedSettings.toVector, AllSettings.makeDefault(globals))
  }
}

