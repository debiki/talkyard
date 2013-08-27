/* Toggles threads collapsed. Might load data from server when uncollapsing.
 * Copyright (C) 2010-2013 Kaj Magnus Lindberg (born 1979)
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



d.i.$toggleCollapsed = ->
  $i = $ this
  $parent = $i.parent!
  if $parent.is('.dw-t')
    toggleThreadFolded $parent
  else if $parent.is('.dw-p')
    uncollapsePost $parent
  else if $parent.parent!.is('.dw-res')
    uncollapseReplies $parent.closest('.dw-t')
  false # don't follow any <a> link



!function toggleThreadFolded $thread

  # Don't hide the toggle-folded-link and arrows pointing *to* this thread.
  $childrenToFold = $thread.children ':not(.dw-z, .dw-arw)'
  $foldLink = $thread.children '.dw-z'

  # COULD make the animation somewhat smoother, by sliting up the
  # thread only until it's as high as the <a> and then hide it and add
  # .dw-zd, because otherwie when the <a>'s position changes from absolute
  # to static, the thread height suddenly changes from 0 to the highht
  # of the <a>).

  if $thread.is '.dw-zd'
    # Thread is folded, open it.
    contentsLoaded = $thread.find('.dw-p-bd').length > 0
    if contentsLoaded
      $childrenToFold.each d.i.$slideDown
      $thread.removeClass 'dw-zd'
      $foldLink.text ''
    else
      d.i.loadAndInsertTree $thread.dwPostId!
  else
    # Fold thread.
    postCount = $thread.find('.dw-p').length
    $childrenToFold.each(d.i.$slideUp).queue !(next) ->
      $foldLink.text "Click to show #postCount posts" # COULD add i18n
      $thread.addClass 'dw-zd'
      next!



!function uncollapsePost ($post)
  d.i.loadAndInsertPost $post.dwPostId!



!function uncollapseReplies ($thread)
  # Fist remove the un-collapse button.
  $replies = $thread.children('.dw-res.dw-zd').dwBugIfEmpty('DwE3BKw8')
  $replies.removeClass('dw-zd')
  # Remove "Click to show threads" message, but don't remove any already
  # loaded threads.
  $replies.children('li').filter(':not(.dw-t)').remove!
  d.i.loadAndInsertReplies $thread.dwPostId!



# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
