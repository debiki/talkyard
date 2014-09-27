/* Extracts Debiki specific parts of an URL (a page path).
 * Copyright (C) 2012 Kaj Magnus Lindberg (born 1979)
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
$ = d.i.$



d.i.parentFolderOfPage = (path) ->
  # Index page? If so, folder path equals index page path.
  if path.match //^.*/$//
    return path
  # Other pages (with id shown, or non-empty slug).
  matches = path.match //^(/[^?]*/)[^/?]*(\?.*)?$//
  if !matches => return '/'
  bug('DwE03Al8') if matches.length != 3
  matches[1]



noPageSlugReqex = //^([^?]*/)(-[a-zA-Z0-9]+-?)?(\?.*)?$//
pageSlugReqex = //^([^?]*/)(-[a-zA-Z0-9]+-)?([^/?-][^?/]*)(\?.*)?$//



d.i.findPageSlugIn = (path) ->
  matches = path.match pageSlugReqex
  if !matches => return ''
  bug('DwE83KX1') if matches.length != 5
  matches[3]



d.i.changePageSlugIn = (path, { to }) ->
  # What! Wouldn't it have been easier to 1) `analyzePagePath` and then
  # 2) replace `pageSlug` in the resulting Object, and then 3) write
  # a function that builds a path string from an analyzed path.
  # I'd need a new field for ?view-new-page though.
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



# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
