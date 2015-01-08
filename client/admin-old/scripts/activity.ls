/* AngularJS controller for the admin dashboard Activity tab.
 * Copyright (C) 2012-2013 Kaj Magnus Lindberg (born 1979)
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


import prelude
d = i: debiki.internal, u: debiki.v0.util
bug = d.u.die2



@ActionListCtrl = ['$scope', 'AdminService', ($scope, adminService) ->

  d.i.mixinInfoListCommon $scope, 'actionList'

  $scope.smallScreen = deviceScreenIsSmall!

  doInlineAction = (adminServiceFn, actionRows, doneMessage) ->
    for row in actionRows
      row <<< inlineBtnToggledAllOff!
      row.inlineMessage = 'Wait...'
    adminServiceFn actionRows, ->
      for row in actionRows
        row.inlineMessage = doneMessage

  $scope.approve = !(actionRow) ->
    doInlineAction adminService.approve, [actionRow], 'Approved.'

  $scope.reject = !(actionRow) ->
    doInlineAction adminService.reject, [actionRow], 'Rejected.'

  $scope.delete = !(actionRow) ->
    doInlineAction adminService.delete, [actionRow], 'Deleted.'

  updateActionList = (treesFoldersPageIds) ->
    adminService.listActions treesFoldersPageIds, (data) ->
      # Add author name info to the action list, and update $scope.
      usersById = {}
      for user in data.users => usersById[user.id] = user
      $scope.actionList = []
      for action in data.actions
        pagePath = adminService.getPageById(action.pageId)?.path || '(new page)'
        user = usersById[action.userId]

        # Ignore the site config page, it's confusing and dangerous.
        # (Weird, sometimes `pagePath == '/_site.conf'` doesn't work, so add another test too.
        if pagePath == '/_site.conf' || user.displayName == 'System'
          continue

        actionWithDetails = {} <<< action
        actionWithDetails <<<
            authorId: user.id
            authorDisplayName: user.displayName
            pagePath: pagePath
        if action.type is 'Post'
          actionWithDetails.url = urlToPost(action)
          actionWithDetails.description = describePost(action)
          #actionWithDetails <<< infoOnFlags(action)
          actionWithDetails <<< inlineBtnTogglersForPost(actionWithDetails)
        $scope.actionList.push actionWithDetails
      return

  adminService.onPathSelectionChange updateActionList

  $scope.postTextOrDiff = (post) ->
    htmlDiff = -> d.i.makeHtmlDiff post.approvedText, post.unapprovedText
    switch post.status
    | 'New' => escapeHtml post.unapprovedText
    | 'NewPrelApproved' \
      'Approved' => escapeHtml post.approvedText
    | 'Rejected' =>
        # Sometimes `unapprovedText` is undefined, nevertheless the post was rejected.
        escapeHtml post.unapprovedText || post.approvedText
    | 'EditsRejected' \
      'EditsPrelApproved' \
      'NewEdits' => htmlDiff()
    | _ => die 'DwE38RUJ0'



  # On page load, list the most recent actions, for all pages.
  adminService.listAllPages !->  # temp fix: but wait until page info loaded
    updateActionList { trees: ['/'] }

  ]



# COULD move to some debiki-common.js or debiki-utils.js?
function escapeHtml (html)
  html
   .replace(/&/g, "&amp;")
   .replace(/</g, "&lt;")
   .replace(/>/g, "&gt;")
   # Could also replace ' and " if needs to escape attribute value.



/**
 * Common functionality for ActionListCtrl, UserListCtrl and (in the future)
 * PageListCtrl.
 */
# COULD move to shared utility file?
d.i.mixinInfoListCommon = !($scope, infoListName) ->

  $scope.toggleAllChecked = ->
    for info in $scope[infoListName]
      info.selected = $scope.allSelected

  $scope.onRowCheckedChange = ->
    updateToggleAllCheckbox!
    updateCheckedRowsCounts!

  updateToggleAllCheckbox = ->
    $scope.allSelected = true
    for info in $scope[infoListName]
      $scope.allSelected and= info.selected

  updateCheckedRowsCounts = ->
    checkedRowsCount = filter (.selected), $scope[infoListName] |> (.length)
    $scope.oneRowChecked = checkedRowsCount == 1
    $scope.manyRowsChecked = checkedRowsCount >= 1



function urlToPost(post)
  queryStr = if post.id == 2 then '?view=template' else ''
  actionPath = '/-' + post.pageId + queryStr + '#post-' + post.id



function describePost(post)
  what = switch post.id
    | "#{d.i.TitleId}" => 'Page title'
    | "#{d.i.BodyId}" => 'Page'
    | '65503' => 'Page config'
    | _   => 'Comment'

  switch post.status
  | 'New' => "New #{what.toLowerCase!}"
  | 'NewPrelApproved' => "New #{what.toLowerCase!}, prel. approved"
  | 'Approved' => what
  | 'Rejected' => "#what, rejected"
  | 'EditsRejected' => "#what, edits rejected"
  | 'NewEdits' => "#what, edited"
  | 'EditsPrelApproved' => "#what, edits prel. approved"
  | _ => "#what, #{post.status}"



# Currently not much info on flags is stored in DW1_POSTS so this is
# currently not possible:
/*
function infoOnFlags(action)
  if action.numPendingFlags > 0
    prettyFlags: 'PRETTYFLAGS'  # examine action.flagCountsByReason
  else
    {} */



function inlineBtnToggledAllOff
  approveBtnText: null
  showRejectBtn: false
  showViewSuggsLink: false

function inlineBtnTogglersForPost(post)
  showNewFlagsLink = post.numPendingFlags > 0
  showOldFlagsLink = post.numHandledFlags > 0

  switch post.status
  | 'NewPrelApproved' \
    'EditsPrelApproved' => {
      approveBtnText: 'Okay',
      showRejectBtn: true,
      showViewSuggsLink: false,
      showNewFlagsLink,
      showOldFlagsLink }
  | 'New' \
    'NewEdits' => {
      approveBtnText: 'Approve',
      showRejectBtn: true,
      showViewSuggsLink: false,
      showNewFlagsLink,
      showOldFlagsLink }
  | _ =>
    if post.numPendingEditSuggestions > 0 => {
      showViewSuggsLink: true,
      showNewFlagsLink,
      showOldFlagsLink }
    else {}



function deviceScreenIsSmall
  win = $(window)
  max(win.width!, win.height!) < 600



# For now, for the test suite:
test = debiki.test || {}
# test.someFunctionToTest = someFunctionToTest


# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
