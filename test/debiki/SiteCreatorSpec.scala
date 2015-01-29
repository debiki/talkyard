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

package debiki

import com.debiki.core._
import org.specs2.mutable._


class SiteCreatorSpec extends Specification {


  "SiteCreator.isOkayWebsiteName" can {

    import controllers.CreateSiteController.isOkayWebsiteName

    "allow: 'nicename', 'nice-name' and 'very-nice-name'" >> {
      isOkayWebsiteName("nicename") must beTrue
      isOkayWebsiteName("nice-name") must beTrue
      isOkayWebsiteName("very-nice-name") must beTrue
    }

    "reject uppercase names" >> {
      isOkayWebsiteName("Names-In-Uppercase") must beFalse
    }

    "reject too short and too long names" >> {
      isOkayWebsiteName("bad") must beFalse
      isOkayWebsiteName("a2345") must beFalse
      isOkayWebsiteName("a23456") must beTrue
      isOkayWebsiteName(
        "a123456789-123456789-123456789-123456789-123456789") must beFalse
      isOkayWebsiteName(
        "a123456789-123456789") must beTrue
    }

    "reject dots, leading & trailing dash, leading diget" >> {
      isOkayWebsiteName("a2345678") must beTrue
      isOkayWebsiteName("12345678") must beFalse
      isOkayWebsiteName("bad.name") must beFalse
      isOkayWebsiteName("-bad-name") must beFalse
      isOkayWebsiteName("bad-name-") must beFalse
      // Currently allowed, hmm:
      //isOkayWebsiteName("bad--name") must beFalse
    }
  }

}

