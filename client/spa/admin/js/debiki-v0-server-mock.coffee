u = _ # works in the Coffeescript console, where `_` means 'last result'.

`
if (!window.debiki) window.debiki = {};
if (!debiki.v0) debiki.v0 = {};
if (!debiki.v0.server) debiki.v0.server = {};
if (!debiki.v0.util) debiki.v0.util = {};
if (!debiki.internal) debiki.internal = {};

jQuery.extend(debiki.v0.server, {
  listPagesInFolder: function() { return {}; },
  loadAndSanitizeExcerpt: function() {
    return {};
  }
});

function bugIf(test, errorGuid) {
  if (test) throw new Error('Internal error ['+ errorGuid +']');
}
`

( ->
  actionsByPageByFolder =
      '/':
        allPagesLoaded: true
        pagesById:
          p01:
            slug: ''
            showId: false
            authorsById:
              r935: { dispName: 'Rolf Rolander Rosengren' }
              r215: { dispName: 'Sven Svansson' }
            allActionsIncluded: true
            actionsById:
              '1':
                type: 'Post'
                authorId: 'r092'
                loginId: 'l153'
                ctime: '2012-01-01T00:01:01'
          p02:
            slug: 'page-slug'
            showId: true
            authorsById:
              r215: { dispName: 'Bo Ek' }
            allActionsIncluded: true
            actionsById:
              '1':
                type: 'Post'
                authorId: 'r092'
                loginId: 'l153'
                ctime: '2012-01-01T00:02:01'
      '/folder-1/':
        allPagesLoaded: true
        pagesById:
          p029:
            slug: 'page-slug'
            allActionsIncluded: true
            actionsById:
              '1':
                type: 'Post'
                authorId: 'r092'
                loginId: 'l153'
                ctime: '2012-01-01T00:29:01'
              a022:
                type: 'Post'
                authorId: 'r092'
                loginId: 'l153'
                ctime: '2012-01-01T00:29:22'
      '/folder-2/folder-2-1/': {}
      '/folder-2/another/folder/': {}
      '/more-folders-not-loaded/': {}
      '/even-more-folders/not-loaded/': {}
      '/theme/': {}

  # Remembers for which folders and pages we've asked the server
  # to list the most recent actions.
  # - The actual actions loaded from the server are merged
  # into actionsByPageByFolder. And every time we list the most recent
  # actions in a folder or on some pages, we do a (possibly) full
  # scan of actionsByPageByFolder, to find the releevant actions.
  # - This full scan won't take long, since we'll never load
  # particularily many actions from the server. (The server
  # won't reply with more than perhaps 100 or 1000 actions per query,
  # so assuming we've made 50 queries, the server would list 5 000 or 50 000
  # actions, which we'd scan and sort in fractions of a second.)
  # - When soome queries have been done, the value could be e.g.
  # { '/': true, '/some-folder': true, '12xy34': true }
  # and keys that start with '/' are folders, other keys are page ids.
  recentActionsQueriesDone = {}

  debiki.v0.server.listNonEmptyFolders = ->
    folders = {}
    for folder, data of actionsByPageByFolder when data.pagesById?
      folders[folder] = {}
    folders

  debiki.v0.server.listPagesInFolders = (folders) ->
    #removeActionsFromPage = (page) ->
    #  slug: page.slug
    #  showId: page.showId
    #  authorsById: page.authorsById

    foldersAndPages = {}
    for folder, data of actionsByPageByFolder when (
        data.pagesById? and u(folders).contains folder)
      foldersAndPages[folder] =
        u.mapVals data, (value, folderInfoKey) ->
          unless folderInfoKey is 'pagesById' then value
          else u.mapVals value, (pageData) ->
            u(pageData).kick 'actionsById', 'allActionsIncluded'
    foldersAndPages

  debiki.v0.server.listActionsInFolders = (folders) ->
    # Similar to `listPagesInFolders` but we don't filter out actions.
    #foldersAndPages = {}
    #for folder, data of actionsByPageByFolder when (
    #    data.pagesById? and u(folders).contains folder)
    #  foldersAndPages[folder] = data
    #foldersAndPages
    u.mapValsKickUndef foldersAndPages, (data, folderPath) ->
      if u(folders).contains folderPath then data
      else undefined

  ###
  It's okay if `folderPathsAndPageIds` lists a folder and also list pages
  in that folder — duplicates are elliminated.
  ###
  debiki.v0.server.listRecentActions = (folderPathsAndPageIds) ->
    # Pages for which we'll list recent actions.
    pageIds = []
    # Add page ids explicitly specified.
    for pathOrId in folderPathsAndPageIds
      isPageId = pathOrId[0] != '/'
      pageIds.push(pathOrId) if isPageId
    # Add pages in folders specified.
    matchingFolders = findFoldersStartingWith folderPathsAndPageIds
    pageIdsInTrees = findPageIdsInTrees matchingFolders
    pageIds.push id for id in pageIdsInTrees
    pageIds = _(pageIds).uniq()
    # Find and sort actions.
    # They'll be unique, since page ids are unique (see just above).
    recentActions = []
    for pageId in pageIds
      pageContents = getPageById(pageId)
      for actionId, actionInfo of pageContents.actionsById
        recentActions.push
          pageId: pageId
          actionId: actionId
          type: actionInfo.type
          authorId: actionInfo.authorId
          loginId: actionInfo.loginId
          ctime: actionInfo.ctime

    sorted = _(recentActions).sortBy 'ctime'
    sorted

  findFoldersStartingWith = (pathPrefixes) ->
    folderPathsFound = []
    for folderPath, folderContents of actionsByPageByFolder
      for prefix in pathPrefixes
        folderMatches = folderPath.indexOf(prefix) is 0
        folderPathsFound.push folderPath if folderMatches
    folderPathsFound

  findPageIdsInTrees = (folderPaths) ->
    pageIds = []
    for folderPath in folderPaths
      folder = actionsByPageByFolder[folderPath]
      for pageId, pageContents of folder.pagesById
        pageIds.push pageId
    _(pageIds).uniq()

  getPageById = (pageId) ->
    # For now, scan all folders for the specified page.
    # Later, could cache page data by page id (in addition to caching by
    # folder-path + page-id, i.e. in addition to actionsByPageByFolder).
    pageFound = undefined
    for folderPath, folderContents of actionsByPageByFolder when (
        folderContents.pagesById?)
      page = folderContents.pagesById[pageId]
      if page
        bugIf pageFound
        pageFound = page
    pageFound


  debiki.v0.server.listRecentUsers = (folderPathsAndPageIds) ->
    # For now.
    template =
      id: undefined
      name: undefined
      email: 'test-user-1@example.com'
      country: 'Neverland'
      ctime: '2012-01-01T00:01:01'
      lastLoginTime: '2012-06-01T00:01:01'

    [
      jQuery.extend({}, template,
          id: 'user01'
          name: 'Test User 1'),
      jQuery.extend({}, template,
          id: 'user02'
          name: 'Another Test User'),
      jQuery.extend({}, template,
          id: 'user03'
          name: 'Pelle Gräddmos'),
      jQuery.extend({}, template,
          id: 'user04'
          name: 'Maja Sanslös'),
    ]


)()

# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
