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

package test.e2e.specs

import com.debiki.core._
import com.debiki.core.Prelude._
import com.debiki.core.PageRole
import com.debiki.core.{PostActionPayload => PAP}
import org.scalatest.DoNotDiscover
import test.e2e.code._


/** Runs the VoteSpec suite
  * in SBT:  test-only test.e2e.specs.VoteSpecRunner
  * In test:console:  (new test.e2e.specs.VoteSpecRunner).execute()
  */
class VoteSpecRunner extends org.scalatest.Suites(new VoteSpec)
with StartServerAndChromeDriverFactory


/** Runs the VoteSpecForEmbeddedComments suite
  * in SBT:  test-only test.e2e.specs.VoteSpecForEmbeddedCommentsRunner
  * In test:console:  (new test.e2e.specs.VoteSpecForEmbeddedCommentsRunner).execute()
  */
class VoteSpecForEmbeddedCommentsRunner
  extends org.scalatest.Suites(new VoteSpecForEmbeddedComments)
with StartServerAndChromeDriverFactory



@test.tags.EndToEndTest
@DoNotDiscover
class VoteSpec extends VoteSpecConstructor(iframe = false) {
  lazy val testPageUrl = createTestPage(PageRole.WebPage,
    title = "Test Page Title 27KV09", body = Some("Test page text 953Ih31.")).url
}


@test.tags.EndToEndTest
@DoNotDiscover
class VoteSpecForEmbeddedComments extends VoteSpecConstructor(iframe = true) {
  lazy val testPageUrl = {
    ensureFirstSiteCreated()
    rememberEmbeddedCommentsIframe()
    s"http://mycomputer:8080/embeds-localhost-topic-id-1001.html"
  }
}


/** Tests Like, Wrong and Off-Topic votes.
  */
abstract class VoteSpecConstructor(val iframe: Boolean)
  extends DebikiBrowserSpec with TestReplyer with TestLoginner with TestVoter {

  def testPageUrl: String

  def randomId() = nextRandomString() take 5

  var post1: PostId = 0
  var post2: PostId = 0

  class VoteCountsAndStates(
    var voteCountsPost1: VoteCounts = VoteCounts(0, 0, 0),
    var voteCountsPost2: VoteCounts = VoteCounts(0, 0, 0),
    var voteStatesPost1: VoteStates = VoteStates(false, false, false),
    var voteStatesPost2: VoteStates = VoteStates(false, false, false)) {

    def clearVoteState() {
      voteStatesPost1 = VoteStates(false, false, false)
      voteStatesPost2 = VoteStates(false, false, false)
    }
  }

  var currentState = new VoteCountsAndStates()

  def checkVotes() {
    // Wrap in `eventually` because the vote counts are refreshed asynchronously.
    eventually {
      countVotes(post1) mustBe currentState.voteCountsPost1
      countVotes(post2) mustBe currentState.voteCountsPost2
      checkVoteStates(post1) mustBe currentState.voteStatesPost1
      checkVoteStates(post2) mustBe currentState.voteStatesPost2
    }
  }


  "Anon user with a browser can" - {

    "open a test page" in {
      gotoDiscussionPageAndFakeNewIp(testPageUrl)
    }

    "login and post a reply, logout" in {
      loginAsGuestInPopup("Guest-User")
      post1 = replyToArticle("Test reply 1.")
      post2 = replyToArticle("Test reply 2.")
      logoutIfLoggedIn()
    }

    "find no votes" in {
      checkVotes()
    }

    "vote Like, Wrong, Off-Topic" in {
      toggleVote(post1, PAP.VoteLike)
      toggleVote(post1, PAP.VoteWrong)
      toggleVote(post1, PAP.VoteOffTopic)
      toggleVote(post2, PAP.VoteLike)
      toggleVote(post2, PAP.VoteWrong)
      toggleVote(post2, PAP.VoteOffTopic)
    }

    "find one vote of each type" in {
      currentState.voteCountsPost1 = VoteCounts(1, 1, 1)
      currentState.voteCountsPost2 = VoteCounts(1, 1, 1)
      currentState.voteStatesPost1 = VoteStates(true, true, true)
      currentState.voteStatesPost2 = VoteStates(true, true, true)
      checkVotes()
    }

    "reload page, count 1 vote of each type, but see no votes selected" in {
      reloadPage()
      currentState.clearVoteState()
      checkVotes()
    }

    "login as guest" in {
      loginAsGuestInPopup("Guest-User")
      reloadPage()
      checkVotes()
    }

    // The user's browser-id cookie has already upvoted the comments, and
    // therefore these new votes will result in the original ones being
    // deleted. The vote count will remain 1, but the votes will be selected.
    "votes for post 2 again, as guest, but ignored: cookie has already voted" in {
      toggleVote(post2, PAP.VoteLike)
      toggleVote(post2, PAP.VoteWrong)
      toggleVote(post2, PAP.VoteOffTopic)
      currentState.voteStatesPost2 = VoteStates(true, true, true)
      checkVotes()
    }

    "reload page, find votes selected for post 2 only" in {
      reloadPage()
      checkVotes()
    }

    "toggle Wrong votes" in {
      toggleVote(post1, PAP.VoteWrong) // toggles on, but ignored since cookied already voted
      toggleVote(post2, PAP.VoteWrong) // toggles off, is considered
      currentState.voteCountsPost1 = VoteCounts(1, 1, 1)
      currentState.voteCountsPost2 = VoteCounts(1, 0, 1)
      currentState.voteStatesPost1 = VoteStates(false, true, false)
      currentState.voteStatesPost2 = VoteStates(true, false, true)
      checkVotes()
    }

    "reload page, find votes state unchanged" in {
      reloadPage()
      checkVotes()
    }

    "logout, find vote counts unchanged, but no votes selected" in {
      logout()
      currentState.clearVoteState()
      checkVotes()
    }

    "login as Role, find no votes selected" in {
      loginWithGmailInPopup()
      checkVotes()
    }

    "vote Like, Wrong, Off-Topic again" in {
      // This deletes any previous not-logged-in votes with the same browser id cookie.
      // So vote counts remain 1.
      toggleVote(post1, PAP.VoteLike)
      toggleVote(post1, PAP.VoteWrong)  // previous vote not deleted, user was logged in as guest
      toggleVote(post1, PAP.VoteOffTopic)
      currentState.voteCountsPost1 = VoteCounts(1, 2, 1)
      currentState.voteStatesPost1 = VoteStates(true, true, true)
      checkVotes()
    }

    "reload page, find votes still selected" in {
      reloadPage()
      checkVotes()
    }

    "undo the Off-Topic vote" in {
      // Currently this resets the off-topic count to 0, because the previous
      // off-topic votes were deleted because they had the same browser-id-cookie.
      // Not sure if it makes sense to delete all old votes with same cookie,
      // but people won't notice/remember anyway, so this is not important.
      toggleVote(post1, PAP.VoteOffTopic)

      currentState.voteCountsPost1 = VoteCounts(1, 2, 0)
      currentState.voteStatesPost1 = VoteStates(true, true, false)
      checkVotes()
    }

    "reload page, find correct votes selected, and correct counts" in {
      reloadPage()
      checkVotes()
    }

    "logout, reload page, find no votes selected, and correct vote counts" in {
      logout()
      currentState.clearVoteState()
      checkVotes()
      reloadPage()
      checkVotes()
    }
  }

}


