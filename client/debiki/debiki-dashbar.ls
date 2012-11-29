# Copyright (c) 2012 Kaj Magnus Lindberg. All rights reserved

d = i: debiki.internal, u: debiki.v0.util
$ = d.i.$;


/**
 * Opens a new unsaved page in a new browser tab.
 */
createNewPage = !->
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
  $.getJSON(getViewNewPageUrl).done ({ viewNewPageUrl }) ->
    # Add page meta to new-page-URL, so the server knows that it should
    # create a blog article.
    viewNewPageUrl += '&page-role=BlogArticle'
    viewNewPageUrl += '&parent-page-id=' + d.i.pageId if d.i.pageId
    newTab.location = viewNewPageUrl



DebikiPageModule = angular.module('DebikiPageModule', [])



DebikiPageModule.directive 'dwDashbar', ->
  template: """
    <div ng-show="currentUser.isAuthenticated">
      <a class="debiki-dashbar-logo" href="/-/admin/">
        <img src="/-/site/img/logo-128x120.png">
      </a>
      <span ng-show="pageExists && !viewsPageConfigPost">
        <a class="page-settings">
          View page settings
        </a>
        <a ng-show="pageRole == 'BlogMainPage'" class="new-page">
          Write new blog post
        </a>
      </span>
      <span ng-show="viewsPageConfigPost">
        <a class="return-to-page">
          Return to page
        </a>
    </div>
    """

  link: !(scope, element, attrs) ->
    newPageBtn = element.find('a.new-page')
    newPageBtn.click !-> createNewPage!

    pageSettingsBtn = element.find('a.page-settings')
    pageSettingsBtn.click !-> viewPageSettings!

    returnToPageBtn = element.find('a.return-to-page')
    returnToPageBtn.click !-> returnToPage!



!function viewPageSettings
  # For now. In the future, could open modal dialog on same page instead?
  # But would then need to refresh page when dialog closed?
  # ((If the user is editing something, a 'Really close page?' dialog
  # is popped up by some other module.))
  window.location = window.location.pathname + '?view=3'



!function returnToPage
  window.location = window.location.pathname



# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
