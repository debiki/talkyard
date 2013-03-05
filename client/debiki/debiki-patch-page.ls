/* Copyright (c) 2010 - 2012 Kaj Magnus Lindberg. All rights reserved. */

d = i: debiki.internal, u: debiki.v0.util
$ = d.i.$;


/**
 * Inserts new replies and replaces old threads and edited posts with
 * new HTML provided by the server. Returns and object with info on what
 * was patched.
 */
d.i.patchPage = (patches) ->
  result = patchedThreads: [], patchedPosts: []

  for pageId, threadPatches of patches.threadsByPageId || {}
    if pageId is d.i.pageId
      for patch in threadPatches
        patchThreadWith patch, { onPage: pageId, result }

  for pageId, postPatches of patches.postsByPageId || {}
    if pageId is d.i.pageId
      for patch in postPatches
        patchPostWith patch, { onPage: pageId, result }

  result



patchThreadWith = (threadPatch, { onPage, result }) ->
  pageId = onPage
  isNewThread = ! $('#post-' + threadPatch.id).length
  $newThread = $ threadPatch.html

  if !threadPatch.approved
    addMessageToPost 'Comment pending moderation.', $newThread.dwChildPost!

  if isNewThread
    $prevThread = d.i.findThread$ threadPatch.prevThreadId
    $parentThread = d.i.findThread$ threadPatch.parentThreadId
    if $prevThread.length
      insertThread $newThread, after: $prevThread
    else if $parentThread.length
      appendThread $newThread, to: $parentThread
    $newThread.addClass 'dw-m-t-new'
  else
    replaceOldWith $newThread, onPage: pageId

  $newThread.dwFindPosts!each d.i.$initPostAndParentThread

  drawArrows = ->
    # Really both $drawTree, and $drawParents for each child post??
    # (Not $drawPost; $newThread might have child threads.)
    $newThread.each d.i.SVG.$drawTree

    # 1. Draw arrows after post has been inited, because initing it
    # might change its size.
    # 2. If some parent is an inline post, *its* parent might need to be
    # redrawn. So redraw all parents.
    $newThread.dwFindPosts!.each d.i.SVG.$drawParents

  # Don't draw arrows until all posts have gotten their final position.
  # (The caller might remove a horizontal reply button, and show it again,
  # later, and the arrows might be drawn incorrectly if drawn inbetween.)
  setTimeout drawArrows, 0

  result.patchedThreads.push $newThread



patchPostWith = (postPatch, { onPage, result }) ->
  pageId = onPage
  $newPost = $ postPatch.html # absent if edit not applied
  $oldPost = $ ('#post-' + postPatch.postId)
  isEditPatch = !!postPatch.editId

  if not isEditPatch
    void # Skip the messages below.
  else if !postPatch.isEditApplied
    addMessageToPost(
        'Your edit has not yet been applied; it is pending review.'
        $oldPost)
  else if !postPatch.isPostApproved
    addMessageToPost(
        'Your edits are pending moderation.'
        $newPost)

  unless isEditPatch && !postPatch.isEditApplied
    $newPost.addClass 'dw-m-t-new'
    replaceOldWith $newPost, onPage: pageId

    $newPost.each d.i.$initPost

    $newThread = $newPost.dwClosestThread!
    $newThread.each d.i.SVG.$drawTree
    $newThread.dwFindPosts!.each d.i.SVG.$drawParents

  result.patchedPosts.push $newThread



addMessageToPost = (message, $post) ->
  $post.prepend $(
      '<div class="dw-p-pending-mod">' + message + '</div>')


insertThread = ($thread, { after }) ->
  $pervSibling = after
  if $pervSibling.parent!is 'li'
    # Horizontal layout. Threads are wrapped in <li>s (with
    # display: table-cell).
    $thread = $('<li></li>').append $thread
    $pervSibling = $pervSibling.parent!
  $pervSibling.after $thread



appendThread = ($thread, { to }) ->
  $parent = to
  $childList = $parent.children '.dw-res'
  if !$childList.length
    # This is the first child thread; create empty child thread list.
    $childList = $("<ol class='dw-res'/>").appendTo $parent
  if $parent.is '.dw-hor'
    # Horizontal layout, see comment in `insertThread` above.
    $thread = $('<li></li>').append $thread
  $thread.appendTo $childList


replaceOldWith = ($new, { onPage }) ->
  # WOULD verify that $new is located `onPage`, if in the future it'll be
  # possible to edit e.g. blog posts from a blog post list page.
  $('#' + $new.attr 'id').replaceWith $new


# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
