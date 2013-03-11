// vim: ts=2 sw=2 et
/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package com.debiki.v0

import org.specs2.mutable._
import Prelude._
import java.{util => ju}


class PagePartitionVersionTest extends Specification with PageTestValues {

  "Page.splitByVersion" can {

    "partition an empty page" >> {
      EmptyPage.splitByVersion(PageVersion.LatestApproved) must_==
        PageSplitByVersion(
          EmptyPage, EmptyPage, EmptyPage, PageVersion.LatestApproved)
    }

    "partition by date, sort everything before late date" >> {
      val laterVersion = PageVersion(datiAfterLastAction, approved = false)
      val page = PageWithEditManuallyAppliedAndExplApproved
      val pageSplit = page.splitByVersion(laterVersion)
      pageSplit.desired must_== page
      pageSplit.inclUnapproved must_== page
      pageSplit.inclTooRecent must_== page
    }

    "partition by date, sort everything after early date" >> {
      val earlyVersion = PageVersion(datiBeforeFirstAction, approved = false)
      val page = PageWithEditManuallyAppliedAndExplApproved
      val pageSplit = page.splitByVersion(earlyVersion)
      pageSplit.desired must_== EmptyPage
      pageSplit.inclUnapproved must_== EmptyPage
      pageSplit.inclTooRecent must_== page
    }

    "partition by approval, everything approved" >> {
      val page = PageWithEditManuallyAppliedAndExplApproved
      val pageSplit = page.splitByVersion(PageVersion.LatestApproved)
      pageSplit.desired must_== page
      pageSplit.inclUnapproved must_== page
      pageSplit.inclTooRecent must_== page
    }

    "partition by approval, nothing approved" >> {
      // Flags and ratings etc are currently always placed in the "before"
      // page returned by splitByVersion.
      val page =  PageWithEditManuallyAppliedNothingApproved
      val pageWithsPostAndEdits = EmptyPage.copy(
        actionDtos = page.actionDtos, // includes CollapsePost etc and Undo though
                                  // but thoes are not used in this test.(If I move more
                                  //  things to actionDtos, this test might break.)
        edits = page.edits,
        editApps = page.editApps)
      val pageWithFlagsEtc = page.copy(
        actionDtos = Nil,
        edits = Nil,
        editApps = Nil)
      val pageSplit = page.splitByVersion(PageVersion.LatestApproved)
      pageSplit.desired must_== pageWithFlagsEtc
      pageSplit.inclUnapproved must_== page
      pageSplit.inclTooRecent must_== page
    }

    "partition by approval, post approved but edit not approved" >> {
      val page =  PageWithEditManuallyAppliedNotApproved
      val pageWithoutEdits = page.copy(edits = Nil, editApps = Nil)
      val pageSplit = page.splitByVersion(PageVersion.LatestApproved)
      pageSplit.desired must_== pageWithoutEdits
      pageSplit.inclUnapproved must_== page
      pageSplit.inclTooRecent must_== page
    }

    "Add flag & rating to EmptyPage, rename to ExamplePage" >> {
    }
  }

}


