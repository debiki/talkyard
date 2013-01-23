# Copyright (c) 2012 Kaj Magnus Lindberg. All rights reserved

d = i: debiki.internal, u: debiki.v0.util
$ = d.i.$;


DebikiPageModule = angular.module('DebikiPageModule', [])


DebikiPageModule.directive 'dwDashbar', ->
  template: """
    <div ng-show="currentUser.isAuthenticated">
      <a class="debiki-dashbar-logo" href="/-/admin/">
        <img src="/-/img/logo-128x120.png">
      </a>
      <span ng-show="!viewsPageConfigPost">
        <a ng-show="pageExists" class="page-settings">
          View page settings
        </a>
        <a ng-show="pageRole == 'BlogMainPage'" class="create-blog-post">
          Write new blog post
        </a>
      </span>
      <span ng-show="viewsPageConfigPost">
        <a class="return-to-page">
          Return to page
        </a>
      </span>
    </div>
    """

  link: !(scope, element, attrs) ->
    newPageBtn = element.find('a.create-blog-post')
    newPageBtn.click !-> d.i.createChildPage pageRole: 'BlogArticle'

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



# If a child page is to be saved, but this page has not yet been saved, tell
# the child page to save this page first, so the child will have a parent.
# (Otherwise we might attempt to create a blog posts that don't belong to
# any blog.)
d.i.addCreatePageData ?= []
d.i.addCreatePageData.push !(openedPageMeta, createPageData) ->
  d.i.angularApply !(rootScope) ->
    isParentPage = openedPageMeta.parentPageId == rootScope.pageId
    if isParentPage && !rootScope.pageExists
      # Don't Array.push; http://server/-/edit expects parent pages
      # before child pages.
      createPageData.unshift thisPageMeta(rootScope)



d.i.onOpenedPageSavedCallbacks ?= []
d.i.onOpenedPageSavedCallbacks.push !(openedPageMeta, openedPageTitle) ->
  # If this page itself was created when the opened page was saved,
  # any opener of this page does not yet know that this page has been saved.
  # So, if needed, tell any openers that this page has been saved.
  # (For example, the opener could be the admin dashboard, this page could
  # be a blog main page, and `openedPageMeta` could be for a blog post.)
  d.i.angularApply !(rootScope) ->
    isParentPage = openedPageMeta.parentPageId == rootScope.pageId
    return if !isParentPage || rootScope.pageExists
    # A parent page (this page) is always created before child pages, so:
    rootScope.pageExists = true
    d.i.forEachOpenerCall(
        'onOpenedPageSavedCallbacks'
        [thisPageMeta(rootScope)])



function thisPageMeta (rootScope)
  return
    passhash: d.i.parsePasshashInPageUrl!
    pageId: rootScope.pageId
    pagePath: rootScope.pagePath
    pageRole: rootScope.pageRole
    pageStatus: rootScope.pageStatus
    parentPageId: rootScope.parentPageId



# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
