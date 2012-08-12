u = _ # works in the Coffeescript console, where `_` means 'last result'.

###

- { pageId actionId path title type authorId authorDispName authorIp ctime mtime ptime utime xtime }

###


# From http://coffeescript.org/documentation/docs/helpers.html
countSubstr = (string, substr) ->
  num = pos = 0
  return 1/0 unless substr.length
  num++ while pos = 1 + string.indexOf substr, pos
  num


AdminModule = angular.module('AdminModule', [])


AdminModule.filter 'filterProp', ->
  (inputs, propName, textToMatch) ->
    i for i in inputs when i[propName].search(textToMatch) >= 0


AdminModule.factory 'AdminService', [ ->

  selectedPathsListeners = []

  selectPaths = (foldersAndPageIds) ->
    listener(foldersAndPageIds) for listener in selectedPathsListeners

  s = debiki.v0.server
  {
    loadNonEmptyFolders: (paths) -> s.listNonEmptyFolders(paths)
    loadPagesInFolders: (paths) -> s.listPagesInFolders(paths)
    loadActionsInFolders: (paths) -> s.listActionsInFolders(paths)
    selectPaths: selectPaths
    onPathSelectionChange: (listener) -> selectedPathsListeners.push listener
    listRecentActions: (foldersAndPageIds) ->
                          s.listRecentActions foldersAndPageIds
    listRecentUsers: (foldersAndPageIds) ->
                          s.listRecentUsers foldersAndPageIds
  }]


###
COULD make checkboxes work like so:
  http://stackoverflow.com/questions/4566586/multiple-checkboxes-check-as-in-gmail
###
@PathsCtrl = ['$scope', 'AdminService', ($scope, AdminService) ->

  $scope.showFullPaths = true
  foldersAndContents = AdminService.loadNonEmptyFolders()

  isPage = (path) -> path.pageId?
  isFolder = (path) -> !isPage(path)

  makePagePath = (folderPath, pageId, pageInfo) ->
    folderPath + makePageName(pageId, pageInfo)

  makePageDispPath = (folderPath, pageId, pageInfo) ->
    folderPath = '' unless $scope.showFullPaths
    folderPath + makePageName pageId, pageInfo

  makePageName = (pageId, pageInfo) ->
    idAndSlug = pageInfo.slug
    idAndSlug = '-' + pageId + '-' + pageInfo.slug if pageInfo.showId
    idAndSlug = '(index)' if pageInfo.slug is '' and not pageInfo.showId
    idAndSlug

  folderDisplayPath = (folderPath) ->
    return folderPath if $scope.showFullPaths
    fragments = folderPath.split('/')
    # -2, not -1, because there's an empty string fragment after the last '/'.
    lastFrag = fragments[fragments.length - 2]
    lastFrag + '/'

  updatePathsView = ->
    # Remember and reuse existing $scope.paths. Othrewise all settings
    # will be forgotten; (e.g. path.included and if it's been toggled open
    # (CSS display: block) or closed) the #page-tree would be redrawn
    # from scratch.
    # Details: AngularJS has linked (via $.data()) each DOM node list item
    # to the $scope.paths elems — we'd break those links unless
    # we reuse the $scope.paths.
    oldPaths = {}
    if $scope.paths
      for path in $scope.paths
        # Store pages by id and folders by path.
        oldPaths[path.pageId or path.value] = path

    # Loop through all loaded folders and pages, and construct
    # a new version of $scope.paths.
    $scope.paths = []
    for folderPath, folderContents of foldersAndContents
      folderDepth =
        # Place both '/' and '/some-folder/' at depth 0.
        if folderPath is '/' then 0
        else (countSubstr folderPath, '/') - 2
      path = oldPaths[folderPath] or (
          value: folderPath
          displayPath: folderDisplayPath folderPath
          included: false
          depth: folderDepth
          open: false
          # Path hidden, if > 0.
          hideCount: 0 )
      $scope.paths.push path
      for pageId, pageInfo of folderContents.pagesById
        path = oldPaths[pageId] or (
            pageId: pageId
            value: makePagePath folderPath, pageId, pageInfo
            displayPath: makePageDispPath folderPath, pageId, pageInfo
            title: pageInfo.title
            authors:
              for id, authorInfo of pageInfo.authorsById
                { authorId: id, authorDispName: authorInfo.dispName }
            included: false
            depth: folderDepth + 1
            open: false
            hideCount: 0 )
        $scope.paths.push path
    sortPathsInPlace $scope.paths
    AdminService.changeActivePagePaths

  # Places deep paths at the end. Sorts alphabetically, at each depth.
  sortPathsInPlace = (paths) ->
    paths.sort (a, b) ->
      partsA = a.value.split '/'
      partsB = b.value.split '/'
      lenA = partsA.length
      lenB = partsB.length
      minLen = Math.min(lenA, lenB)
      for ix in [1..minLen]
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

  ###
  Traverses the $scope.paths list once, checks each path.closed,
  and updates all hide counts accordingly.
  ###
  updateHideCounts = ->
    curDepth = 0
    curHideCount = 0
    parentsOpen = []
    for path in $scope.paths
      # Leave folder?
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
    if isFolder(path)
      # Load folder contents, if needed. (Synch/async?? Synch for now?)
      # (Page details currently loaded together with folders.)
      unless foldersAndContents[path.value].allPagesLoaded
        morePages = AdminService.loadPagesInFolders([path.value])
        jQuery.extend(true, foldersAndContents, morePages)
        updatePathsView()
        updateSelectedPaths()
    path.open = !path.open
    updateHideCounts()

  $scope.updateSelectedPaths = updateSelectedPaths
  $scope.isPage = isPage
  $scope.isFolder = isFolder
  $scope.isFolderOrPageClass = (path) ->
    if isPage(path) then 'is-page' else 'is-folder'
  $scope.test =
    makePagePath: makePagePath
    sortPathsInPlace: sortPathsInPlace

  updatePathsView()

  ]



###
 Common functionality for ActionListCtrl, UserListCtrl and (in the future)
 PageListCtrl.
###
mixinInfoListCommon = ($scope, infoListName) ->

  $scope.toggleAll = ->
    for info in $scope[infoListName]
      info.selected = $scope.allSelected

  $scope.updateToggleAllCheckbox = ->
    $scope.allSelected = true
    for info in $scope[infoListName]
      $scope.allSelected and= info.selected



@ActionListCtrl = ['$scope', 'AdminService', ($scope, AdminService) ->

  mixinInfoListCommon $scope, 'actionList'

  updateActionList = (foldersAndPageIds) ->
    $scope.actionList = AdminService.listRecentActions(foldersAndPageIds)

  AdminService.onPathSelectionChange updateActionList

  # On page load, list the most recent actions, consider all pages.
  updateActionList(['/'])

  ]



@UserListCtrl = ['$scope', 'AdminService', ($scope, AdminService) ->

  mixinInfoListCommon $scope, 'userList'

  updateUserList = (foldersAndPageIds) ->
    $scope.userList = AdminService.listRecentUsers(foldersAndPageIds)

  AdminService.onPathSelectionChange updateUserList

  # On page load, list the most recent users, consider all pages.
  updateUserList(['/'])

  ]



# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
