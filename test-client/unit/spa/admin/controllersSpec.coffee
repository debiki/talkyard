

describe 'PathsCtrl', ->

  u = _
  scope = undefined
  test = undefined
  PageListItem = undefined
  FolderListItem = undefined

  beforeEach ->
    module 'AdminModule'
    inject ($rootScope, $controller, _$httpBackend_) ->
      _$httpBackend_.expectGET('/?list-pages.json&in-tree').
          respond { pages: [] }
      scope = $rootScope.$new()
      $controller PathsCtrl, $scope: scope
      test = scope.test
      PageListItem = test.PageListItem
      FolderListItem = test.FolderListItem

  it 'can sort an empty list', ->
    expect(test.sortItemsInPlace []).toEqual []
    #expect(true).toEqual(false)

  it 'can sort a single page and a single folder', ->
    page = -> [PageListItem { path: '/a',  pageId: 'ab12cd' }]
    folder = -> [FolderListItem { path: '/a/' }]
    expect(test.sortItemsInPlace page()).toEqual page()
    expect(test.sortItemsInPlace folder()).toEqual folder()
    #expect(true).toEqual(false)

  it 'can sort pages in the same folder', ->
    key = -> [
        PageListItem { path: '/',  pageId: 'ab12cd' },
        PageListItem { path: '/a', pageId: 'ab12cd' },
        PageListItem { path: '/z', pageId: 'ab12cd' }]
    expect(test.sortItemsInPlace key().reverse()).toEqual key()
    expect(test.sortItemsInPlace key()).toEqual key()
    #expect(true).toEqual(false)

  it 'can sort a page and a folder', ->
    key = -> [
        PageListItem { path: '/a',  pageId: 'ab12cd' },
        PageListItem { path: '/a/', pageId: 'ab12cd' }]
    expect(test.sortItemsInPlace key().reverse()).toEqual key()
    expect(test.sortItemsInPlace key()).toEqual key()
    #expect(true).toEqual(false)

  it 'can sort folders', ->
    key = -> [
        FolderListItem { path: '/a/' },
        FolderListItem { path: '/b/' }]
    expect(test.sortItemsInPlace key().reverse()).toEqual key()
    expect(test.sortItemsInPlace key()).toEqual key()
    #expect(true).toEqual(false)

  it 'can sort deep folders', ->
    key = -> [
        FolderListItem { path: '/a/a/a/' },
        FolderListItem { path: '/a/b/' },
        FolderListItem { path: '/c/' }]
    expect(test.sortItemsInPlace key().reverse()).toEqual key()
    expect(test.sortItemsInPlace key()).toEqual key()
    #expect(true).toEqual(false)

  it 'can sort a folder and its index page', ->
    key = -> [
        FolderListItem { path: '/a/' },
        PageListItem { path: '/a/', pageId: 'ab12cd' }]
    expect(test.sortItemsInPlace key().reverse()).toEqual key()
    expect(test.sortItemsInPlace key()).toEqual key()
    #expect(true).toEqual(false)

  it 'can sort a few pages and folders, pages first', ->
    key = -> [
        FolderListItem { path: '/' },
        PageListItem { path: '/', pageId: 'ab12cd' },
        PageListItem { path: '/a', pageId: 'ab12cd' },
        PageListItem { path: '/z', pageId: 'ab12cd' },
        FolderListItem { path: '/a/' },
        PageListItem { path: '/a/', pageId: 'ab12cd' }]
    expect(test.sortItemsInPlace key().reverse()).toEqual key()
    expect(test.sortItemsInPlace _(key()).shuffle()).toEqual key()
    #expect(true).toEqual(false)

  it 'can sort many pages and folders', ->
    key = -> [
        FolderListItem { path: '/' },
        PageListItem { path: '/', pageId: 'ab12cd' },
        PageListItem { path: '/a', pageId: 'ab12cd'  },
        PageListItem { path: '/aa', pageId: 'ab12cd'  },
        PageListItem { path: '/z', pageId: 'ab12cd'  },
        PageListItem { path: '/zz', pageId: 'ab12cd'  },
        FolderListItem { path: '/aa/' },
        PageListItem { path: '/aa/', pageId: 'ab12cd'  },
        PageListItem { path: '/aa/a', pageId: 'ab12cd'  },
        PageListItem { path: '/aa/z', pageId: 'ab12cd'  },
        FolderListItem { path: '/aa/aa/' },
        PageListItem { path: '/aa/aa/a', pageId: 'ab12cd'  },
        PageListItem { path: '/aa/aa/z', pageId: 'ab12cd'  },
        FolderListItem { path: '/aa/aa/a/' },
        FolderListItem { path: '/b/' },
        FolderListItem { path: '/c/cc/ccc/' },
        PageListItem { path: '/zz/a', pageId: 'ab12cd'  },
        PageListItem { path: '/zz/z', pageId: 'ab12cd'  },
        FolderListItem { path: '/zz/b/' }]
    expect(test.sortItemsInPlace key().reverse()).toEqual key()
    expect(test.sortItemsInPlace _(key()).shuffle()).toEqual key()
    expect(test.sortItemsInPlace key()).toEqual key()
    #expect(true).toEqual(false)

  describe 'updateListItemFields', ->

    applyUpdateHitCounts = (paths) ->
      result = map ((path) -> _(path).kick('hideCount')), paths
      test.updateListItemFields result
      result

    it 'can handle empty lists', ->
      key = []
      expect(applyUpdateHitCounts key).toEqual key

    it 'can show a single homepage', ->
      key = [PageListItem { hideCount: 0, depth: 0, path: '/', _displayPath: '', open: false, pageId: 'p0' }]
      expect(applyUpdateHitCounts key).toEqual key

    it 'can hide a page in a closed folder', ->
      key = [
        FolderListItem { hideCount: 0, depth: 0, path: '/aa/', _displayPath: 'aa/', open: false },
        PageListItem { hideCount: 1, depth: 1, path: '/aa/bb', _displayPath: 'bb', open: false, pageId: 'pbb' },
        ]
      expect(applyUpdateHitCounts key).toEqual key

    it 'can show a page in an open folder', ->
      key = [
        FolderListItem { hideCount: 0, depth: 0, path: '/aa/', _displayPath: 'aa/', open: true },
        PageListItem { hideCount: 0, depth: 1, path: '/aa/bb', _displayPath: 'bb', open: false, pageId: 'pbb' },
        ]
      expect(applyUpdateHitCounts key).toEqual key

    it 'can hide one deeper folder', ->
      key = [
        FolderListItem { hideCount: 0, depth: 0, path: '/aa/', _displayPath: 'aa/', open: false },
        FolderListItem { hideCount: 1, depth: 1, path: '/aa/bb/', _displayPath: 'bb/', open: false },
        ]
      expect(applyUpdateHitCounts key).toEqual key

    it 'can hide many deeper folders', ->
      # /aa/ shouldn't be pop()ed to many times.
      key = [
        FolderListItem { hideCount: 0, depth: 0, path: '/aa/', _displayPath: 'aa/', open: false },
        FolderListItem { hideCount: 1, depth: 1, path: '/aa/bb/', _displayPath: 'bb/', open: false },
        FolderListItem { hideCount: 1, depth: 1, path: '/aa/cc/', _displayPath: 'cc/', open: false },
        FolderListItem { hideCount: 1, depth: 1, path: '/aa/dd/', _displayPath: 'dd/', open: false },
        ]
      expect(applyUpdateHitCounts key).toEqual key

    it 'can show a deeper folder that is no child of any prev closed folder', ->
      key = [
        FolderListItem { hideCount: 0, depth: 0, path: '/aa/', _displayPath: 'aa/', open: false },
        FolderListItem { hideCount: 0, depth: 0, path: '/bb/cc/', _displayPath: 'bb/cc/', open: false }, # not in /aa/
        ]
      expect(applyUpdateHitCounts key).toEqual key

    it 'can handle a folder that is a child of the last but one prev folder', ->
      key = [
        FolderListItem { hideCount: 0, depth: 0, path: '/a/', _displayPath: 'a/', open: false },
        FolderListItem { hideCount: 1, depth: 1, path: '/a/b/', _displayPath: 'b/', open: false },
        FolderListItem { hideCount: 2, depth: 2, path: '/a/b/c', _displayPath: 'c', open: false },  # in /a/b/
        FolderListItem { hideCount: 1, depth: 1, path: '/a/x/y/', _displayPath: 'x/y/', open: false }, # in /a/
        ]
      expect(applyUpdateHitCounts key).toEqual key

    it 'same as above, but folders open', ->
      key = [
        FolderListItem { hideCount: 0, depth: 0, path: '/a/', _displayPath: 'a/', open: true },
        FolderListItem { hideCount: 0, depth: 1, path: '/a/b/', _displayPath: 'b/', open: true },
        FolderListItem { hideCount: 0, depth: 2, path: '/a/b/c', _displayPath: 'c', open: true },  # in /a/b/
        FolderListItem { hideCount: 0, depth: 1, path: '/a/x/y/', _displayPath: 'x/y/', open: true}, # in /a/
        ]
      expect(applyUpdateHitCounts key).toEqual key


# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
