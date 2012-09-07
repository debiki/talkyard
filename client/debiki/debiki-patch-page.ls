/* Copyright (c) 2010 - 2012 Kaj Magnus Lindberg. All rights reserved. */

d = i: debiki.internal, u: debiki.v0.util
$ = d.i.$;


d.i.patchPage = (patches) ->
  result = newThreads: []

  for newThreadPatch in patches.newThreads
    $newThread = $ newThreadPatch.html
    $prevThread = d.i.findThread$ newThreadPatch.prevThreadId
    $parentThread = d.i.findThread$ newThreadPatch.parentThreadId
    if $prevThread.length
      insertThread $newThread, after: $prevThread
    else if $parentThread.length
      prependThread $newThread, to: $parentThread

    $newThread.addClass 'dw-m-t-new'


    $newThread.dwFindPosts!each d.i.$initPostsThread

    # Avoid float drop, in caze thread added to horizontal list.
    d.i.resizeRootThread!

    # Really both $drawTree, and $drawParents for each child post??

    # (Not $drawPost; $newThread might have child threads.)
    $newThread.each d.i.SVG.$drawTree

    # 1. Draw arrows after post has been inited, because initing it
    # might change its size.
    # 2. If some parent is an inline post, *its* parent might need to be
    # redrawn. So redraw all parents.
    $newThread.dwFindPosts!.each d.i.SVG.$drawParents

    result.newThreads.push $newThread

  result


insertThread = ($thread, { after }) ->
  $pervSibling = after
  $pervSibling.after $thread


prependThread = ($thread, { to }) ->
  $parent = to
  $childList = $parent.children '.dw-res'
  if !$childList.length
    # This is the first child thread; create empty child thread list.
    $childList = $("<ol class='dw-res'/>").appendTo $parent
  $thread.appendTo $childList


# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
