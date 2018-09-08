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

package controllers

import debiki._
import ed.server.{EdContext, EdController}
import javax.inject.Inject
import play.api.mvc.ControllerComponents



/** Handles per website terms-of-use and privacy-policy pages.
  */
class LegalController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {


  /** Is visible to anyone, so people can agree to the terms, before they finish creation
    * of their accounts, also if things in the forum are only accessible to members. [7WKBAY02]
    */
  def viewTermsOfUsePage() = GetActionAllowAnyone { request =>
    /* Later:
    apiReq.siteSettings.termsOfUseUrl match {
      case None =>
        // Use default terms-of-use page.
        Ok(views.html.legal.termsOfUse)
      case Some(url) =>
        // This website has its own custom terms-of-use page, use it instead.
        Redirect(url)
    }
     */

    // For now: (use hardcoded ToU page, no custimization)
    Ok(views.html.legal.termsOfUse(SiteTpi(request)).body) as HTML
  }


  /** Should be visible to anyone, so can read before joining. [7WKBAY02]
    */
  def viewPrivacyPolicyPage() = GetActionAllowAnyone { request =>
    // Later: allow overriding privacy policy, see comments in viewTermsOfUsePage() above.
    // For now:
    Ok(views.html.legal.privacyPolicy(SiteTpi(request)).body) as HTML
  }

}
