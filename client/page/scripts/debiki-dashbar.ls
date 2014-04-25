/* Shows admin/moderator buttons at the top of the page.
 * Copyright (C) 2012 - 2013 Kaj Magnus Lindberg (born 1979)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

d = i: debiki.internal, u: debiki.v0.util
$ = d.i.$;


DebikiDashbarModule = angular.module('DebikiDashbarModule', [])


DebikiDashbarModule.directive 'dwDashbar', ['$http', dwDashbar]


function dwDashbar ($http)
  template: """
    <div ng-show="currentUser.isAuthenticated">
      <a class="debiki-dashbar-logo" href="#{d.i.serverOrigin}/-/admin/">
        <img src="#{d.i.serverOrigin}/-/img/logo-128x120.png">
      </a>
      <span ng-show="!viewsPageConfigPost">

        <a ng-show="pageRole == 'Blog'" class="create-blog-post">
          Write new blog post
        </a>

        <span ng-show="pageRole == 'BlogPost'">
          <a class="return-to-blog">
            Return to blog main page
          </a>

          <span ng-show="pageExists">
            <a ng-show="pageStatus == 'Draft'" class="publish-page">
              Publish this blog post
            </a>
            <a ng-show="pageStatus == 'Published'" class="unpublish-page">
              Unpublish
            </a>
          </span>
        </span>

        <a ng-show="pageExists && isWwwDebikiComOrLocalhost()"  class="page-settings">
          View page settings
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
        d.i.createChildPage { pageRole: 'BlogPost', status: 'Draft' }, window

    pageSettingsBtn = element.find('a.page-settings')
    pageSettingsBtn.click !-> viewPageSettings!

    returnToPageBtn = element.find('a.return-to-page')
    returnToPageBtn.click !-> returnToPage!

    returnToBlogBtn = element.find '.return-to-blog'
    returnToBlogBtn.click !->
      # This redirects to the blog main page.
      window.location = "/-#{scope.parentPageId}"

    publishPageBtn = element.find('a.publish-page')
    publishPageBtn.click !-> changePageMeta { newStatus: 'Published' }

    unpublishPageBtn = element.find('a.unpublish-page')
    unpublishPageBtn.click !-> changePageMeta { newStatus: 'Draft' }

    scope.isWwwDebikiComOrLocalhost = ->
      console.log 'rint'
      window.location.toString().search(/http:..localhost|http:..www.debiki.com/) != -1

    # Warning: Dupl code. See `createThisPageUnlessExists` in debiki-forum.ls.
    !function createThisPageUnlessExists (onSuccess)
      if scope.pageExists
        onSuccess!
        return
      pageMeta = thisPageMeta scope
      newPageData = createPagesUnlessExist: [pageMeta]
      $http.post "#{d.i.serverOrigin}/-/edit", newPageData
          .success !->
            scope.pageExists = true  # edits root scope? Or local scope?
            d.i.forEachOpenerCall 'onOpenedPageSavedCallbacks', [pageMeta]
            onSuccess!

    !function changePageMeta ({ newStatus })
      pageMeta = thisPageMeta scope
      $http.post(
          "#{d.i.serverOrigin}/-/change-page-meta",
          [{ pageId: pageMeta.pageId, newStatus }])
        .success !->
          scope.pageStatus = newStatus
        .error !->
          alert 'Error changing page meta [error DwE57KR21]'


!function viewPageSettings
  # For now. In the future, could open modal dialog on same page instead?
  # But would then need to refresh page when dialog closed?
  # ((If the user is editing something, a 'Really close page?' dialog
  # is popped up by some other module.))
  window.location = window.location.pathname + '?view=65503'



!function returnToPage
  window.location = window.location.pathname



function thisPageMeta (scope)
  return
    passhash: d.i.parsePasshashInPageUrl!
    newPageApproval: d.i.parseApprovalInPageUrl!
    pageId: scope.pageId
    pagePath: scope.pagePath
    pageRole: scope.pageRole
    pageStatus: scope.pageStatus
    parentPageId: scope.parentPageId



# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
