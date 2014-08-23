/* Opens a new unsaved page in a new browser tab.
 * Copyright (C) 2012 - 2013 Kaj Magnus Lindberg (born 1979)
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


/**
 * Opens a new unsaved page in the current browser tab.
 */
d.i.createChildPage = !({ pageRole, parentPageId, status }) ->

  # We'll create the new page in the same folder as the current page.
  # (?get-view-new-page-url works with folders only.)
  folder = d.i.parentFolderOfPage window.location.pathname

  slug = switch pageRole
    | 'BlogPost' => 'new-blog-post'
    | 'ForumTopic' => 'new-forum-topic'
    | _ => 'new-page'

  # Warning: Dupl code below. See client/spa/admin/module-and-services.ls,
  # function getViewNewPageUrl().
  # COULD break out function `buildGetViewNewPageUrl`?

  # Ask the server if it's okay to create the page. If it is, the server
  # generates a page id — and also a link where we can view the
  # new unsaved page. We'll open that link in `newTab` (at the very end
  # of this function).
  getViewNewPageUrl =
      folder +
      '?get-view-new-page-url' +
      "&pageSlug=#slug" +
      "&pageRole=#pageRole" +
      '&showId=t' +
      "&status=#status"

  parentPageId = d.i.pageId if !parentPageId
  getViewNewPageUrl += "&parentPageId=#parentPageId" if parentPageId

  $.getJSON(getViewNewPageUrl).done !({ viewNewPageUrl }) ->
    window.location = viewNewPageUrl



# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
