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

d = i: debiki.internal, u: debiki.v0.util
$ = d.i.$;



d.i.initMinimap = !($posts) ->

  winWidth = window.innerWidth
  aspectRatio = document.width / document.height
  minimapWidth = min(600, document.width / 15)
  minimapHeight = minimapWidth / aspectRatio

  minimap = $("""
    <canvas id="dw-minimap" width="#minimapWidth" height="#minimapHeight">
    </canvas>
    """)[0]

  $('body').prepend minimap

  context = minimap.getContext '2d'
  context.fillStyle = '#999900'

  # The article's .dw-p is very wide; use .dw-p-bd-blk instead.
  $posts.find('.dw-p-bd-blk').each !(index) ->
    bodyBlock = $(this)
    offset = bodyBlock.offset!
    height = bodyBlock.height!
    width = bodyBlock.width!
    x = minimapWidth * offset.left / document.width
    w = minimapWidth * width / document.width
    y = minimapHeight * offset.top / document.height
    h = minimapHeight * height / document.height
    context.fillRect(x, y, w, h)



# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
