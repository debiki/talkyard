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
import debiki.EdHttp.throwForbidden
import debiki.EdHttp.throwForbiddenIf


/** Loads and saves settings for the whole website, a section of the website (e.g.
  * a forum or a blog) and individual pages.
  */
trait SettingsDao {
  self: SiteDao =>


  def getWholeSiteSettings(): EffectiveSettings = {
    memCache.lookup(
      siteSettingsKey,
      orCacheAndReturn = {
        readOnlyTransaction { transaction =>
          Some(loadWholeSiteSettings(transaction))
        }
      }) getOrDie "DwE52WK8"
  }


  def loadWholeSiteSettings(transaction: SiteTransaction): EffectiveSettings = {
    val editedSettings = transaction.loadSiteSettings()
    EffectiveSettings(editedSettings.toVector, AllSettings.makeDefault(globals))
  }


  def saveSiteSettings(settingsToSave: SettingsToSave, byWho: Who) {
    // COULD test here that settings are valid? No inconsistencies?

    throwForbiddenIf(settingsToSave.orgFullName.exists(_.isEmptyOrContainsBlank),
      "EdE5KP8R2", "Cannot clear the organization name")

    readWriteTransaction { tx =>
      val oldSettings = loadWholeSiteSettings(tx)

      throwForbiddenIf(oldSettings.enableForum && settingsToSave.enableForum.is(Some(false)),
        "TyE306KMW1Q", "Cannot disable forum features, once enabled")

      tx.upsertSiteSettings(settingsToSave)
      val newSettings = loadWholeSiteSettings(tx)
      newSettings.findAnyError foreach { error =>
        // This'll rollback the transaction.
        throwForbidden("EsE40GY28", s"Bad settings: $error")
      }

      lazy val identities = tx.loadIdentities(byWho.id)

      def turnsOff(getEnabled: EffectiveSettings => Boolean) =
        !getEnabled(newSettings) && getEnabled(oldSettings)

      def throwIfLogsInWith(loginMethodName: String) {
        if (identities.exists(_.loginMethodName.toLowerCase contains loginMethodName.toLowerCase))
          throwForbidden("TyE5UKDWSQ2", o"""Currently you cannot disable login with $loginMethodName
            — you use it yourself to login""")
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

      // If the language was changed, all cached page html in the database needs
      // to be rerendered, so button titles etc are shown in the new langage.
      SECURITY // DoS attack by evil admin: rerendering everything = expensive. SHOULD add rate limits.
      if (oldSettings.languageCode != newSettings.languageCode) {
        tx.bumpSiteVersion()
      }

      memCache.clearSingleSite(siteId)
    }
  }



  private def siteSettingsKey = MemCacheKey(siteId, "SiteSettingsKey")
  /* Later?
  private def pageTreeSettingsKey(rootId: PageId) = CacheKey(siteId, s"$rootId|PgTrStngsKey")
  private def singlePageSettingsKey(pageId: PageId) = CacheKey(siteId, s"$pageId|SnglPgStngsKey")
  */

}

