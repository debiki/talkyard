# Copyright (c) 2012 Kaj Magnus Lindberg. All rights reserved

d = i: debiki.internal, u: debiki.v0.util
$ = d.i.$;


$('.dw-a-new-forum-thread').click !->
  d.i.createChildPage pageRole: 'ForumThread'


# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
