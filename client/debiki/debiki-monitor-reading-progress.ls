# Copyright (c) 2012 Kaj Magnus Lindberg. All rights reserved

d = i: debiki.internal, u: debiki.v0.util
$ = d.i.$;


debugIntervalHandler = null
debugDrawReadingProgress =
    -1 != location.toString!search '&debug-reading-progress=true'


# Should be inited with data from server.
statsByPostId = {}

postsVisibleLastTick = {}

charsReadPerSecond = 35

# Assume readers only skim the start of every post. Otherwise a very
# long comment would in effect make the computer believe the reader didn't
# read anything at all.
maxCharsReadPerPost = charsReadPerSecond * 4.5

secondsBetweenTicks =
  if debugDrawReadingProgress => 0.25
  else 2

# If < 0, the user just scrolled lots of new post into view,
# and then it takes a while to choose which ones to read.
secondsSpentReading = 0

# How long it takes for the reader to "recuperate" after having scrolled
# a new posts into view — then one needs to decide whether or not to start
# reading it, which incurs a time loss.
secondsLostPerNewPostInViewport = 0.5

# `secondsLostPerNewPostInViewport` is capped to this value.
maxConfusionSeconds = -1


d.i.startReadingProgresMonitor = !->
  debugIntervalHandler :=
      setInterval monitorReadingProgress, secondsBetweenTicks * 1000


!function monitorReadingProgress

  visibleUnreadPostsStats = []
  numVisibleUnreadChars = 0
  postsVisibleThisTick = {}

  # Find posts that the user might be viewing (= reading, we assume).

  $('.dw-p').each !->

    $post = $ this
    $postBody = $post.children '.dw-p-bd'
    if !$postBody.length || !isInViewport($postBody)
      return

    postId = $post.dwPostId!

    postsVisibleThisTick[postId] = true

    stats = statsByPostId[postId]
    if !stats
      stats = { postId, charsRead: 0 }
      statsByPostId[postId] = stats

    if stats.hasBeenRead
      return

    stats.textLength ?= $postBody.text!replace(/\s/g, '').length

    visibleUnreadPostsStats.push stats
    numVisibleUnreadChars += stats.textLength


  # Count num posts scrolled into viewport.

  numPostsScrolledIntoViewport = 0
  for stats in visibleUnreadPostsStats
    numPostsScrolledIntoViewport += 1 unless postsVisibleLastTick[stats.postId]

  postsVisibleLastTick := postsVisibleThisTick


  # Estimate how many chars the user might have read since the last tick.

  secondsSpentReading +=
    secondsBetweenTicks -
    numPostsScrolledIntoViewport * secondsLostPerNewPostInViewport

  # This cannot happen? Anyway:
  if secondsBetweenTicks < secondsSpentReading
    secondsSpentReading := secondsBetweenTicks

  # This happens if fairly many posts are scrolled into view.
  if secondsSpentReading < maxConfusionSeconds
    secondsSpentReading := maxConfusionSeconds

  charsReadThisTick = max(0, charsReadPerSecond * secondsSpentReading)
  charsLeftThisTick = charsReadThisTick


  # Update reading stats for the posts viewed. Assume they're
  # being read in depth first traversal. (COULD be better to assume
  # that replies to the root post are read first — then depth first
  # traversal? But that's more complicated.)

  for stats in visibleUnreadPostsStats

    charsToRead = min maxCharsReadPerPost, stats.textLength
    charsReadNow = min charsLeftThisTick, charsToRead - stats.charsRead
    charsLeftThisTick -= charsReadNow
    stats.charsRead += charsReadNow

    if stats.charsRead >= charsToRead
      stats.hasBeenRead = true
      # COULD post message to the server, so it knows that yet another
      # person seems to have read the related $post.

    if debugDrawReadingProgress
      fractionRead = if !charsToRead => 1.0 else stats.charsRead / charsToRead
      fractionLeft = 1.0 - fractionRead
      outlineThickness = max(0, ceiling(7 * fractionLeft))
      colorChange = ceiling(100 * fractionLeft)
      redColor = (155 + colorChange).toString 16
      greenColor = colorChange.toString 16
      blueColor = (80 + 100 * fractionRead).toString 16
      color = '#' + redColor + greenColor + blueColor
      $bookmark = $('#post-' + stats.postId).parent!children '.dw-cycle-mark'
      $bookmark.css 'outline', "#{outlineThickness}px #color solid"

      if stats.hasBeenRead
        $bookmark.css 'outline', '2px blue solid'



/**
 * Customized is-in-viewport test to find out if a post, or at least
 * the start of it, is visible. Takes mobile phones into account: If the
 * post spans the whole viewport (from top to bottom) it's considered
 * visible.
 */
function isInViewport $postBody
  myOffs = $postBody.offset!
  myTop = myOffs.top
  myBottomAlmost = myTop + min($postBody.height!, 600)
  myLeft = myOffs.left;
  myRight = myLeft + $postBody.width!

  $win = $ window
  winTop = $win.scrollTop!
  winHeight = $win.height!
  winBottom = winTop + winHeight
  winLeft = $win.scrollLeft!
  winWidth = $win.width!
  winRight = winLeft + winWidth

  inViewportY = winTop <= myTop && myBottomAlmost <= winBottom
  inViewportX = winLeft <= myLeft && myRight <= winRight

  spansViewportY = myTop <= winTop && winBottom <= myBottomAlmost

  (inViewportY || spansViewportY) && inViewportX



# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
