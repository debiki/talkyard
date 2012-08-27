# Copyright (c) 2012 Kaj Magnus Lindberg. All rights reserved

import prelude


AdminModule = angular.module('AdminModule', [])



AdminModule.filter 'filterProp', ->
  (inputs, propName, textToMatch) ->
    [i for i in inputs when i[propName].search(textToMatch) >= 0]



AdminModule.factory 'AdminService', ['$http', ($http) ->

  selectedPathsListeners = []

  selectPaths = (foldersAndPageIds) ->
    for listener in selectedPathsListeners
      listener(foldersAndPageIds)

  {

    listAllPages: (onSuccess) ->
      $http.get('/?list-pages.json&in-tree').success (data) ->
        # Angular has already parsed the JSON.
        onSuccess(data)

    listAllPagesFake: ->
        [{
          id: 'p1'
          path: '/-p1-slug'
          title: 'Page p1'
          authors: []
        },{
          id: 'p2',
          path: '/-p2-slug'
          title: 'Page p2'
          authors: []
        }]

    selectPaths: selectPaths

  }]



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

  updateSelectedPaths = ->
    foldersAndIds = []
    for path in $scope.paths when path.included
      foldersAndIds.push (path.pageId or path.value)
    # If nothing seleced, treat that as if everything was selected.
    if foldersAndIds.length is 0 then foldersAndIds = ['/']
    AdminService.selectPaths foldersAndIds

  /**
   * Traverses the $scope.paths list once, checks each path.closed,
   * and updates all hide counts accordingly.
   */
  updateHideCounts = ->
    curDepth = 0
    curHideCount = 0
    parentsOpen = []
    for path in $scope.paths
      # Leave folder?
      # BUG: If last folder was: /folder/
      #      and this folder is: /very/other/folder/
      #      then path.depth is > curDepth - 1, so we won't leave last
      #      folder and enter a new folder, but we should!
      if isFolder(path) and path.depth == curDepth - 1
        curDepth -= 1
        wasOpen = parentsOpen.pop()
        curHideCount -= 1 unless wasOpen
      # Set hit count for folders, both open and closed, and pages.
      #bugUnless path.depth == curDepth
      #bugUnless 0 <= curHideCount
      path.hideCount = curHideCount
      # Enter folder?
      if isFolder(path)
        curDepth += 1
        curHideCount += 1 unless path.open
        parentsOpen.push path.open
    undefined

  $scope.openClose = (path) ->
    path.open = !path.open
    updateHideCounts()

  $scope.test =
    sortPathsInPlace: sortPathsInPlace

  updatePathsView()

  ]



@ActionListCtrl = ['$scope', 'AdminService', ($scope, adminService) ->

  'boo buuu'

  ]



@UserListCtrl = ['$scope', 'AdminService', ($scope, adminService) ->

  'boo bä'

  ]

#
# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
