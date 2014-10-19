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
 * Regrettably this code probably doesn't totally followed AngularJS best
 * practises, for example, it uses jQuery(window) rather than getting
 * the window as a service.
 */


d = i: debiki.internal, u: debiki.v0.util
$ = d.i.$;



# `numComments` relied on below doesn't yet exist, so for now:
# (and don't count page title and body)
if $('.dw-p').length - 2 <= 5
  return


# If the minimap won't work anyway, never create it (leave the parent
# <div dw-minimap> empty).
if !Modernizr.canvas || !Modernizr.csspositionfixed
  return


DebikiApp = angular.module 'DebikiApp'


DebikiApp.directive 'dwMinimap', [dwMinimap]


$document = $(document)
$window = $(window)

# for now
maxMinimapWidth = Math.min($window.width! / 3, 500)
aspectRatio = $document.width! / (Math.max $document.height!, 1)
minimapWidth = Math.min(maxMinimapWidth, $document.width! / 12)
minimapHeight = minimapWidth / aspectRatio


function dwMinimap
  template: """
    <canvas
      id="dw-minimap"
      ng-show="treeLayout()"
      ui-scrollfix2d
      width="#minimapWidth"
      height="#minimapHeight"
      ng-mousedown="startScrolling($event)">
    </canvas>
    """

  link: !(scope, elem, attrs) ->
    canvas = elem.children('canvas')
    context = canvas[0].getContext '2d'
    context.fillStyle = '#444'

    scope.treeLayout = ->
      d.i.layout == 'TreeLayout'

    # The article's .dw-p is very wide; use .dw-p-bd-blk instead.
    $('.dw-p-bd-blk').each !->
      drawPost($(this), context, minimapWidth, minimapHeight)

    cachedMinimap = context.getImageData(0, 0, minimapWidth, minimapHeight)

    angular.element($window).bind 'scroll', !->
      context.clearRect(0, 0, minimapWidth, minimapHeight)
      context.putImageData(cachedMinimap, 0, 0)
      drawViewport(context, minimapWidth, minimapHeight)

    isScrolling = false

    preventDefault = -> false

    scope.startScrolling = ($event) ->
      isScrolling := true
      $window.on('mousemove', scope.scroll)
      $window.on('mouseup', scope.stopScrolling)
      $window.on('mouseleave', scope.stopScrolling)
      scope.scroll($event)

    scope.stopScrolling = ($event) ->
      $event.preventDefault()
      isScrolling := false
      $window.off('mousemove', scope.scroll)
      $window.off('mouseup', scope.stopScrolling)
      $window.off('mouseleave', scope.stopScrolling)

    scope.scroll = ($event) ->
      # The minimap is hidden when it's not scrollfixed in the upper left
      # corner, because when it's not scrollfixed, it moves when you scroll,
      # wich distorts your scrolling.
      if !canvas.hasClass('ui-scrollfix')
        scope.stopScrolling($event)
        # Scroll to 0,0 because it's confusing if the navbar doesn't appear
        # when the minimap suddenly vanishes and everything stops. Feels better
        # to be back where one started.
        $window[0].scrollTo(0, 0)
      if !isScrolling
        return
      $event.preventDefault()
      canvasOffset = canvas.offset!
      docPosClickedX = ($event.pageX - canvasOffset.left) / minimapWidth * $document.width!
      docPosClickedY = ($event.pageY - canvasOffset.top) / minimapHeight * $document.height!
      newDocCornerX = docPosClickedX - $window.width! / 2
      newDocCornerY = docPosClickedY - $window.height! / 2
      $window[0].scrollTo(newDocCornerX, newDocCornerY)



!function drawPost(bodyBlock, context, minimapWidth, minimapHeight)
  offset = bodyBlock.offset!
  height = bodyBlock.height!
  width = bodyBlock.width!
  x = minimapWidth * offset.left / $document.width!
  w = minimapWidth * width / $document.width!
  y = minimapHeight * offset.top / $document.height!
  h = minimapHeight * height / $document.height!
  # Make very short comments visiible by setting min size.
  w = Math.max 3, w
  h = Math.max 1, h
  context.fillRect(x, y, w, h)



!function drawViewport(context, minimapWidth, minimapHeight)
  x = minimapWidth * $window.scrollLeft! / $document.width!
  w = minimapWidth * $window.width! / $document.width!
  y = minimapHeight * $window.scrollTop! / $document.height!
  h = minimapHeight * $window.height! / $document.height!

  context.beginPath()
  context.rect(x, y, w, h)
  context.stroke()



# vim: fdm=marker et ts=2 sw=2 fo=tcqwn list
