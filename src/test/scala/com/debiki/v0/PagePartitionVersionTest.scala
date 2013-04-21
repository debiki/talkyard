/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package com.debiki.v0

import org.specs2.mutable._
import Prelude._
import java.{util => ju}


class PagePartitionVersionTest extends Specification with PageTestValues {

  "Page.splitByVersion" can {

    "partition an empty page" >> {
      EmptyPage.asOf(new ju.Date(12345)) must_== EmptyPage
    }

    "partition by date, sort everything before late date" >> {
      val page = PageWithEditManuallyAppliedAndExplApproved
      val pageSplit = page.asOf(datiAfterLastAction)
      pageSplit must_== page
    }

    "partition by date, sort everything after early date" >> {
      val page = PageWithEditManuallyAppliedAndExplApproved
      val pageSplit = page.asOf(datiBeforeFirstAction)
      pageSplit must_== EmptyPage
    }

    "partition by approval, everything approved" >> {
      val page = PageWithEditManuallyAppliedAndExplApproved
      val pageSplit = page.asOf(new ju.Date(Int.MaxValue))
      pageSplit must_== page
    }

    "Add flag & rating to EmptyPage, rename to ExamplePage" >> {
    }
  }

}


// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list
