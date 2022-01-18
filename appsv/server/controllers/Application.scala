/**
 * Copyright (c) 2012-2013 Kaj Magnus Lindberg
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

import com.debiki.core.Prelude.unimplemented
import talkyard.server.{TyContext, TyController}
import javax.inject.Inject
import play.api.mvc._



class Application @Inject()(cc: ControllerComponents, edContext: TyContext)
  extends TyController(cc, edContext) {


  def mobileAppWebmanifest(): Action[Unit] = GetActionAllowAnyone { _ =>  // [sw]
    unimplemented("TyE7KAESW")
    // See:  https://github.com/discourse/discourse/blob/master/app/controllers/metadata_controller.rb
    // or display: browser ?
    // But:  Use `display: browser` in webmanifest for iOS devices
    //       https://meta.discourse.org/t/back-button-in-responsive-app/93909/5
    //       Otherwise, will be no Back button in iOS.
    //
    // Also compare with: (root)/images/web/ty-media/favicon/site.webmanifest.
    //
    Ok(s"""
      |{
      |  "name": "The Most Awesome Dragon Site",
      |  "short_name": "ððð",
      |  "display": "minimal-ui",
      |  "start_url": "/",
      |  "theme_color": "#673ab6",
      |  "background_color": "#111111",
      |  "orientation": "any",
      |  "icons": [
      |    {
      |      "src": "icon-192.png",
      |      "sizes": "192x192",
      |      "type": "image/png"
      |    }
      |  ]
      |}
    """.stripMargin) as "application/manifest+json"  // TODO cache 1 day only, for now?
    // needs to be that content type, see:
    // https://github.com/discourse/discourse/commit/8fc08aad09d0db9bc176a9f2376f05b3c9cebc6b#diff-d73ec52fd8b68ed588bf337398eee53d
    // cache max 1 day? later, maybe half a week?
    //   "max-age=86400, s-maxage=86400, public"
  }

}
