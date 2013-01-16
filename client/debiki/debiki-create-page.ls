# Copyright (c) 2012 Kaj Magnus Lindberg. All rights reserved

d = i: debiki.internal, u: debiki.v0.util
$ = d.i.$;


/**
 * Opens a new unsaved page in a new browser tab.
 */
d.i.createChildPage = !({ pageRole, parentPageId }) ->
  # Open new tab directly in response to user click, or browser popup
  # blockers tend to block the new tab.
  newTab = window.open '', '_blank'

  # We'll create the new page in the same folder as the current page.
  # (?get-view-new-page-url works with folders only.)
  folder = d.i.parentFolderOfPage window.location.pathname

  # Ask the server to generate a page id, and a link where we can view the
  # new unsaved page. Then open that page in `newTab`.
  getViewNewPageUrl =
      folder +
      '?get-view-new-page-url' +
      '&page-slug=new-blog-post' +
      '&show-id=t'
  $.getJSON(getViewNewPageUrl).done !({ viewNewPageUrl }) ->
    # Add page meta to new-page-URL, so the server knows that it should
    # create e.g. a blog article.
    viewNewPageUrl += '&page-role=' + pageRole
    parentPageId = d.i.pageId if !parentPageId
    viewNewPageUrl += '&parent-page-id=' + parentPageId if parentPageId
    newTab.location = viewNewPageUrl



# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
