# Copyright (c) 2012 Kaj Magnus Lindberg. All rights reserved

d = i: debiki.internal, u: debiki.v0.util
$ = d.i.$;


# There's a local storage entry, "#pageId-posts-read", that remembers
# which posts one has not yet read.
#
# - On desktop: Unread posts are dimmed (opacity 0.5) and shown
# clerarly on mouse hover. (Also on mobiles right now ... :-(  )
#
# - By clicking 'n'ext and 'p'revious, one can cycle through
# unread posts, by date. (Not implemented?)
#
# - On mouseover, a post is considered red.
# (This might seem a bit crazy! Perhaps it'd be better if one
# had to do a quick extremely simple mouse guesture, so one won't
# accidentally mark posts as read — perhaps moving the mouse straight
# downwards through the post header? And on touch devises, perhaps
# everything on screen should be marked as read, automatically.)
#
# - To mark something as *un*read, one can click a little
# toggle-read/unread symbol. (Not implemented.)


postUnreadSymbol = '●'          # new post, unread
postAutoReadSymbol = '○'        # auto-made-read (currently on mouseover)
postManuallyUnreadSymbol = '■'  # clicked unread (manually toggled)
postManuallyReadSymbol = '□'    # clicked read
# postManuallyStarredSymbol = '★'

postUnreadTag = "<a class='dw-cycle-mark'>#postUnreadSymbol</a>"


d.i.startNextUnreadPostCycler = !->

  return unless Modernizr.localstorage

  pageId = $('.dw-page').dwPageMeta!.pageId
  postsReadMem = getReadPostsMemory(pageId)

  # Add a cycle-mark tag, and by default mark all posts (except for the
  # article and title and config post) as unread.
  $posts = $('.dw-p').not('#post-1, #post-2, #post-3')
  $posts.each !->
    $post = $ this
    symbol = postsReadMem[$post.dwPostId!]
    markPostVisually $post, symbol

  # Mark posts read, when scrolled outside the viewport.
  # COULD start a timer when a post is scrolled into viewport, then
  # consider the post read, if it's been on screen longh enough (taking
  # into account total num chars on whole screen) when it's scrolled off
  # screen.
  # COULD consider a post read, if one rates it or replies to it.
  $posts.waypoint(
    horizontal: true
    handler: (direction) ->
      setNewMark $(this), (curSymbol) ->
        # If `curSymbol' exists, the post is one of:
        # - Manually marked as read or unread — this should not change
        #   on mouseover; do nothing.
        # - Already 'RA' (marked as read, automatically, on mouseover),
        #   need do nothing.
        if curSymbol => false
        else postAutoReadSymbol)

  # Toggle read/unread on read/unread symbol click.
  $posts.parent!children('.dw-cycle-mark').click !->
    $post = $(this).parent().children('.dw-p')
    setNewMark $post, (curSymbol) ->
      switch curSymbol
        | postManuallyUnreadSymbol => postManuallyReadSymbol
        | _ => postManuallyUnreadSymbol

  function setNewMark ($post, deriveSymbolFn)
    postId = $post.dwPostId!
    curSymbol = postsReadMem[postId]
    newSymbol = deriveSymbolFn(curSymbol)
    return unless newSymbol
    markPostVisually $post, newSymbol
    postsReadMem[postId] = newSymbol
    saveReadPostsmemory pageId, postsReadMem



!function markPostVisually ($post, newSymbol)

  switch newSymbol
  | postAutoReadSymbol => $post.removeClass 'dw-p-unread'
  | _ => $post.addClass 'dw-p-unread'

  setMark newSymbol

  !function setMark (symbol)
    markTag = $post.parent().children('.dw-cycle-mark')
    unless markTag.length
      markTag = $(postUnreadTag).insertBefore $post
    markTag.text symbol
    # Remove all classes
    markTag.removeClass!
    # Add back:
    markTag.addClass 'dw-cycle-mark'
    # Add new, e.g. 'dw-cycle-mark-RA':
    markTag.addClass 'dw-cycle-mark-' + symbol



function getReadPostsMemory (pageId)
  json = localStorage[storageKey(pageId)] || '{}'
  JSON.parse json



!function saveReadPostsmemory (pageId, readMem)
  json = JSON.stringify readMem
  localStorage[storageKey(pageId)] = json



function storageKey (pageId)
  "com.debiki.postsRead.#pageId"



# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
