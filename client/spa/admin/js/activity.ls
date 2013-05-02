# Copyright (c) 2012-2013 Kaj Magnus Lindberg. All rights reserved

import prelude
d = i: debiki.internal, u: debiki.v0.util
bug = d.u.die2



@ActionListCtrl = ['$scope', 'AdminService', ($scope, adminService) ->

  d.i.mixinInfoListCommon $scope, 'actionList'

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
        actionWithDetails = {} <<< action
        actionWithDetails <<<
            authorId: user.id
            authorDisplayName: user.displayName
            pagePath: pagePath
        if action.type is 'Post'
          actionWithDetails.url = urlToPost(action)
          actionWithDetails.description = describePost(action)
          actionWithDetails <<< inlineBtnTogglersForPost(action)
        $scope.actionList.push actionWithDetails
      return

  adminService.onPathSelectionChange updateActionList

  $scope.postTextOrDiff = (post) ->
    htmlDiff = -> d.i.makeHtmlDiff post.approvedText, post.unapprovedText
    switch post.status
    | 'New' => post.unapprovedText
    | 'NewPrelApproved' \
      'Approved' => post.approvedText
    | 'Rejected' => post.unapprovedText
    | 'EditsRejected' \
      'EditsPrelApproved' \
      'NewEdits' => htmlDiff()
    | _ => die 'DwE38RUJ0'


  # On page load, list the most recent actions, for all pages.
  adminService.listAllPages !->  # temp fix: but wait until page info loaded
    updateActionList { trees: ['/'] }

  ]



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
    | '65501' => 'Page title'
    | '65502' => 'Page'
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



function inlineBtnToggledAllOff
  approveBtnText: null
  showRejectBtn: false
  showViewSuggsLink: false

function inlineBtnTogglersForPost(post)
  switch post.status
  | 'NewPrelApproved' \
    'EditsPrelApproved' =>
      approveBtnText: 'Okay'
      showRejectBtn: true
      showViewSuggsLink: false
  | 'New' \
    'NewEdits' =>
      approveBtnText: 'Approve'
      showRejectBtn: true
      showViewSuggsLink: false
  | _ =>
    if post.numPendingEditSuggestions > 0 =>
      showViewSuggsLink: true
    else {}



# For now, for the test suite:
test = debiki.test || {}
# test.someFunctionToTest = someFunctionToTest


# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
