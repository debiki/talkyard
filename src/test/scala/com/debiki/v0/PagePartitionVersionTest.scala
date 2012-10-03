// vim: ts=2 sw=2 et
/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package com.debiki.v0

import org.specs._
import Prelude._
import java.{util => ju}


class PagePartitionVersionTest extends SpecificationWithJUnit
  with PageTestValues {

  "Page.partitionByVersion" can {

    "partition an empty page" >> {
      EmptyPage.partitionByVersion(PageVersion.LatestApproved) must_==
        (EmptyPage, EmptyPage)
    }

    "partition by date, sort everything before late date" >> {
      val laterVersion = PageVersion(datiAfterLastAction, approved = false)
      val page = PageWithEditManuallyAppliedAndExplApproved
      val (pageBefore, pageAfter) = page.partitionByVersion(laterVersion)
      pageBefore must_== page
      pageAfter must_== EmptyPage
    }

    "partition by date, sort everything after early date" >> {
      val earlyVersion = PageVersion(datiBeforeFirstAction, approved = false)
      val page = PageWithEditManuallyAppliedAndExplApproved
      val (pageBefore, pageAfter) = page.partitionByVersion(earlyVersion)
      pageBefore must_== EmptyPage
      pageAfter must_== page
    }

    "partition by approval, everything approved" >> {
      val page = PageWithEditManuallyAppliedAndExplApproved
      val (pageBefore, pageAfter) =
         page.partitionByVersion(PageVersion.LatestApproved)
      pageBefore must_== page
      pageAfter must_== EmptyPage
    }

    "partition by approval, nothing approved" >> {
      // Flags and ratings etc are currently always placed in the "before"
      // page returned by partitionByVersion.
      val page =  PageWithEditManuallyAppliedNothingApproved
      val pageWithsPostAndEdits = EmptyPage.copy(
        posts = page.posts,
        edits = page.edits,
        editApps = page.editApps)
      val pageWithFlagsEtc = page.copy(
        posts = Nil,
        edits = Nil,
        editApps = Nil)
      val (pageBefore, pageAfter) =
        page.partitionByVersion(PageVersion.LatestApproved)
      pageBefore must_== pageWithFlagsEtc
      pageAfter must_== pageWithsPostAndEdits
    }

    "partition by approval, post approved but edit not approved" >> {
      val page =  PageWithEditManuallyAppliedNotApproved
      val pageWithEditsOnly = EmptyPage.copy(
         edits = page.edits, editApps = page.editApps)
      val pageWithoutEdits = page.copy(
         edits = Nil, editApps = Nil)
      val (pageBefore, pageAfter) =
         page.partitionByVersion(PageVersion.LatestApproved)
      pageBefore must_== pageWithoutEdits
      pageAfter must_== pageWithEditsOnly
    }

    "Add flag & rating to EmptyPage, rename to ExamplePage" >> {
    }
  }

}


