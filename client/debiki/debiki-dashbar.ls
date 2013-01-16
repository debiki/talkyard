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



# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
