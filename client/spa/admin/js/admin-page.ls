# Copyright (c) 2012 Kaj Magnus Lindberg. All rights reserved

import prelude


AdminModule = angular.module('AdminModule', [])



AdminModule.filter 'filterProp', ->
  (inputs, propName, textToMatch) ->
    [i for i in inputs when i[propName].search(textToMatch) >= 0]



AdminModule.factory 'AdminService', ['$http', ($http) ->

  api = {}
  selectedPathsListeners = []

  api.selectPaths = (treesFoldersPageIds) ->
    for listener in selectedPathsListeners
      listener(treesFoldersPageIds)

  api.onPathSelectionChange = (listener) ->
    selectedPathsListeners.push listener

  api.listAllPages = (onSuccess) ->
    $http.get('/?list-pages.json&in-tree').success (data) ->
      # Angular has already parsed the JSON.
      onSuccess(data)

  api.listActions = (treesFoldersPageIds, onSuccess) ->
    treesStr   = treesFoldersPageIds.trees?.join(',') || ''
    foldersStr = treesFoldersPageIds.folders?.join(',') || ''
    pageIdsStr = treesFoldersPageIds.pageIds?.join(',') || ''
    $http.get("/?list-actions.json" +
        "&in-trees=#treesStr" +
        "&in-folders=#foldersStr" +
        "&on-pages=#pageIdsStr").success (data) ->
      onSuccess data

  api

  ]



@PathsCtrl = ['$scope', 'AdminService', ($scope, adminService) ->

  isPage = (path) -> path.pageId?
  isFolder = (path) -> !isPage(path)
  depthOf = (path) ->
    matches = path.match(//(/[^/]+)//g)
    matches?.length || 0

  $scope.paths = []
  $scope.isPage = isPage
  $scope.isFolder = isFolder
  $scope.isFolderOrPageClass = (path) ->
    if isPage(path) then 'is-page' else 'is-folder'

  updatePathsView = ->
    adminService.listAllPages (data) ->

      # Leave all folders but the root folder, '/', closed.

      pages = data.pages
      folderPathsDupl = []
      paths = []

      for page in pages
        depth = depthOf page.path
        pagePath =
            pageId: page.id
            value: page.path # makePagePath folderPath, pageId, pageInfo
            displayPath: page.path # makePageDispPath folderPath, pageId, pageInfo
            title: page.title # pageInfo.title
            authors: page.authors
            included: false
            depth: depth
            open: false
            hideCount: depth - 1
        paths.push pagePath
        folderPathsDupl.push page.folder

      folderPaths = unique folderPathsDupl
      for path in folderPaths
        folderPath =
            value: path
            displayPath: path # folderDisplayPath folderPath
            included: false
            depth: depthOf path
            open: depth == 0
            # Path hidden, if > 0.
            hideCount: depth - 1
        paths.push folderPath

      sortPathsInPlace paths
      $scope.paths = paths

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

  $scope.updateSelectedPaths = ->
    trees = []
    folders = []
    pageIds = []
    for path in $scope.paths when path.included
      if path.pageId => pageIds.push path.pageId
      else trees.push path.value
    # If nothing seleced, treat that as if everything was selected.
    trees = ['/'] if 0 == trees.length + folders.length + pageIds.length
    adminService.selectPaths {
        trees: trees, folders: folders, pageIds: pageIds }

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
      #bugUnless 0 <= curHideCount
      path.hideCount = curHideCount
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

  $scope.test =
    sortPathsInPlace: sortPathsInPlace
    updateHideCounts: updateHideCounts

  updatePathsView()

  ]



@ActionListCtrl = ['$scope', 'AdminService', ($scope, adminService) ->

  mixinInfoListCommon $scope, 'actionList'

  updateActionList = (treesFoldersPageIds) ->
    adminService.listActions treesFoldersPageIds, (actions) ->
      $scope.actionList = actions.actions
      # The reply looks like so:
      # actions: [{
      #   loginId: "290", idtyId: "Moo", pageId: "2b1t8",
      #   id: "3smk1", cdati: "2012-04-26T10:16:16Z", userId: "Mää", type: "Böö"
      #   },{ ... }]

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

  $scope.toggleAll = ->
    for info in $scope[infoListName]
      info.selected = $scope.allSelected

  $scope.updateToggleAllCheckbox = ->
    $scope.allSelected = true
    for info in $scope[infoListName]
      $scope.allSelected and= info.selected


#
# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
