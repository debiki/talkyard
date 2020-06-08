/**
 * Copyright (c) 2020 Kaj Magnus Lindberg
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

package talkyard.server.linkpreview


import org.scalatest._
import org.scalatest.matchers.must
import com.debiki.core.Prelude._
import com.debiki.core._
import debiki.onebox.engines.TwitterPrevwRendrEng


class LinkPreviewMatchersSpec extends FreeSpec with must.Matchers {

  val http = "http"
  val https = "https"


  def sampleLinksExecpt(any: AnyRef): Set[String] = {
    sampleLinks(any)._2
  }

  def sampleLinksOnly(any: AnyRef): Set[String] = {
    sampleLinks(any)._1
  }


  /** Returns right and wrong links. */
  def sampleLinks(any: AnyRef): (Set[String], Set[String]) = {
    var wrongLinks = Set[String]()
    var rightLinks = Set[String]()

    if (any != FacebookLinks) {
      wrongLinks += FacebookLinks.facebookPostUrl
      wrongLinks += FacebookLinks.facebookVideoUrl
    }

    if (any != InstagramLinks){
      wrongLinks += InstagramLinks.realUrl1
      wrongLinks += InstagramLinks.realUrl2
    }

    if (any != RedditLinks) {
      wrongLinks += RedditLinks.url1
      wrongLinks += RedditLinks.url2
      wrongLinks += RedditLinks.url3
    }

    TESTS_MISSING // Telegram

    if (any != TikTokLinks) {
      wrongLinks += TikTokLinks.url1
      wrongLinks += TikTokLinks.url2
    }

    if (any == TwitterLinks) {
      SECURITY; TESTS_MISSING // verify the wrong domains won't match. Done already, can do even more.
      // change the domains in various ways, verify won't match.
      // Already tested — see below, e.g.:
      // (provider).regex.matches(url1.replaceAllLiterally(".com", ".bad.com")) mustBe false
      // and would be good to double test all provider,
      // via this sampleLinks() fn too, somehow.
    }
    else {
      wrongLinks += TwitterLinks.sampleTweetLink
      wrongLinks += TwitterLinks.sampleMomentLink
    }

    if (any != YouTubeLinks) {
      wrongLinks += YouTubeLinks.url1
      wrongLinks += YouTubeLinks.url2
      wrongLinks += YouTubeLinks.url3
    }

    (rightLinks, wrongLinks)
  }



  // ====== Facebook

  object FacebookLinks {
    val facebookPostUrl = "https://www.facebook.com/abc123/posts/def456"
    val facebookVideoUrl = "https://www.facebook.com/abc123/videos/def456"
  }

  "FacebookPostPrevwRendrEng can" - {
    import debiki.onebox.engines.{FacebookPostPrevwRendrEng => fb}
    import FacebookLinks._

    val postUrl = facebookPostUrl
    val photoUrl = "https://www.facebook.com/photos/def456"

    "match FB post urls" in {
      fb.handles(postUrl) mustBe true
      fb.handles(photoUrl) mustBe true
      fb.handles("https://www.facebook.com/abc123/photos/def456") mustBe true
      fb.handles("https://www.facebook.com/photos.php?something=more") mustBe true
      fb.handles("https://www.facebook.com/abc123/activity/def456") mustBe true
      fb.handles("https://www.facebook.com/permalink.php?whatever=abc123") mustBe true
      fb.handles("https://www.facebook.com/media/set?set=abc123") mustBe true
      fb.handles("https://www.facebook.com/questions/abc123") mustBe true
      fb.handles("https://www.facebook.com/notes/abc/123") mustBe true
    }

    "but not the wrong urls" in {
      fb.handles(postUrl.replaceAllLiterally(".com", ".bad.com")) mustBe false
      fb.handles(postUrl.replaceAllLiterally(".com", ".com.bad.com")) mustBe false
      fb.handles(postUrl.replaceAllLiterally("posts", "pos_ts")) mustBe false
      fb.handles(postUrl.replaceAllLiterally("facebook", "fac_ebook")) mustBe false
      fb.handles(postUrl.replaceAllLiterally("www.f", "xyz.f")) mustBe false
      fb.handles(postUrl.replaceAllLiterally("www.f", "f")) mustBe false
      fb.handles(postUrl.replaceAllLiterally("k.com", "k.co")) mustBe false
      fb.handles(postUrl.replaceAllLiterally("https:", "http:")) mustBe false

      fb.handles(photoUrl.replaceAllLiterally("photos", "pho_tos")) mustBe false
    }

    "not FB video urls" in {
      fb.handles(facebookVideoUrl) mustBe false
    }

    "not from the wrong domains" in {
      TESTS_MISSING
    }

    "not the wrong providers" in {
      sampleLinksExecpt(FacebookLinks) foreach { link =>
        fb.handles(link) mustBe false
      }
    }
  }


  "FacebookVideoPrevwRendrEng can" - {
    import debiki.onebox.engines.{FacebookVideoPrevwRendrEng => fb}
    import FacebookLinks._

    val videoUrl = facebookVideoUrl
    val videoUrl2 = "https://www.facebook.com/video.php?query=param"

    "match FB video urls" in {
      fb.handles(videoUrl) mustBe true
      fb.handles(videoUrl2) mustBe true
    }

    "but not the wrong urls" in {
      fb.handles(videoUrl.replaceAllLiterally("videos", "vid_eos")) mustBe false

      fb.handles(videoUrl.replaceAllLiterally(".com", ".bad.com")) mustBe false
      fb.handles(videoUrl.replaceAllLiterally(".com", ".com.bad.com")) mustBe false
      fb.handles(videoUrl.replaceAllLiterally("facebook", "fac_ebook")) mustBe false
      fb.handles(videoUrl.replaceAllLiterally("www.f", "ww1.f")) mustBe false
      fb.handles(videoUrl.replaceAllLiterally("www.f", "f")) mustBe false
      fb.handles(videoUrl.replaceAllLiterally("k.com", "k.org")) mustBe false
      fb.handles(videoUrl.replaceAllLiterally("https:", "http:")) mustBe false

      fb.handles(videoUrl2.replaceAllLiterally("video", "vid_eo")) mustBe false
    }

    "not FB post urls" in {
      fb.handles(videoUrl.replaceAllLiterally("videos", "posts")) mustBe false
      fb.handles(facebookPostUrl) mustBe false
    }

    "not from the wrong domains" in {
      TESTS_MISSING
    }

    "not from the wrong providers" in {
      sampleLinksExecpt(FacebookLinks) foreach { link =>
        fb.handles(link) mustBe false
      }
    }
  }



  // ====== Instagram

  object InstagramLinks {
    val realUrl1 = "https://www.instagram.com/p/BJlNX-rju7o/?utm_source=ig_web_button_share_sheet"
    val realUrl2 = "https://www.instagram.com/p/CBCJGUZDVT_/"
    val url1 = "https://instagram.com/abc123/p/def456"
    val url2 = "https://instagram.com/abc123/tv/def456"
    val url3 = "https://instagram.com/p/def456"
    val url4 = "https://instagram.com/tv/def456"
    val url5 = "https://instagr.am/abc123/p/def456"
  }

  "InstagramPrevwRendrEng can" - {
    import debiki.onebox.engines.{InstagramPrevwRendrEng => insta}
    import InstagramLinks._

    "match real Instagram url:s" in {
      insta.regex.matches(realUrl1) mustBe true
      insta.regex.matches(realUrl2) mustBe true
    }

    "match even more Instagram urls" in {
      insta.regex.matches(url1) mustBe true
      insta.regex.matches(url2) mustBe true
      insta.regex.matches(url3) mustBe true
      insta.regex.matches(url4) mustBe true
      insta.regex.matches(url5) mustBe true
    }

    "also http" in {
      insta.regex.matches(url1.replaceAllLiterally("https:", "http:")) mustBe true
    }

    "but not the wrong urls" in {
      insta.regex.matches(url1.replaceAllLiterally(".com", ".bad.com")) mustBe false
      insta.regex.matches(url1.replaceAllLiterally(".com", ".com.bad.com")) mustBe false
      insta.regex.matches(url1.replaceAllLiterally("instag", "ins_tag")) mustBe false
      insta.regex.matches(url1.replaceAllLiterally("/p/", "/weird/")) mustBe false
      insta.regex.matches(url2.replaceAllLiterally("/tv/", "/weird/")) mustBe false

      insta.regex.matches(url5.replaceAllLiterally(".am", ".bad.am")) mustBe false
      insta.regex.matches(url5.replaceAllLiterally(".am", ".am.bad.am")) mustBe false
      insta.regex.matches(url5.replaceAllLiterally("instagr.am", "ins_agr.am")) mustBe false
      insta.regex.matches(url5.replaceAllLiterally("instagr.am", "instagr.is")) mustBe false
      insta.regex.matches(url5.replaceAllLiterally("/p/", "/weird/")) mustBe false
    }

    "not from the wrong domains" in {
      TESTS_MISSING
    }

    "not from the wrong providers" in {
      sampleLinksExecpt(InstagramLinks) foreach { link =>
        insta.regex.matches(link) mustBe false
      }
    }
  }



  // ====== Reddit

  object RedditLinks {
    val url1 = "https://reddit.com/r/abc123/comments/de45/fg67"
    val url2 = "https://www.reddit.com/r/abc123/comments/de45/fg67"
    val url3 = "https://www.reddit.com/r/AskReddit/comments/gz52ae/" +
                  "your_username_becomes_a_real_being_with_a_human/ftehaok/"
  }

  "RedditPrevwRendrEng can" - {
    import debiki.onebox.engines.{RedditPrevwRendrEng => reddit}
    import RedditLinks._

    "match Reddit urls" in {
      reddit.regex.matches(url1) mustBe true
      reddit.regex.matches(url2) mustBe true
      reddit.regex.matches(url3) mustBe true
    }

    "but not the wrong urls" in {
      // http not https
      reddit.regex.matches(url1.replaceAllLiterally("https:", "http:")) mustBe false
      reddit.regex.matches(url2.replaceAllLiterally("https:", "http:")) mustBe false
      // wrong domain
      reddit.regex.matches(url1.replaceAllLiterally(".com", ".bad.com")) mustBe false
      reddit.regex.matches(url1.replaceAllLiterally(".com", ".com.bad.com")) mustBe false
      reddit.regex.matches(url1.replaceAllLiterally("reddit.com", "red_it.com")) mustBe false
      reddit.regex.matches(url2.replaceAllLiterally("reddit.com", "red_it.com")) mustBe false
      reddit.regex.matches(url1.replaceAllLiterally("://r", "://bad.r")) mustBe false
      reddit.regex.matches(url2.replaceAllLiterally("t.com", "t.co")) mustBe false
      reddit.regex.matches(url2.replaceAllLiterally("t.com", "t.org")) mustBe false
      // wrong path
      reddit.regex.matches(url1.replaceAllLiterally("/comments/", "/comets/")) mustBe false
      reddit.regex.matches(url2.replaceAllLiterally("/comments/", "/comets/")) mustBe false
      // no  /r/
      reddit.regex.matches(url1.replaceAllLiterally("/r/", "/x/")) mustBe false
      reddit.regex.matches(url2.replaceAllLiterally("/r/", "/x/")) mustBe false
      // too many /
      reddit.regex.matches(url3.replaceAllLiterally("/AskReddit/", "/AskR/eddit/")) mustBe false
    }

    "not from the wrong domains" in {
      TESTS_MISSING
    }

    "not from the wrong providers" in {
      sampleLinksExecpt(RedditLinks) foreach { link =>
        reddit.regex.matches(link) mustBe false
      }
    }
  }



  // ====== Telegram

  TESTS_MISSING  // Telegram links


  // ====== TikTok

  object TikTokLinks {
    val url1 = "https://www.tiktok.com/@scout2015/video/6718335390845095173"
    val url2 = "https://www.tiktok.com/@someone.somename/video/1234567890000000002"
  }

  "TikTokPrevwRendrEng can" - {
    import debiki.onebox.engines.{TikTokPrevwRendrEng => tiktok}
    import TikTokLinks._

    "match TikTok urls" in {
      tiktok.regex.matches(url1) mustBe true
      tiktok.regex.matches(url2) mustBe true
    }

    "but not the wrong urls" in {
      // http not https
      tiktok.regex.matches(url1.replaceAllLiterally("https:", "http:")) mustBe false
      tiktok.regex.matches(url2.replaceAllLiterally("https:", "http:")) mustBe false
      // wrong domain
      tiktok.regex.matches(url1.replaceAllLiterally(".com", ".bad.com")) mustBe false
      tiktok.regex.matches(url1.replaceAllLiterally(".com", ".com.bad.com")) mustBe false
      tiktok.regex.matches(url1.replaceAllLiterally("tiktok.com", "tik_ok.com")) mustBe false
      tiktok.regex.matches(url2.replaceAllLiterally("tiktok.com", "tiktok.org")) mustBe false
      tiktok.regex.matches(url2.replaceAllLiterally("www.tiktok", "bad.tiktok")) mustBe false
      // wrong path
      tiktok.regex.matches(url1.replaceAllLiterally("/video/", "/villains/")) mustBe false
      tiktok.regex.matches(url2.replaceAllLiterally("/video/", "/vi/deo/")) mustBe false
      tiktok.regex.matches(url2.replaceAllLiterally("/video/", "/")) mustBe false
      // no  @ in username
      tiktok.regex.matches(url1.replaceAllLiterally("/@", "/")) mustBe false
    }

    "not from the wrong domains" in {
      TESTS_MISSING
    }

    "not from the wrong providers" in {
      sampleLinksExecpt(TikTokLinks) foreach { link =>
        tiktok.regex.matches(link) mustBe false
      }
    }
  }



  // ====== Twitter

  object TwitterLinks {
    // Sample tweet link from:
    // https://developer.twitter.com/en/docs/tweets/post-and-engage/api-reference/get-statuses-oembed
    val sampleTweetLink = "https://twitter.com/Interior/status/507185938620219395"

    // Sample Moment link from:
    // https://developer.twitter.com/en/docs/twitter-for-websites/moments/guides/oembed-api
    val sampleMomentLink = "https://twitter.com/i/moments/650667182356082688"
  }

  "TwitterPrevwRendrEng can" - {
    import TwitterPrevwRendrEng.{regex => rgx}
    import TwitterLinks._

    "regex match tweet urls" in {
      val status = "status"
      val twittercom = "twitter.com"
      rgx.matches(s"$https://$twittercom/abc123/$status/def456*") mustBe true
      rgx.matches(s"$https://$twittercom/abc/123/$status/def/456*") mustBe true
      rgx.matches(s"$https://sth.$twittercom/ab12/$status/de45*") mustBe true
      rgx.matches(sampleTweetLink) mustBe true
    }

    "but not the wrong tweet urls" in {
      // Not https:
      rgx.matches(sampleTweetLink.replaceAllLiterally("https:", "http:")) mustBe false
      // Not 'status':
      rgx.matches(sampleTweetLink.replaceAllLiterally("status", "sta_tus")) mustBe false
      // Not 'twitter.com':
      rgx.matches(sampleTweetLink.replaceAllLiterally("twitter.com", "twi_ter.com")
      ) mustBe false
      rgx.matches(sampleTweetLink.replaceAllLiterally(".com", ".bad.com")) mustBe false
      rgx.matches(sampleTweetLink.replaceAllLiterally(".com", ".com.bad.com")) mustBe false
      rgx.matches(sampleTweetLink.replaceAllLiterally("r.com", "r.co")) mustBe false
      // 'https://not_twitter.com':
      rgx.matches(sampleTweetLink.replaceAllLiterally("://t", "://not_t")
      ) mustBe false
    }

    "?? Later ?? regex match Twitter Moment urls" in {
      // rgx.matches(sampleMomentLink) mustBe true
    }

    "not the wrong domain" in {
      TESTS_MISSING
      sampleLinksOnly(TwitterLinks) foreach { link =>
        rgx.matches(link) mustBe true
        // ??
        // rgx.matches(link.replaceFirst("([^/])/", "&1.bad.com/")) mustBe false
        rgx.matches(link.replaceAllLiterally(".com", ".com.bad.com")) mustBe false
      }
    }

    "not the wrong providers" in {
      sampleLinksExecpt(TwitterLinks) foreach { link =>
        rgx.matches(link) mustBe false
      }
    }

  }



  // ====== YouTube

  object YouTubeLinks {
    val url1 = "https://youtu.be/box0-koAuIY"
    val url2 = "https://www.youtube.com/watch?v=S7znI_Kpzbs"
    val url3 = "https://www.youtube.com/watch?v=8h9Mvz1i9hk"
  }

  "YouTubePrevwRendrEngOEmbed can" - {
    import debiki.onebox.engines.{YouTubePrevwRendrEngOEmbed => youtube}
    import YouTubeLinks._

    "match YouTube urls" in {
      youtube.handles(url1) mustBe true
      youtube.handles(url2) mustBe true
      youtube.handles(url3) mustBe true
    }

    "but not the wrong urls" in {
      // http not https
      youtube.handles(url1.replaceAllLiterally("https:", "http:")) mustBe false
      // wrong domain
      youtube.handles(url1.replaceAllLiterally(".be", ".bad.be")) mustBe false
      youtube.handles(url1.replaceAllLiterally(".be", ".be.bad.be")) mustBe false
      youtube.handles(url2.replaceAllLiterally(".com", ".bad.com")) mustBe false
      youtube.handles(url2.replaceAllLiterally(".com", ".com.bad.com")) mustBe false
      youtube.handles(url1.replaceAllLiterally(".be", ".com")) mustBe false
      youtube.handles(url2.replaceAllLiterally(".com", ".be")) mustBe false
      youtube.handles(url3.replaceAllLiterally("youtube", "yo_tube")) mustBe false
      youtube.handles(url1.replaceAllLiterally("youtu.be", "www.youtu.be")) mustBe false
      // wrong path
      youtube.handles(url2.replaceAllLiterally("/watch", "/look")) mustBe false
      youtube.handles(url2.replaceAllLiterally("/watch", "/wow/watch")) mustBe false
    }

    "not from the wrong domains" in {
      TESTS_MISSING
    }

    "not from the wrong providers" in {
      sampleLinksExecpt(YouTubeLinks) foreach { link =>
        youtube.handles(link) mustBe false
      }
    }
  }


}


