/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package controllers

import org.specs2.mutable._
import com.debiki.v0._


class AppCreateWebsiteSpec extends Specification {


  "AppCreateWebsite.isOkayWebsiteName" can {

    import AppCreateWebsite.isOkayWebsiteName

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

