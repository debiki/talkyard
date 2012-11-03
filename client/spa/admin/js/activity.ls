# Copyright (c) 2012 Kaj Magnus Lindberg. All rights reserved

import prelude
d = i: debiki.internal, u: debiki.v0.util
bug = d.u.die2



@ActionListCtrl = ['$scope', 'AdminService', ($scope, adminService) ->

  mixinInfoListCommon $scope, 'actionList'

  doInlineAction = (adminServiceFn, actionRows, doneMessage) ->
    for row in actionRows
      row <<< inlineBtnToggledAllOff!
      row.inlineMessage = 'Wait...'
    adminServiceFn actionRows, ->
      for row in actionRows
        row.inlineMessage = doneMessage

  $scope.approve = (actionRow) ->
    doInlineAction adminService.approve, [actionRow], 'Approved.'

  $scope.reject = (actionRow) ->
    doInlineAction adminService.reject, [actionRow], 'Rejected.'

  $scope.delete = (actionRow) ->
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

  # On page load, list the most recent actions, for all pages.
  updateActionList { trees: ['/'] }

  ]



/**
 * Common functionality for ActionListCtrl, UserListCtrl and (in the future)
 * PageListCtrl.
 */
function mixinInfoListCommon($scope, infoListName)

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
    | '1' => 'Page'
    | '2' => 'Page title'
    | '3' => 'Page config'
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
  { approveBtnText: null, showRejectBtn: false }

function inlineBtnTogglersForPost(post)
  switch post.status
  | 'NewPrelApproved' \
    'EditsPrelApproved' => { approveBtnText: 'Okay', showRejectBtn: true }
  | 'New' \
    'NewEdits' => { approveBtnText: 'Approve', showRejectBtn: true }
  | _ => {}



# For now, for the test suite:
test = debiki.test || {}
# test.someFunctionToTest = someFunctionToTest


# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
