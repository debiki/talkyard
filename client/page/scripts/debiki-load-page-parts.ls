/* Loads parts of a page, e.g. a single post, a tree or a thread + tree.
 * Copyright (C) 2010-2013 Kaj Magnus Lindberg (born 1979)
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


d = i: debiki.internal, u: debiki.v0.util
$ = d.i.$;



d.i.loadAndInsertPost = !(postId) ->
  loadAndInsert postId, "#{d.i.serverOrigin}/-/load-posts"


d.i.loadAndInsertThreadAndTree = !(postId, anyCallback) ->
  loadAndInsert postId, "#{d.i.serverOrigin}/-/load-threads-and-trees", anyCallback


d.i.loadAndInsertTree = !(postId) ->
  loadAndInsert postId, "#{d.i.serverOrigin}/-/load-trees"


d.i.loadAndInsertReplies = !(postId) ->
  loadAndInsert postId, "#{d.i.serverOrigin}/-/load-replies"



/**
 * Currently also scrolls postId into view.
 */
!function loadAndInsert (postId, url, anyCallback)
  data = [{ pageId: d.i.pageId, actionId: postId }]
  d.u.postJson { url, data }
      .fail d.i.showServerResponseDialog
      .done !(patches) ->
        result = d.i.patchPage patches
        if anyCallback
          anyCallback result
        else
          d.i.findPost$(postId).dwScrollIntoView!



# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
