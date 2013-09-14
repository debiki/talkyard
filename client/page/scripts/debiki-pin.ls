/* Drags and sorts pinned posts; uses jQuery UI's Sortable.
 * Copyright (C) 2013 Kaj Magnus Lindberg (born 1979)
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



d.i.makePinsDragsortable = !->
  if Modernizr.touch
    return

  # Vertical threads:
  $(".dw-res:has(> li #verticalHandle)").sortable(verticalSettings)
  # Horizontal threads:
  $(".dw-res:has(> li #horizontalHandle)").sortable(horizontalSettings)



initialPosition = 0

function findPositionOf(item)
  listItem = item.closest 'li'
  siblingsAndItem = listItem.parent!children 'li'
  index = 0
  for elem in siblingsAndItem
    # Ignore any dragsort target placeholder, and horizontal reply button.
    if $(elem).is('.dw-t') || $(elem).is('li:has(> .dw-t)')
      index += 1
      if elem == listItem[0]
        break

  d.u.bugIf index == 0, 'DwE2CG10'
  index



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
      changePinnedPositionOf ui.item, newPosition



verticalHandle = '> .dw-p > .dw-p-hd > .dw-p-pin'

verticalSettings = $.extend {}, sharedSettings,
  items: "> li:has(#verticalHandle)"
  handle: verticalHandle
  axis: 'y'
  start: !(e, ui) ->
    ui.helper.append('<div class="dw-dragsort-shadow dw-dragsort-pin-vt"></div>')
    initialPosition := findPositionOf ui.item



horizontalHandle = "> .dw-t #verticalHandle"

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



function changePinnedPositionOf(item, newPosition)
  postId = item.find('> .dw-t > .dw-p, > .dw-p').dwPostId!
  data = [{ pageId: d.i.pageId, postId, position: newPosition }]
  d.u.postJson { url:  '/-/pin-at-position', data }
      .fail d.i.showServerResponseDialog



# vim: fdm=marker et ts=2 sw=2 fo=tcqwn list
