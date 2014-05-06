/* Patches the page with new data from server, e.g. updates an edited comment.
 * Copyright (C) 2012-2013 Kaj Magnus Lindberg (born 1979)
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



onPagePatchedCallbacks = []


debiki.onPagePatched = !(callback) ->
  onPagePatchedCallbacks.push callback



/**
 * Inserts new replies and replaces old threads and edited posts with
 * new HTML provided by the server. And calls all onPagePatchedCallbacks.
 *
 * Returns and object with info on what
 * was patched.
 */
d.i.patchPage = (patches, { overwriteTrees, replacePostHeadsOnly } = {} ) ->
  result = patchedThreads: [], patchedPosts: []

  for pageId, threadPatches of patches.threadsByPageId || {}
    if pageId is d.i.pageId
      for patch in threadPatches
        patchThreadWith patch, { onPage: pageId, result, overwriteTrees }

  for pageId, postPatches of patches.postsByPageId || {}
    if pageId is d.i.pageId
      for patch in postPatches
        if replacePostHeadsOnly
          patchPostHeadWith patch, { onPage: pageId, result }
        else
          patchPostWith patch, { onPage: pageId, result }

  for c in onPagePatchedCallbacks
    c()

  result



patchThreadWith = (threadPatch, { onPage, result, overwriteTrees }) ->
  pageId = onPage
  isNewThread = ! $('#post-' + threadPatch.id).length
  $newThread = $ threadPatch.html

  if isNewThread
    $prevThread = d.i.findThread$ threadPatch.prevThreadId
    $parentThread = d.i.findThread$ threadPatch.ancestorThreadIds[0]
    isTopLevelComment = threadPatch.ancestorThreadIds.length === 0
    if $prevThread.length
      insertThread $newThread, after: $prevThread
    else if $parentThread.length
      appendThread $newThread, to: $parentThread
    else if isTopLevelComment
      appendThread $newThread, to: $('.dw-depth-0')
    else
      console.debug("Don't know where to place thread #{threadPatch.id}.")
    $newThread.addClass 'dw-m-t-new'
  else
    # If thread wrapped in <li>:
    if not $newThread.is '.dw-t'
      $newThread = $newThread.children '.dw-t'

    # For now, don't overwrite existing threads, if they've already
    # been loaded. If overwriting, there'd be troubles e.g. if the user
    # has started replying to a successor post.
    $oldThread = $('#' + $newThread.attr 'id')
    if $oldThread.find('.dw-p-bd').length == 0 || overwriteTrees
      # No post body present. Old thread thus not yet loaded? Replace it.
      replaceOldWith $newThread, onPage: pageId
    else
      return

  $newThread.dwFindPosts!each !->
    d.i.$initPostAndParentThread.apply this
    d.i.showAllowedActionsOnly this

  # Don't draw arrows until all posts have gotten their final position.
  # (The caller might remove a horizontal reply button, and show it again,
  # later, and the arrows might be drawn incorrectly if drawn too early.)
  drawArrows = !->
    # It's the parent thread's responsibility to draw arrows to its children.
    $newThread.parent!closest('.dw-t').each d.i.SVG.$clearAndRedrawArrows
  setTimeout drawArrows, 0

  result.patchedThreads.push $newThread



patchPostWith = (postPatch, { onPage, result }) ->
  pageId = onPage
  $newPost = $ postPatch.html # absent if edit not applied
  $oldPost = $ ('#post-' + postPatch.postId)
  $newActions = $ postPatch.actionsHtml
  $oldActions = $oldPost.parent!children '.dw-p-as'
  isEditPatch = !!postPatch.editId

  if not isEditPatch
    void # Skip the messages below.
  else if !postPatch.isEditApplied
    addMessageToPost(
        'Your suggestions are pending review. Click the pen icon at the ' +
            'lower right corner of this comment, to view all suggections.',
        $oldPost)

  shallReplacePost = !isEditPatch || postPatch.isEditApplied
  if shallReplacePost
    $newPost.addClass 'dw-m-t-new'
    replaceOldWith $newPost, onPage: pageId

    $newPost.each d.i.$initPost

    $newThread = $newPost.dwClosestThread!
    $newThread.each d.i.SVG.$clearAndRedrawArrows

  $oldActions.replaceWith $newActions

  editedPost =
    if shallReplacePost then $newPost[0] else $oldPost[0]

  d.i.bindActionLinksForSinglePost editedPost
  d.i.showAllowedActionsOnly editedPost

  result.patchedPosts.push $newThread



patchPostHeadWith = (postPatch, { onPage, result }) ->
  pageId = onPage
  newPost = $(postPatch.html)
  oldPost = $('#post-' + postPatch.postId)

  replaceOldHead(newPost, onPage: pageId)
  d.i.makePostHeaderPretty(oldPost.children('.dw-p-hd'))

  thread = newPost.dwClosestThread!
  result.patchedPosts.push(thread)



/**
 * Inserts a HTML message above the post.
 */
addMessageToPost = (message, $post) ->
  $post.prepend $(
      '<div class="dw-p-pending-mod">' + message + '</div>')


insertThread = ($thread, { after }) ->
  $pervSibling = after
  if $pervSibling.parent!is 'li'
    # Horizontal layout. Threads are wrapped in <li>s (with
    # display: table-cell).
    $pervSibling = $pervSibling.parent!
  $pervSibling.after $thread
  updateDepths($thread)



appendThread = !($thread, { to }) ->
  $parent = to
  $childList = $parent.children '.dw-res'
  if !$childList.length
    # This is the first child thread; create empty child thread list.
    $childList = $("<ol class='dw-res'/>").appendTo $parent
  $thread.appendTo $childList
  updateDepths($thread)


replaceOldWith = ($new, { onPage }) ->
  # WOULD verify that $new is located `onPage`, if in the future it'll be
  # possible to edit e.g. blog posts from a blog post list page.
  $('#' + $new.attr 'id').replaceWith $new
  updateDepths($new)


replaceOldHead = !($newPost, { onPage }) ->
  oldHeader = $("##{$newPost.attr('id')}> .dw-p-hd")
  newHeader = $newPost.children('.dw-p-hd')
  oldHeader.replaceWith(newHeader)


!function updateDepths(postOrThreadOrListItem)
  if postOrThreadOrListItem.is('li:not(.dw-t)')
    # The thread is laid out horizontally and is thus wrapped in an <li>.
    thread = postOrThreadOrListItem.children('.dw-t')
  else
    # The thread is laid out vertically.
    thread = postOrThreadOrListItem.closest('.dw-t')
  # dwDepth calculates and caches the depth in a CSS class.
  thread.dwDepth!
  thread.find('.dw-t').each !->
    $(this).dwDepth!


# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
