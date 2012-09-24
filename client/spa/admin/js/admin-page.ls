# Copyright (c) 2012 Kaj Magnus Lindberg. All rights reserved

import prelude
bug = debiki.v0.util.die2


AdminModule = angular.module('AdminModule', [])



AdminModule.filter 'filterProp', ->
  (inputs, propName, textToMatch) ->
    [i for i in inputs when i[propName].search(textToMatch) >= 0]



AdminModule.factory 'AdminService', ['$http', ($http) ->

  pagesById = {}
  api = {}
  selectedPathsListeners = []

  api.selectPaths = (treesFoldersPageIds) ->
    for listener in selectedPathsListeners
      listener(treesFoldersPageIds)

  api.onPathSelectionChange = (listener) ->
    selectedPathsListeners.push listener

  api.getPageById = (pageId) ->
    if pagesById == {} then api.listAllPages -> 'noop'
    pagesById[pageId]

  api.listAllPages = (onSuccess) ->
    $http.get('/?list-pages.json&in-tree').success (data) ->
      # Angular has already parsed the JSON.
      for page in data.pages
        pagesById[page.id] = page
      onSuccess(data)

  api.listActions = (treesFoldersPageIds, onSuccess) ->
    treesStr   = treesFoldersPageIds.trees?.join(',') || ''
    foldersStr = treesFoldersPageIds.folders?.join(',') || ''
    pageIdsStr = treesFoldersPageIds.pageIds?.join(',') || ''
    $http.get("/?list-actions.json" +
        "&in-trees=#treesStr" +
        "&in-folders=#foldersStr" +
        "&for-pages=#pageIdsStr").success (data) ->
      onSuccess data

  actionsToJsonObjs = (actions) ->
    toJsonObj = (action) -> { pageId: action.pageId, actionId: action.id }
    map toJsonObj, actions

  api.approve = (actions, onSuccess) ->
    $http.post '/-/approve', actionsToJsonObjs(actions)
        .success -> onSuccess!

  api.reject = (actions, onSuccess) ->
    $http.post '/-/reject', actionsToJsonObjs(actions)
        .success -> onSuccess!

  api.delete = (actions, onSuccess) ->
    onSuccess! # for now

  api.createPage = (folder, callback) ->
    $http.post(folder + '?create-page',
        'page-title': 'Title'
        'page-slug': 'title'
        'show-id': true).success (data) ->
          callback data.newPage

  api.movePages = (pageIds, {fromFolder, toFolder, callback}) ->
    /*
    $http.post '?move-pages',
        { pageIds: [pageId], fromFolder: fromFolder, toFolder: toFolder ] },
        success ->
          callback!
       */
    # for now:
    callback!

  api

  ]



@PathsCtrl = ['$scope', 'AdminService', ($scope, adminService) ->

  const DRAFTS_FOLDER = '/.drafts/'

  /**
   * Creates a new page and opens it in a new browser tab.
   */
  $scope.createPage = ->
    # Open new tab directly, in direct response to the user-initiated event,
    # or the browser's pop-up blocker tends to blocks it.
    newBrowserPage = window.open 'about:blank', '_blank'
    now = new Date!
    folder = '/' +
        padNumberToLength2(now.getFullYear!) + '/' +
        padNumberToLength2(now.getMonth!) + '/' +
        padNumberToLength2(now.getDate!) + '/'
    adminService.createPage folder, (newPage) ->
      newBrowserPage.location = newPage.path
      newPage.mark = 'New'
      listOneMorePage newPage


  $scope.moveSelectedPage = ->
    bug('DwE90K2') if selectedPageListItems.length != 1
    pageListItem = selectedPageListItems[0]
    # COULD rename `value` to `path`
    window.open <| pageListItem.value + '?move-page'


  $scope.publishSelectedPages = ->
    refreshPageList = ->
      for pageListItem in selectedPageListItems
        pageListItem.value .= replace DRAFTS_FOLDER, '/'
        pageListItem.displayPath .= replace DRAFTS_FOLDER, '/'
      redrawPageList!

    for pageListItem in selectedPageListItems
      adminService.movePages [pageListItem.pageId],
          fromFolder: DRAFTS_FOLDER
          toFolder: '/'
          callback: refreshPageList


  $scope.unpublishSelectedPages = ->
    undefined


  isPage = (path) -> path.pageId?
  isFolder = (path) -> !isPage(path)
  depthOf = (path) ->
    matches = path.match(//(/[^/]*)//g)
    matches?.length || 0

  $scope.paths = []
  $scope.isPage = isPage
  $scope.isFolder = isFolder
  $scope.isFolderOrPageClass = (path) ->
    if isPage(path) then 'is-page' else 'is-folder'

  loadAndListPages = ->
    adminService.listAllPages (data) ->
      listMorePagesDeriveFolders data.pages

  listMorePagesDeriveFolders = (morePages) ->
      folderPathsDupl = []
      paths = []

      for page in morePages
        $scope.paths.push makePageListItem(page)
        folderPathsDupl.push page.folder

      folderPaths = unique folderPathsDupl
      folderPaths = reject (== '/'), folderPaths

      for path in folderPaths
        # COULD skip `path` if $scope.paths already contains that folder.
        depth = depthOf path
        folderPath =
            value: path
            displayPath: path # folderDisplayPath folderPath
            included: false
            depth: depth
            open: false
        $scope.paths.push folderPath

      redrawPageList!


  listOneMorePage = (page) ->
    $scope.paths.push makePageListItem(page)
    redrawPageList!

  makePageListItem = (page) ->
    depth = depthOf page.path
    return
        pageId: page.id
        value: page.path
        displayPath: page.path
        title: page.title
        authors: page.authors
        included: false
        depth: depth
        open: false
        mark: page.mark

  redrawPageList = ->
    sortPathsInPlace $scope.paths
    updateHideCounts $scope.paths

  # Places deep paths at the end. Sorts alphabetically, at each depth.
  sortPathsInPlace = (paths) ->
    paths.sort (a, b) ->
      partsA = a.value.split '/'
      partsB = b.value.split '/'
      lenA = partsA.length
      lenB = partsB.length
      minLen = Math.min(lenA, lenB)
      for ix from 1 to minLen
        partA = partsA[ix]
        partB = partsB[ix]
        # Sort a folder before the pages in it.
        # (A folder and its index page has identical `value`s, e.g. `/folder/`.)
        if ix + 1 == lenA and lenA == lenB
          return -1 if isFolder(a) and isPage(b)
          return 1 if isFolder(b) and isPage(a)
        # Sort pages before folders
        return -1 if ix + 1 == lenA and lenA < lenB
        return 1 if ix + 1 == lenB and lenB < lenA
        # Sort alphabetically
        return -1 if partA < partB
        return 1 if partB < partA
      return 0

  $scope.nothingSelected = true

  selectedPageListItems = []
  selectedFolderListItems = []

  /**
   * Scans $scope.paths and updates page and folder selection count
   * variables.
   */
  $scope.updateSelectedPaths = ->
    folders = []
    pageIds = []
    numDrafts = 0
    numNonDrafts = 0
    for path in $scope.paths when path.included
      if path.pageId
        selectedPageListItems.push path
        pageIds.push path.pageId
        if path.value.search(DRAFTS_FOLDER) == 0 => numDrafts += 1
        else numNonDrafts += 1
      else
        selectedFolderListItems.push path
        folders.push path.value

    numPages = pageIds.length
    numFolders = folders.length

    $scope.nothingSelected = numPages == 0 && numFolders == 0
    $scope.onePageSelected = numPages == 1 && numFolders == 0
    $scope.oneFolderSelected = numFolders == 1 && numPages == 0

    $scope.onlyDraftsSelected =
        numDrafts > 0 && numNonDrafts == 0 && numFolders == 0
    $scope.onlyPublishedSelected =
        numDrafts == 0 && numNonDrafts > 0 && numFolders == 0

    # In the future, show stats on the selected pages, in a <div> to the
    # right. Or show a preview, if only one single page selected.
    return

  /**
   * Traverses the $scope.paths list once, checks each path.closed,
   * and updates all hide counts accordingly.
   */
  updateHideCounts = (paths) ->
    curHideCount = 0
    folderStack = []
    for path in paths
      # Leave folder, continue from some previously stacked parent?
      if isFolder path
        curHideCount = 0
        parentFolder = null
        while !parentFolder && folderStack.length > 0
          { childHideCount, folderPath } = last folderStack
          if path.value.search(folderPath) == 0
            parentFolder = folderPath
            curHideCount = childHideCount
          else
            folderStack.pop()
      # Set hit count for folders, both open and closed, and pages.
      # But always show stuff with a mark (could a new page the user
      # just created).
      #bugUnless 0 <= curHideCount
      path.hideCount =
          if path.mark then 0 else curHideCount
      # Enter folder?
      if isFolder path
        curHideCount += 1 unless path.open
        folderStack.push (
            folderPath: path.value
            childHideCount: curHideCount )
    undefined

  $scope.openClose = (path) ->
    path.open = !path.open
    updateHideCounts $scope.paths

  $scope.cssClassForMark = (mark) ->
    if mark then ' marked-path' else ''

  $scope.test =
    sortPathsInPlace: sortPathsInPlace
    updateHideCounts: updateHideCounts

  loadAndListPages!

  ]



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



@UserListCtrl = ['$scope', 'AdminService', ($scope, adminService) ->

  'boo bä'

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
  | 'Approved' => what
  | 'Rejected' => "#what, rejected"
  | 'EditsRejected' => "#what, edits rejected"
  | 'NewEdits' => "#what, edited"
  | _ => "#what, #{post.status}"



function inlineBtnToggledAllOff
  { showApproveBtn: false, showRejectBtn: false }

function inlineBtnTogglersForPost(post)
  switch post.status
  | 'New' => { showApproveBtn: true, showRejectBtn: true }
  | 'NewEdits' => { showApproveBtn: true, showRejectBtn: true }
  | _ => {}



padNumberToLength2 = (number) ->
  if (''+ number).length == 1 then '0' + number
  else ''+ number


# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
