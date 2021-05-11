/**
 * Copyright (c) 2018 Kaj Magnus Lindberg
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

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.EdHttp._
import debiki.RateLimits
import ed.server.{EdContext, EdController}
import ed.server.http._
import javax.inject.Inject
import play.api.libs.json._
import play.api.mvc._
import Utils.OkXml


// How test API?
//  https://medium.com/javascript-scene/why-i-use-tape-instead-of-mocha-so-should-you-6aa105d8eaf4
//  looks nice:  https://github.com/vesln/hippie
// Markdown not Yaml?  https://apiblueprint.org/developers.html
//
// https://apiblueprint.org/   or Swagger?  or sth else?
//
// Dredd?  https://github.com/apiaryio/dredd
//    https://dredd.readthedocs.io/en/latest/    http://dredd.org/en/latest/
//
// Want:
//  - API docs that can be generated to interactive HTML, so can click-&-edit-run-examples
//  - API docs that can be parsed into JS and auto-tested by api-e2e-test-suite
//
// docs how? Slate? like these use:
// https://developers.giosg.com/http_api.html#list-external-subscriptions-for-scheduled-email-report
//


class ApiV0Controller @Inject()(cc: ControllerComponents, edContext: EdContext,
  sitePatchController: talkyard.server.sitepatch.SitePatchController)
  extends EdController(cc, edContext) {

  private val logger = talkyard.server.TyLogger("ApiV0Controller")

  def getFromApi(apiEndpoint: String): Action[Unit] =
        GetActionRateLimited(RateLimits.NoRateLimits) { request: GetRequest =>

    import request.{queryString, dao}

    val EmbeddedCommentsFeedPath = "embedded-comments-feed"

    // DEPRECATED  don't do match-case, instead, use different controllers,
    // and endpoint handlers prefixed with  apiv0_ ...
    apiEndpoint match {
      case "ping" =>
        Ok(s"pong from: ${request.method} ${request.uri}\n")

      // Move export-site-json to SiteBackupController, an ApiSecretPostJsonAction, instead.
      //
      // Typically, one saves the exported data in a file  site-name.tydump.json
      // or, with query params like:
      //    ?exportSiteMeta=false
      //    &categories=1,2,3   or  categories=extId:aaa,extId:bbb,extId:ccc
      // instead exports a *patch*: only the specified data, and no site name or id.
      // Then, one typically saves the file in  site-name.typatch.json.
      //
      // Dump = whole site. Can be imported to an empty server, to migrate from one server to another.
      // Patch = parts of a site. Can only be imported (added to) an already existing site —
      // to "patch" it.  E.g. Disqus comments converted to Talkyard json format, is in a patch
      // file: can be imported to an already existing Talkyard comments site only.
      //
      // There'll also be an  export-site-zip  endpoint, which, if one specifies
      // &includeUploads=true,  also includes uploaded files like images and attachments
      // and videos in the resulting zip.  — This zip is a totally complete export file,
      // whilst the .json is text only.  (Maybe could base64 encode binary data? and include
      // in the json? some time in the distant future. Or bson? or MessagePack? — not bson,
      // bson is apparently intended for fast lookup in the bson file, but for Talkyard,
      // keeping the dump file small is instead the goal.
      // """Compared to BSON, MessagePack is more space-efficient. ... designed for
      // efficient transmission over the wire"""  https://en.wikipedia.org/wiki/MessagePack
      // Or **Protobuf** ?  Yes, use protobuf, not messagepack.
      // Protocol buffers = seems nice :- )  apparently verifies the input is valid,
      // so Talkyard wouldn't need to do that (!). One instead declares the data structure,
      // and compiles a parser? Works with Rust? There's rust-protobuf.
      // Javascript? Yes, https://github.com/protocolbuffers/protobuf/tree/master/js.
      //
      case "export-site-json" =>
        throwForbiddenIf(!request.isViaApiSecret,
          "TyE0APIGET", "The API may be called only via Basic Auth and an API secret")
        sitePatchController.exportSiteJsonImpl(request)

      // Later:
      // /-/v0/comments-feed —> lists all recent blog comments   [CMTSFEED]
      // /-/v0/comments-feed?forEmbeddingHost=www.myblog.com — if a multi-host blog
      // Or:
      // /-/v0/embedded-comments-feed ?  Probably better — "comment" can be interpreted
      // as StackOverflow style "comments" below a Q&A answer post.
      //
      // Whilst this (/-/v0/feed) is about the Talkyard site only and links to it:
      case "feed" | EmbeddedCommentsFeedPath =>
        val onlyEmbeddedComments = apiEndpoint == EmbeddedCommentsFeedPath
        /*
        https://server.address/-/v0/recent-posts.rss  — No! Explosion of endpoints. Instead:

        https://server.address/-/v0/feed?
            type=atom&   — no, *always only* support Atom
            include=replies,chatMessages,topics&
            limit=10&
            minLikeVotes=1&
            path=/some/category/or/page  — no
            category=extid:category_id  — yes

        Look at the List API — use the same  findWhat  and  lookWhere  ?

        Just going to:  https://www.talkyard.io/-/feed  = includes all new posts, type Atom, limit 10 maybe.

          /page/path.atom  = new replies to that page
          /directory/ *.atom  = new topics,
          /directory/ **.atom  = new topics in all deeper dirs, and (?) use:
          /directory*.atom  = new topics, and (?) use:
            dao.listPagePaths(
              Utils.parsePathRanges(pageReq.pagePath.folder, pageReq.request.queryString,

         Also:
             Get inspired by, + what can make sense to implement:
             https://developer.github.com/v3/activity/feeds/
             (but use Auth header Bearer tokens, not query params).
         */

        val atomXml = dao.getAtomFeedXml(
              request, onlyEmbeddedComments = onlyEmbeddedComments)
        OkXml(atomXml, "application/atom+xml; charset=UTF-8")

      case _ =>
        throwForbidden("TyEAPIGET404", s"No such API endpoint: $apiEndpoint")
    }
  }


  def postToApi(apiEndpoint: String): Action[JsValue] =
        PostJsonAction(RateLimits.NoRateLimits, maxBytes = 1000) { request: JsonPostRequest =>

    throwForbiddenIf(!request.isViaApiSecret && apiEndpoint != "ping",
        "TyEAPI0SECRET", "The API may be called only via Basic Auth and an API secret")

    // DEPRECATED  don't do match-case, instead, use different controllers,
    // and endpoint handlers prefixed with  apiv0_ ...
    apiEndpoint match {
      case "ping" =>
        Ok(s"pong from: ${request.method} ${request.uri}\n")

      case _ =>
        throwForbidden("TyEAPIPST404", s"No such API endpoint: $apiEndpoint")
    }
  }

}
