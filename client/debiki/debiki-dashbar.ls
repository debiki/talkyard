# Copyright (c) 2012 Kaj Magnus Lindberg. All rights reserved

d = i: debiki.internal, u: debiki.v0.util
$ = d.i.$;


DebikiPageModule = angular.module('DebikiPageModule', [])


DebikiPageModule.directive 'dwDashbar', ['$http', dwDashbar]


function dwDashbar ($http)
  template: """
    <div ng-show="currentUser.isAuthenticated">
      <a class="debiki-dashbar-logo" href="/-/admin/">
        <img src="/-/img/logo-128x120.png">
      </a>
      <span ng-show="!viewsPageConfigPost">
        <a ng-show="pageExists" class="page-settings">
          View page settings
        </a>
        <a ng-show="pageRole == 'Blog'" class="create-blog-post">
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
    newPageBtn.click !->
      # Create the blog main page before any blog post,
      # or the blog posts would have no parent blog main page.
      createThisPageUnlessExists !->
        # Open new page in this window, so there won't be any
        # old stale blog main page that the user can return to.
        d.i.createChildPage { pageRole: 'BlogPost' }, window

    pageSettingsBtn = element.find('a.page-settings')
    pageSettingsBtn.click !-> viewPageSettings!

    returnToPageBtn = element.find('a.return-to-page')
    returnToPageBtn.click !-> returnToPage!


    # Warning: Dupl code. See `createThisPageUnlessExists` in debiki-forum.ls.
    function createThisPageUnlessExists (onSuccess)
      if scope.pageExists
        onSuccess!
        return
      pageMeta = thisPageMeta scope
      newPageData = createPagesUnlessExist: [pageMeta]
      $http.post '/-/edit', newPageData
          .success !->
            scope.pageExists = true  # edits root scope? Or local scope?
            d.i.forEachOpenerCall 'onOpenedPageSavedCallbacks', [pageMeta]
            onSuccess!



!function viewPageSettings
  # For now. In the future, could open modal dialog on same page instead?
  # But would then need to refresh page when dialog closed?
  # ((If the user is editing something, a 'Really close page?' dialog
  # is popped up by some other module.))
  window.location = window.location.pathname + '?view=3'



!function returnToPage
  window.location = window.location.pathname



function thisPageMeta (scope)
  return
    passhash: d.i.parsePasshashInPageUrl!
    pageId: scope.pageId
    pagePath: scope.pagePath
    pageRole: scope.pageRole
    pageStatus: scope.pageStatus
    parentPageId: scope.parentPageId



# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
