/* Layouts comment threads, e.g. changes width depending on deepest reply.
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
$ = d.i.$;



d.i.layoutThreads = !->

  # Increase width if there are many replies.
  for thread in $('.DW.dw-hz .dw-t.dw-depth-1')
    maxNesting = findMaxNesting thread
    width = 330 + maxNesting * 25
    width = min 440, width
    $(thread).css 'width', width + 'px'



function findMaxNesting (thread)
  $children = $(thread).find '> .dw-single-and-multireplies > .dw-res > .dw-t'
  # If passing $children to `fold` when `$children.length == 1`,
  # it seems as if `fold` wraps jQuery in an array, resulting
  # in eternal recursion.
  children = $children.toArray!
  if empty children
    0
  else
    fold ((a, b) -> max(a, 1 + findMaxNesting b)), 0, children


/**
 * If the URL query string contains 2d=true/false, enables/disables
 * horizontal comments. If the screen is narrow, forces one-column-layout.
 * Returns the layout type in use: 'OneColumnLayout' or 'TreeLayout'.
 */
d.i.chooseLayout = ->
  shallEnable2d = window.location.toString().search('2d=true') != -1
  shallDisable2d = window.location.toString().search('2d=false') != -1 || Math.max($(window).width(), $(window).height()) < 1000
  is2dEnabled = $('html').is('.dw-hz')
  if is2dEnabled && shallDisable2d
    disableHzComments()
    return 'OneColumnLayout'

  if !is2dEnabled && shallEnable2d
    enableHzComments()
    return 'TreeLayout'

  function disableHzComments
    $('html').removeClass('dw-hz').addClass('dw-vt')
    $('.dw-depth-0').removeClass('dw-hz')
    debiki2.ReactActions.setHorizontalLayout(false)

  function enableHzComments
    $('html').removeClass('dw-vt').addClass('dw-hz')
    $('.dw-depth-0').addClass('dw-hz')
    debiki2.ReactActions.setHorizontalLayout(true)

  if is2dEnabled then 'TreeLayout' else 'OneColumnLayout'


# vim: fdm=marker et ts=2 sw=2 fo=tcqwn list
