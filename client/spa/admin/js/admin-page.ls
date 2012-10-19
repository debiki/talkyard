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

  api.createPage = ({ path, id, role, parentPageId }, callback) ->
    { folder, pageSlug, showId } = analyzePagePath path
    $http.post(folder + '?create-page',
        'page-title': 'Unnamed Page'
        'page-slug': pageSlug
        'show-id': showId
        'page-role': role
        'parent-page-id': parentPageId
        ).success (data) ->
          callback data.newPage

  api.movePages = (pageIds, {fromFolder, toFolder, callback}) ->
    $http.post '/-/move-pages', { pageIds: pageIds, fromFolder, toFolder }
        .success -> callback!

  api

  ]



@PathsCtrl = ['$scope', 'AdminService', ($scope, adminService) ->

  const DRAFTS_FOLDER = '/.drafts/'


  getSelectedFolderOrDie = ->
    bug('DwE031Z3') if selectedFolderListItems.length != 1
    selectedFolderListItems[0]


  getSelectedPageOrDie = ->
    bug('DwE83Iw2') if selectedPageListItems.length != 1
    selectedPageListItems[0]


  $scope.createBlog = (location) ->
    createPage(
        path: location,
        role: 'BlogMainPage')


  $scope.createDraftPage = ->
    createPageInFolder <| '/.drafts/' + curYearMonthDayRelFolder!


  $scope.createPageInFolder = ->
    createPageInFolder getSelectedFolderOrDie!path


  createPageInFolder = (parentFolder) ->
    pageId = generatePageId!
    createPage(
        id: pageId
        path: parentFolder + '-' + pageId + '-new-page')


  /**
   * Creates a new page list item, which, from the user's point of view,
   * is similar to creating a new unsaved page.
   *
   * `page` should be a: { path, (id, role, parentPageId) }
   * where (...) is optional.
   */
  createPage = (page) ->
    page.id ||= generatePageId!
    pageListItem = makePageListItem(page)
    pageListItem.marks = ['NewUnsaved']

    # Select the new page, and nothing else, so the 'View/edit' button
    # appears and the user hopefully understands what to do next.
    pageListItem.included = true
    for item in $scope.listItems
      item.included = false

    listMorePagesDeriveFolders [pageListItem]


  /**
   * Generates an id like '5kbq9'. The id starts and ends with a digit, so
   * as not to look like some word. And the vowels 'aoei' are excluded
   * (but not 'u' and 'y'), to hopefully avoid generating any ugly word.
   */
  generatePageId = ->
    id = ''
    charset = '0123456789bcdfghjklmnpqrstuvwxyz'
    for i from 1 to 5
      charsetLength =
          if i == 1 or i == 5 then 10 else charset.length
      id += charset.charAt Math.floor(Math.random! * charsetLength)
    id


  /**
   * Opens a page in a new browser tab.
   *
   * If the page was just created, but has not been saved server side,
   * saves the page before opening it. (Requires a server roundtrip.)
   */
  $scope.viewSelectedPage = ->
    pageItem = getSelectedPageOrDie!
    if find (== 'NewUnsaved'), pageItem.marks || []
      # Open new tab directly, in direct response to the user-initiated event,
      # or the browser's pop-up blocker tends to block it.
      newBrowserPage = window.open 'about:blank', '_blank'
      adminService.createPage {
          path: pageItem.path
          id: pageItem.pageId # ??
          role: pageItem.role
          parentPageId: pageItem.parentPageId
          }, (newPage) ->
        newBrowserPage.location = newPage.path
        pageItem.marks = reject (== 'NewUnsaved'), pageItem.marks
        pageItem.marks.push 'NewSaved'
        updatePageItem pageItem, withNewPageData: newPage
    else
      window.open pageItem.path, '_blank'


  $scope.moveSelectedPage = ->
    pageListItem = getSelectedPageOrDie!
    window.open <| pageListItem.path + '?move-page'


  moveSelectedPages = ({ fromFolder, toFolder }) ->
    refreshPageList = ->
      for pageListItem in selectedPageListItems
        pageListItem.path .= replace fromFolder, toFolder
      redrawPageItems selectedPageListItems

    for pageListItem in selectedPageListItems
      adminService.movePages [pageListItem.pageId],
          { fromFolder, toFolder, callback: refreshPageList }


  $scope.publishSelectedPages = ->
    moveSelectedPages fromFolder: DRAFTS_FOLDER, toFolder: '/'


  $scope.unpublishSelectedPages = ->
    moveSelectedPages fromFolder: '/', toFolder: DRAFTS_FOLDER


  isPage = (item) -> item.pageId?
  isFolder = (item) -> !isPage(item)

  $scope.listItems = []
  $scope.isPage = isPage
  $scope.isFolder = isFolder
  $scope.isFolderOrPageClass = (item) ->
    if isPage(item) then 'is-page' else 'is-folder'


  loadAndListPages = ->
    adminService.listAllPages (data) ->
      listMorePagesDeriveFolders <|
          [makePageListItem(page) for page in data.pages]


  updatePageItem = (pageItem, { withNewPageData }) ->
    wasOpen = pageItem.open
    wasIncluded = pageItem.included
    pageItem <<< makePageListItem(withNewPageData)
    pageItem.open = wasOpen
    pageItem.included = wasIncluded
    redrawPageItems [pageItem]


  redrawPageItems = (pageItems) ->
    # Remove pageItem and add it again, so any missing parent folder
    # is created, in case pageItem has been moved.
    # For now, call listMorePagesDeriveFolders once per pageItem
    # (a tiny bit inefficient).
    for pageItem in pageItems
      $scope.listItems = reject (== pageItem), $scope.listItems
      listMorePagesDeriveFolders [pageItem]


  listMorePagesDeriveFolders = (morePageItems) ->
    newFolderPaths = []

    for pageItem in morePageItems
      $scope.listItems.push pageItem
      newFolderPaths.push parentFolderOfPage(pageItem.path)

    newFolderPaths = unique newFolderPaths
    newFolderPaths = reject (== '/'), newFolderPaths

    oldFolderPaths =
        [item.path for item in $scope.listItems when isFolder(item)]

    for newPath in newFolderPaths when not find (== newPath), oldFolderPaths
      folderItem =
          path: newPath
          included: false
          open: false
      $scope.listItems.push folderItem

    redrawPageList!


  makePageListItem = (page) ->
    item =
        pageId: page.id
        path: page.path
        title: page.title
        authors: page.authors
        included: false
        open: false
        role: page.role
        parentPageId: page.parentPageId

    isHomePage = (page) -> page.path == '/' || page.path == DRAFTS_FOLDER
    isIndexPage = (page) -> last(page.path) == '/'

    if isHomePage page => item.clarification = '(homepage)'
    else if isIndexPage page => item.clarification = '(index page)'
    item


  redrawPageList = ->
    sortItemsInPlace $scope.listItems
    updateListItemFields $scope.listItems
    $scope.updateSelections!


  # Places deep paths at the end. Sorts alphabetically, at each depth.
  sortItemsInPlace = (items) ->
    items.sort (a, b) ->
      partsA = a.path.split '/'
      partsB = b.path.split '/'
      lenA = partsA.length
      lenB = partsB.length
      minLen = Math.min(lenA, lenB)
      for ix from 1 to minLen
        partA = partsA[ix]
        partB = partsB[ix]
        # Sort a folder before the pages in it.
        # (A folder and its index page has identical `path`s, e.g. `/folder/`.)
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
   * Scans $scope.listItems and updates page and folder selection count
   * variables.
   */
  $scope.updateSelections = ->
    selectedPageListItems := []
    selectedFolderListItems := []
    numDrafts = 0
    numNonDrafts = 0
    for item in $scope.listItems when item.included
      if item.pageId
        selectedPageListItems.push item
        if item.path.search(DRAFTS_FOLDER) == 0 => numDrafts += 1
        else numNonDrafts += 1
      else
        selectedFolderListItems.push item

    numPages = selectedPageListItems.length
    numFolders = selectedFolderListItems.length

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
   * Traverses the $scope.listItems list once, checks each item.closed,
   * and updates all hide counts accordingly.
   *
   * COULD remove folders without children.
   * COULD set `open = true` if all children of a folder is shown,
   * even if folder was actually closed. (If a page is marked,
   * e.g. with 'NewUnsaved', it's shown even if parent folder closed.)
   */
  updateListItemFields = (items) ->
    curHideCount = 0
    curParentFolderPath = '/'
    folderStack = []
    # Could, instead?: folderStack = [{ hideCount: 0, path: '/' }]
    for item in items

      # Leave any folder and continue from previously stacked parent.
      if isFolder item
        curHideCount = 0
        curParentFolderPath = '/'
        while curParentFolderPath == '/' && folderStack.length > 0
          lastFolder = last folderStack
          if item.path.search(lastFolder.path) == 0
            curHideCount = lastFolder.hideCount
            curHideCount += 1 unless lastFolder.open
            curParentFolderPath = lastFolder.path
          else
            folderStack.pop()

      item.depth = folderStack.length
      item.displayPath = item.path.replace curParentFolderPath, ''
      item.hideCount = curHideCount

      # Always show stuff with any marks (could be a page the user
      # just created), and show its ancestor folders too.
      if item.marks
        item.hideCount = 0
        for ancestorFolder in folderStack
          # BUG SHOULD recursively update hide counts of any folder children.
          # (So they're 1 if folder closed, or 0 if open).
          ancestorFolder.hideCount = 0

      # Enter folder?
      if isFolder item
        curHideCount += 1 unless item.open
        curParentFolderPath = item.path
        folderStack.push item
    return


  $scope.openClose = (item) ->
    item.open = !item.open
    updateListItemFields $scope.listItems

  $scope.cssClassForMark = (mark) ->
    if mark then ' marked-path' else ''


  $scope.stringifyImportantMarksFor = (item) ->
    text = ''
    for mark in item.marks || []
      switch mark
      | 'NewUnsaved' => text += ' (new, unsaved)'
    text


  $scope.stringifyOtherMarksFor = (item) ->
    text = ''
    for mark in item.marks || []
      switch mark
      | 'NewSaved' => text += ' (new, saved)'
    text


  $scope.test =
    sortItemsInPlace: sortItemsInPlace
    updateListItemFields: updateListItemFields

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



function analyzePagePath(path)
  return
    folder: parentFolderOfPage path
    pageSlug: findPageSlugIn path
    showId: isPageIdShownIn path


function parentFolderOfPage(path)
  # Index page? If so, folder path equals index page path.
  if path.match //^.*/$//
    return path
  # Other pages (with id shown, or non-empty slug).
  matches = path.match //^(/.*/)[^/]+$//
  if !matches => return '/'
  bug('DwE03Al8') if matches.length != 2
  matches[1]



function findPageSlugIn(path)
  matches = path.match //^.*/(-[^/^-]+-)?([^/^-][^/]*)$//
  if !matches => return ''
  bug('DwE83KX1') if matches.length != 3
  matches[2]



function isPageIdShownIn(path)
  matches = path.match //^.*/-[a-z0-9]+(-[^/]*)?$//
  if matches => true
  else false



/**
 * A relative folder path, e.g. `2012/09/23/` (no leading slash).
 */
function curYearMonthDayRelFolder
  now = new Date!
  return
      padNumberToLength2(now.getFullYear!) + '/' +
      padNumberToLength2(now.getMonth!) + '/' +
      padNumberToLength2(now.getDate!) + '/'



function padNumberToLength2(number)
  if (''+ number).length == 1 then '0' + number
  else ''+ number


# For now, for the test suite:
test = debiki.test || {}
test.analyzePagePath = analyzePagePath
test.padNumberToLength2 = padNumberToLength2


# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
