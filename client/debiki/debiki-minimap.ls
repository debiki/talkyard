/* Shows a minimap of the discussion; a rectangle marks current viewport.
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

/* This AngularJS directive shows a minimap in which the article and all
 * comments are shown. The boundaries of the viewport are outlined too.
 * If you click and drag in the minimap, you'll scroll the viewport.
 *
 * Regrettably this code doesn't totally followed AngularJS best practises,
 * e.g. I'm using `document` directly.
 */


d = i: debiki.internal, u: debiki.v0.util
$ = d.i.$;


DebikiPageModule = angular.module 'DebikiPageModule'


DebikiPageModule.directive 'dwMinimap', [dwMinimap]



# for now
winWidth = window.innerWidth
aspectRatio = document.width / (Math.max document.height, 1)
minimapWidth = Math.min(500, document.width / 20)
minimapHeight = minimapWidth / aspectRatio



function dwMinimap ($http)
  template: """
    <canvas
      id="dw-minimap"
      xng-show="numComments > 0"
      ui-scrollfix
      width="#minimapWidth"
      height="#minimapHeight">
    </canvas>
    """

  link: !(scope, elem, attrs) ->
    canvas = elem.children('canvas')[0]
    context = canvas.getContext '2d'
    context.fillStyle = '#666'

    # The article's .dw-p is very wide; use .dw-p-bd-blk instead.
    $('.dw-p-bd-blk').each !(index) ->
      bodyBlock = $(this)
      offset = bodyBlock.offset!
      height = bodyBlock.height!
      width = bodyBlock.width!
      x = minimapWidth * offset.left / document.width
      w = minimapWidth * width / document.width
      y = minimapHeight * offset.top / document.height
      h = minimapHeight * height / document.height
      # Make very short comments visiible by setting min size.
      w = Math.max 3, w
      h = Math.max 1, h
      context.fillRect(x, y, w, h)

    cachedMinimap = context.getImageData(0, 0, minimapWidth, minimapHeight)

    angular.element(window).on 'scroll', !->
      context.clearRect(0, 0, minimapWidth, minimapHeight)
      context.putImageData(cachedMinimap, 0, 0)
      drawViewport(context, minimapWidth, minimapHeight)



!function drawViewport(context, minimapWidth, minimapHeight)
  x = minimapWidth * window.scrollX / document.width
  w = minimapWidth * window.innerWidth / document.width
  y = minimapHeight * window.scrollY / document.height
  h = minimapHeight * window.innerHeight / document.height

  context.beginPath()
  context.rect(x, y, w, h)
  context.stroke()



# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
