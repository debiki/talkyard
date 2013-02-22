# Copyright (c) 2012 Kaj Magnus Lindberg. All rights reserved

d = i: debiki.internal, u: debiki.v0.util
$ = d.i.$;


debugIntervalHandler = null
debugDrawReadingProgress =
    -1 != location.toString!search '&debug-reading-progress=true'


# Should be inited with data from server.
statsByPostId = {}

postsVisibleLastTick = {}

charsReadPerSecond = 40
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
maxConfusionSeconds = -1.5


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
      stats = { postId, fractionRead: 0.0 }
      statsByPostId[postId] = stats

    if stats.hasBeenRead
      return

    stats.textLength ?= $postBody.text!replace(/\s/g, '').length

    visibleUnreadPostsStats.push stats
    numVisibleUnreadChars += stats.textLength


  # Avoid division by 0.
  if numVisibleUnreadChars == 0
    return


  # Count num posts scrolled into viewport.

  numPostsScrolledIntoViewport = 0
  for stats in visibleUnreadPostsStats
    numPostsScrolledIntoViewport += 1 unless postsVisibleLastTick[stats.postId]

  postsVisibleLastTick := postsVisibleThisTick


  # Estimate how many seconds the user spent reading stuff.

  secondsSpentReading +=
    secondsBetweenTicks -
    numPostsScrolledIntoViewport * secondsLostPerNewPostInViewport

  # This cannot happen? Anyway:
  if secondsBetweenTicks < secondsSpentReading
    secondsSpentReading := secondsBetweenTicks

  if secondsSpentReading < maxConfusionSeconds
    secondsSpentReading := maxConfusionSeconds

  # See explanation below.
  fractionReadSinceLastTick = max(0,
      charsReadPerSecond * secondsSpentReading / numVisibleUnreadChars)


  # Update reading stats for the posts viewed.

  for stats in visibleUnreadPostsStats

    ## Re "See explanation below" just above: This:
    # attentionSpentOnThisPost =
    #     stats.textLength / numVisibleUnreadChars
    # fractionReadSinceLastTick =
    #     charsReadPerSecond * secondsSpentReading * attentionSpentOnThisPost
    #     / stats.textLength
    ## Is the same as the-expression-above-that-requires-an-explanation.

    stats.fractionRead += fractionReadSinceLastTick

    if stats.fractionRead >= 1.0
      stats.hasBeenRead = true
      # COULD post message to the server, so it knows that yet another
      # person seems to have read the related $post.

    if debugDrawReadingProgress
      outlineThickness = max(0, ceiling(7 * (1 - stats.fractionRead)))
      colorChange = ceiling(100 * (1 - stats.fractionRead))
      redColor = (155 + colorChange).toString 16
      otherColor = colorChange.toString 16
      color = '#' + redColor + otherColor + otherColor
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
