# Copyright (c) 2012 Kaj Magnus Lindberg. All rights reserved

d = i: debiki.internal, u: debiki.v0.util
$ = d.i.$;


$ ->

  /**
   * Opens a new unsaved page in a new browser tab.
   */
  $('#debiki-dashbar a.new-page').click ->
    # Open new tab directly in response to user click, or browser popup
    # blockers tend to block the new tab.
    newTab = window.open '', '_blank'

    # Ask the server to generate a page id, and a link where we can view the
    # new unsaved page. Then open that page in `newTab`.
    getViewNewPageUrl =
        window.location +
        '?get-view-new-page-url' +
        '&page-slug=new-blog-post' +
        '&show-id=t'
    $.getJSON(getViewNewPageUrl).done ({ viewNewPageUrl }) ->
      # Add page meta to new-page-URL, so the server knows that it should
      # create a blog article.
      viewNewPageUrl += '&page-role=BlogArticle'
      viewNewPageUrl += '&parent-page-id=' + d.i.pageId if d.i.pageId
      newTab.location = viewNewPageUrl



# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
