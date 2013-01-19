# Copyright (c) 2012 Kaj Magnus Lindberg. All rights reserved

d = i: debiki.internal, u: debiki.v0.util
$ = d.i.$;


$('.dw-a-new-forum-topic').click !->
  # Create a new forum thread. Publish it directly, that's how
  # forums usually work?
  d.i.createChildPage pageRole: 'ForumThread', status: 'Published'


# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
