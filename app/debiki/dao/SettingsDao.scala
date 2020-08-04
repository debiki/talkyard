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

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.EdHttp.throwBadRequest
import debiki.EdHttp.throwBadRequestIf


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


  def saveSiteSettings(settingsToSave: SettingsToSave, byWho: Who): Unit = {
    // COULD test here that settings are valid? No inconsistencies?

    throwBadRequestIf(settingsToSave.orgFullName.exists(_.isEmptyOrContainsBlank),
      "EdE5KP8R2", "Cannot clear the organization name")

    // There're 20 kb db constraints.
    val maxHtmlLength = 19 * 1000

    def checkLen(name: String, getter: SettingsToSave => Option[Option[String]]) {
      val anyOptValue = getter(settingsToSave)
      throwBadRequestIf(anyOptValue.exists(_.exists(_.length > maxHtmlLength)),
            "TyE406RKTP245", s"Too long: $name")
    }

    checkLen("headStylesHtml", _.headStylesHtml)
    checkLen("headScriptsHtml", _.headScriptsHtml)
    checkLen("startOfBodyHtml)", _.startOfBodyHtml)
    checkLen("endOfBodyHtml)", _.endOfBodyHtml)
    checkLen("logoUrlOrHtml", _.logoUrlOrHtml)
    checkLen("headerHtml", _.headerHtml)
    checkLen("footerHtml", _.footerHtml)

    throwBadRequestIf(
          settingsToSave.navConf.exists(_.exists(_.toString().length > maxHtmlLength)),
          "TyE463KTSH56", "Too long nav conf")

    readWriteTransaction { tx =>
      val oldSettings = loadWholeSiteSettings(tx)

      throwBadRequestIf(oldSettings.enableForum && settingsToSave.enableForum.is(Some(false)),
        "TyE306KMW1Q", "Cannot disable forum features, once enabled")

      tx.upsertSiteSettings(settingsToSave)
      val newSettings = loadWholeSiteSettings(tx)
      newSettings.findAnyError foreach { error =>
        // This'll rollback the transaction.
        throwBadRequest("EsE40GY28", s"Bad settings: $error")
      }

      lazy val admins = tx.loadAdmins()
      lazy val adminsAndIdentities: Seq[(User, Seq[Identity])] =
        admins.map(admin => admin -> tx.loadIdentities(admin.id))

      def turnsOff(getEnabled: EffectiveSettings => Boolean) =
        !getEnabled(newSettings) && getEnabled(oldSettings)

      // Prevent admins from accidentally locking themselves or other admins out.
      def throwIfLogsInWith(loginMethodName: String): Unit = {
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

      import com.mohiva.play.silhouette.impl.providers
      if (turnsOff(_.enableGoogleLogin)) throwIfLogsInWith(providers.oauth2.GoogleProvider.ID)
      if (turnsOff(_.enableFacebookLogin)) throwIfLogsInWith(providers.oauth2.FacebookProvider.ID)
      if (turnsOff(_.enableTwitterLogin)) throwIfLogsInWith(providers.oauth1.TwitterProvider.ID)
      if (turnsOff(_.enableGitHubLogin)) throwIfLogsInWith(providers.oauth2.GitHubProvider.ID)
      if (turnsOff(_.enableGitLabLogin)) throwIfLogsInWith(providers.oauth2.GitLabProvider.ID)
      if (turnsOff(_.enableLinkedInLogin)) throwIfLogsInWith(providers.oauth2.LinkedInProvider.ID)
      if (turnsOff(_.enableVkLogin)) throwIfLogsInWith(providers.oauth2.VKProvider.ID)
      if (turnsOff(_.enableInstagramLogin)) throwIfLogsInWith(providers.oauth2.InstagramProvider.ID)

      tx.insertAuditLogEntry(AuditLogEntry(
        siteId = siteId,
        id = AuditLogEntry.UnassignedId,
        didWhat = AuditLogEntryType.SaveSiteSettings,
        doerId = byWho.id,
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
      // isn't included in the html_cache_t (page_html3).  [cust_html_not_db_cached]
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

