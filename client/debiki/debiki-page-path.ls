# Copyright (c) 2012 Kaj Magnus Lindberg. All rights reserved

d = i: debiki.internal, u: debiki.v0.util
$ = d.i.$


d.i.analyzePagePath = (path) ->
  pageId = findPageIdIn(path)
  showId = pageId != null
  if (!pageId)
    pageId = findPageIdForNewPage path

  return
    folder: parentFolderOfPage path
    pageSlug: findPageSlugIn path
    showId: showId
    pageId: pageId



d.i.parentFolderOfPage = (path) ->
  # Index page? If so, folder path equals index page path.
  if path.match //^.*/$//
    return path
  # Other pages (with id shown, or non-empty slug).
  matches = path.match //^(/[^?]*/)[^/?]*(\?.*)?$//
  if !matches => return '/'
  bug('DwE03Al8') if matches.length != 3
  matches[1]



d.i.findPageSlugIn = (path) ->
  matches = path.match //^[^?]*/(-[a-z0-9]+-)?([^/?-][^?/]*)(\?.*)?$//
  if !matches => return ''
  bug('DwE83KX1') if matches.length != 4
  matches[2]



d.i.findPageIdIn = (path) ->
  matches = path.match //^[^?]*/-([a-z0-9]+)(-[^/]*)?(\?.*)?$//
  if matches => matches[1]
  else null



/**
 * When creating a new page, the server redirects to an url like
 * /some/folder/new-page-slug?view-new-page=<page-id>. This function
 * finds any such page id.
 */
d.i.findPageIdForNewPage = (path) ->
  matches = path.match //^.*\?view-new-page=([a-z0-9]+).*$//
  if matches => matches[1]
  else null



# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
