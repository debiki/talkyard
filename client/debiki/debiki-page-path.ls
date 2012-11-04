# Copyright (c) 2012 Kaj Magnus Lindberg. All rights reserved

d = i: debiki.internal, u: debiki.v0.util
$ = d.i.$


d.i.analyzePagePath = (path) ->
  pageId = d.i.findPageIdIn(path)
  showId = pageId != null
  if (!pageId)
    pageId = d.i.findPageIdForNewPage path

  return
    folder: d.i.parentFolderOfPage path
    pageSlug: d.i.findPageSlugIn path
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



noPageSlugReqex = //^([^?]*/)(-[a-z0-9]+-?)?(\?.*)?$//
pageSlugReqex = //^([^?]*/)(-[a-z0-9]+-)?([^/?-][^?/]*)(\?.*)?$//



d.i.findPageSlugIn = (path) ->
  matches = path.match pageSlugReqex
  if !matches => return ''
  bug('DwE83KX1') if matches.length != 5
  matches[3]



d.i.changePageSlugIn = (path, { to }) ->
  newSlug = to
  matchCount = 0
  result = path.replace noPageSlugReqex, (mtch, $1, $2, $3) ->
    matchCount += 1
    # Add any missing '-' between id and slug, or remove if newSlug empty.
    $2withHyphen =
      if !$2 => ''
      else if !newSlug && last($2) == '-' => initial $2
      else if !newSlug => $2
      else if last($2) != '-' => $2 + '-'
      else $2
    $3 ?= ''
    $1 + $2withHyphen + newSlug + $3

  if matchCount > 0
    return result

  path.replace pageSlugReqex, (mtch, $1, $2, $3, $4) ->
    # Remove any trailing '-' from page id, if newSlug empty.
    $2 =
      if !$2 => ''
      else if !newSlug && last($2) == '-' => initial $2
      else $2
    $4 ?= ''
    $1 + $2 + newSlug + $4



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
