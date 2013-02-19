# Copyright (c) 2012 Kaj Magnus Lindberg. All rights reserved

d = i: debiki.internal, u: debiki.v0.util
$ = d.i.$;



d.i.layoutThreads = !->

  # Increase width if there are many replies.
  for thread in $('.dw-t.dw-depth-1')
    maxNesting = findMaxNesting thread
    width = 330 + maxNesting * 20
    width = min 440, width
    $(thread).css 'width', width + 'px'



function findMaxNesting (thread)
  $children = $(thread).find '> .dw-res > .dw-t'
  # If passing $children to `fold` when `$children.length == 1`,
  # it seems as if `fold` wraps jQuery in an array, resulting
  # in eternal recursion.
  children = $children.toArray!
  if empty children
    0
  else
    fold ((a, b) -> max(a, 1 + findMaxNesting b)), 0, children



# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
