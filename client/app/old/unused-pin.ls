/* Drags and sorts pinned posts; uses jQuery UI's Sortable.
 * Copyright (C) 2013 Kaj Magnus Lindberg
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

/*  No longer works, after I ported to React.


d = i: debiki.internal, u: debiki.v0.util
$ = d.i.$


initialPosition = 0

verticalHandle = '> .dw-p > .dw-p-hd > .dw-p-pin'
horizontalHandle = "> .dw-t #verticalHandle"

verticallySortablePinsSelector = ".dw-res:has(> li #verticalHandle)"
horizontallySortablePinsSelector = ".dw-res:has(> li #horizontalHandle)"



d.i.makePinsDragsortable = !->
  if Modernizr.touch # COULD do anyway on a [laptopwithtouch].
    return
  # Vertical threads:
  $(verticallySortablePinsSelector).sortable(verticalSettings)
  # Horizontal threads:
  $(horizontallySortablePinsSelector).sortable(horizontalSettings)



d.i.destroyAndRecreateSortablePins = !->
  post = $(this)
  list = post.closest '.dw-res'
  if list.is '.ui-sortable'
    list.sortable 'destroy'
  if list.is verticallySortablePinsSelector
    list.sortable verticalSettings
  else if list.is horizontallySortablePinsSelector
    list.sortable horizontalSettings



d.i.updatePinnedPosition = !(postId, newPosition) ->
  post = d.i.findPost$ postId
  listItem = post.closest 'li'
  list = listItem.parent!
  # listItem.remove() — no, destroys all jQuery UI sortables inside listItem!
  # Instead, add an extra if statement below that skips listItem.
  siblings = list.children 'li'
  index = 0
  inserted = false

  # If there aren't already newPosition pinned posts, then insert postId
  # after the lastInsertAfterElem.
  lastInsertAfterElem = void

  for elem in siblings
    if elem == listItem[0]
      continue
    if listItemIsForReplyBtn(elem)
      lastInsertAfterElem = elem
      continue
    if listItemIsForPinnedPost(elem)
      index += 1
      lastInsertAfterElem = elem
      if index == newPosition
        listItem.insertBefore elem
        inserted = true
        break

  if !inserted
    if lastInsertAfterElem
      listItem.insertAfter lastInsertAfterElem
    else
      list.prepend listItem




function findPositionOf(item)
  listItem = item.closest 'li'
  siblingsAndItem = listItem.parent!children 'li'
  index = 0
  for elem in siblingsAndItem
    if listItemIsForPinnedPost(elem)
      index += 1
      if elem == listItem[0]
        break

  d.u.bugIf index == 0, 'DwE2CG10'
  index



function listItemIsForReplyBtn(elem)
  $(elem).is '.dw-p-as-hz'



function listItemIsForPinnedPost(elem)
  # Ignore any dragsort target placeholder, and horizontal reply button,
  # and non-pinned posts. This works for both vertical and horizontal threads:
  $(elem).find(verticalHandle).length > 0 ||
      $(elem).find(horizontalHandle).length > 0



sharedSettings =
  placeholder: 'ui-state-highlight'
  # revert: true
  scrollSpeed: 30  # = default x 1.5
  'z-index': 2000  # instead of default 1000, which would be below Debiki's <forms>
  tolerance: 'pointer'
  delay: 200
  forcePlaceholderSize: true
  beforeStop: !(e, ui) ->
    ui.helper.children('.dw-dragsort-shadow').remove()
  stop: !(e, ui) ->
    newPosition = findPositionOf ui.item
    if newPosition != initialPosition
      tellServerChangePinnedPos ui.item, newPosition



verticalSettings = $.extend {}, sharedSettings,
  items: "> li:has(#verticalHandle)"
  handle: verticalHandle
  axis: 'y'
  start: !(e, ui) ->
    ui.helper.append('<div class="dw-dragsort-shadow dw-dragsort-pin-vt"></div>')
    initialPosition := findPositionOf ui.item



horizontalSettings = $.extend {}, sharedSettings,
  items: "> li:has(#horizontalHandle)"
  handle: horizontalHandle
  axis: 'x'
  start: !(e, ui) ->
    ui.helper.append('<div class="dw-dragsort-shadow"></div>')
    # Make the placeholder as wide as the element being sorted. But this won't work:
    #  ui.placeholder.width(ui.helper.outerWidth())
    # because horizontal layout uses display: table-cell, so width is igored.
    # Instead, add a dummy elem inside the placeholder, with the desired width:
    width = ui.helper.outerWidth!
    ui.placeholder.append("<div style='width:#{width}px'></div>")



function tellServerChangePinnedPos(item, newPosition)
  postId = item.find('> .dw-t > .dw-p, > .dw-p').dwPostId!
  data = [{ pageId: d.i.pag  eId, postId, position: newPosition }]
  d.u.postJson { url:  "#{d.  i.serv  erOrigin}/-/pin-at-position", data }
      .fail d.i.showSe rverResponseDialog

*/


# vim: fdm=marker et ts=2 sw=2 fo=tcqwn list
