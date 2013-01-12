# Copyright (c) 2012 Kaj Magnus Lindberg. All rights reserved

import prelude
d = i: debiki.internal, u: debiki.v0.util
bug = d.u.die2


# The 'ui' module is http://angular-ui.github.com/.
AdminModule = angular.module('AdminModule', ['ui', 'ngSanitize'])



AdminModule.factory 'AdminService', ['$http', '$rootScope', adminService]


function adminService ($http, $rootScope)

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
    $http.get('/-/list-pages?in-tree').success (data) ->
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


  /**
   * Asks the server for an URL to view a new unsaved page (the server wants
   * to choose page id itself).
   *
   * If that new unsaved page is edited later, the server will create
   * it lazily.
   */
  api.getViewNewPageUrl = (pageData, callback) ->
    getViewNewPageUrl =
        pageData.folder +
        '?get-view-new-page-url' +
        '&page-slug=' + pageData.pageSlug +
        '&show-id=' + (if pageData.showId => 't' else 'f')
    $http.get(getViewNewPageUrl).success ({ viewNewPageUrl }) ->
      # Add page meta to URL, so the server knows e.g. which template
      # to use when rendering the page (and can save this info to the
      # database later when/if the server lazy-creates the page).
      if pageData.pageRole
        viewNewPageUrl += '&page-role=' + pageData.pageRole
      if pageData.parentPageId
        viewNewPageUrl += '&parent-page-id=' + pageData.parentPageId
      callback viewNewPageUrl


  # Newly created pages knows to call each function in
  # onOpenedPageSavedCallbacks when saved, on window.opener.
  debiki.v0.onOpenedPageSavedCallbacks ?= []
  debiki.v0.onOpenedPageSavedCallbacks.push (pageMeta, pageTitle) ->
    $rootScope.$apply ->
      for callback in onOpenedPageSavedCallbacks
        callback pageMeta, pageTitle

  onOpenedPageSavedCallbacks = []

  api.onPageSaved = (callback) ->
    onOpenedPageSavedCallbacks.push callback


  api.movePages = (pageIds, {fromFolder, toFolder, callback}) ->
    $http.post '/-/move-pages', { pageIds: pageIds, fromFolder, toFolder }
        .success -> callback!


  api.moveRenamePage = !(pageId,
      {newFolder, newSlug, newTitle, showId, pushExistingPageToPrevLoc,
      callback}) ->
    $http.post '/-/move-rename-page', {
        pageId, newFolder, newSlug, showId, newTitle,
        pushExistingPageToPrevLoc }
        .success callback
        .error callback


  api.changePageMeta = !(newStatuses, {callback}) ->
    $http.post '/-/change-page-meta', newStatuses
        .success callback
        .error callback



  api


# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
