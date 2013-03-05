# Copyright (c) 2010 - 2012 Kaj Magnus Lindberg. All rights reserved.  

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
    uncollapseReplies $parent.closest '.dw-t'
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
      loadAndInsertThread $thread
  else
    # Fold thread.
    postCount = $thread.find('.dw-p').length
    $childrenToFold.each(d.i.$slideUp).queue !(next) ->
      $foldLink.text "Click to show #postCount posts" # COULD add i18n
      $thread.addClass 'dw-zd'
      next!



!function uncollapsePost ($post)
  loadAndInsert $post, { url: '/-/load-posts' }



!function uncollapseReplies ($thread)
  # Fist remove the un-collapse button.
  $replies = $thread.children('.dw-res.dw-zd').dwBugIfEmpty('DwE3BKw8')
  $replies.removeClass('dw-zd').children('li').remove!
  loadAndInsert $thread, { url: '/-/load-replies' }



!function loadAndInsertThread ($thread)
  loadAndInsert $thread, { url: '/-/load-threads' }


/**
 * Loads and inserts $what, which should be a thread or a post.
 */
!function loadAndInsert ($what, { url })
  postId =
    if $what.is '.dw-p' => $what.dwPostId!
    else $what.dwChildPost!dwPostId!
  data = [{ pageId: d.i.pageId, actionId: postId }]
  d.u.postJson { url, data }
      .fail d.i.showServerResponseDialog
      .done !(patches) ->
        result = d.i.patchPage patches
        (result.patchedThreads[0] || result.patchedPosts[0])
            .dwScrollIntoView!



# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
