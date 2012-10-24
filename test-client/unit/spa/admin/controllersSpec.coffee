

describe 'PathsCtrl', ->

  u = _
  scope = undefined
  test = undefined

  beforeEach ->
    module 'AdminModule'
    inject ($rootScope, $controller, _$httpBackend_) ->
      _$httpBackend_.expectGET('/?list-pages.json&in-tree').
          respond { pages: [] }
      scope = $rootScope.$new()
      $controller PathsCtrl, $scope: scope
      test = scope.test

  it 'can sort an empty list', ->
    expect(test.sortItemsInPlace []).toEqual []
    #expect(true).toEqual(false)

  it 'can sort a single page and a single folder', ->
    page = -> [{ path: '/a',  pageId: 'ab12cd' }]
    folder = -> [{ path: '/a/' }]
    expect(test.sortItemsInPlace page()).toEqual page()
    expect(test.sortItemsInPlace folder()).toEqual folder()
    #expect(true).toEqual(false)

  it 'can sort pages in the same folder', ->
    key = -> [
        { path: '/',  pageId: 'ab12cd' },
        { path: '/a', pageId: 'ab12cd' },
        { path: '/z', pageId: 'ab12cd' }]
    expect(test.sortItemsInPlace key().reverse()).toEqual key()
    expect(test.sortItemsInPlace key()).toEqual key()
    #expect(true).toEqual(false)

  it 'can sort a page and a folder', ->
    key = -> [
        { path: '/a',  pageId: 'ab12cd' },
        { path: '/a/', pageId: 'ab12cd' }]
    expect(test.sortItemsInPlace key().reverse()).toEqual key()
    expect(test.sortItemsInPlace key()).toEqual key()
    #expect(true).toEqual(false)

  it 'can sort folders', ->
    key = -> [
        { path: '/a/' },
        { path: '/b/' }]
    expect(test.sortItemsInPlace key().reverse()).toEqual key()
    expect(test.sortItemsInPlace key()).toEqual key()
    #expect(true).toEqual(false)

  it 'can sort deep folders', ->
    key = -> [
        { path: '/a/a/a/' },
        { path: '/a/b/' },
        { path: '/c/' }]
    expect(test.sortItemsInPlace key().reverse()).toEqual key()
    expect(test.sortItemsInPlace key()).toEqual key()
    #expect(true).toEqual(false)

  it 'can sort a folder and its index page', ->
    key = -> [
        { path: '/a/' },
        { path: '/a/', pageId: 'ab12cd' }]
    expect(test.sortItemsInPlace key().reverse()).toEqual key()
    expect(test.sortItemsInPlace key()).toEqual key()
    #expect(true).toEqual(false)

  it 'can sort a few pages and folders, pages first', ->
    key = -> [
        { path: '/' },
        { path: '/', pageId: 'ab12cd' },
        { path: '/a', pageId: 'ab12cd' },
        { path: '/z', pageId: 'ab12cd' },
        { path: '/a/' },
        { path: '/a/', pageId: 'ab12cd' }]
    expect(test.sortItemsInPlace key().reverse()).toEqual key()
    expect(test.sortItemsInPlace _(key()).shuffle()).toEqual key()
    #expect(true).toEqual(false)

  it 'can sort many pages and folders', ->
    key = -> [
        { path: '/' },
        { path: '/', pageId: 'ab12cd' },
        { path: '/a', pageId: 'ab12cd'  },
        { path: '/aa', pageId: 'ab12cd'  },
        { path: '/z', pageId: 'ab12cd'  },
        { path: '/zz', pageId: 'ab12cd'  },
        { path: '/aa/' },
        { path: '/aa/', pageId: 'ab12cd'  },
        { path: '/aa/a', pageId: 'ab12cd'  },
        { path: '/aa/z', pageId: 'ab12cd'  },
        { path: '/aa/aa/' },
        { path: '/aa/aa/a', pageId: 'ab12cd'  },
        { path: '/aa/aa/z', pageId: 'ab12cd'  },
        { path: '/aa/aa/a/' },
        { path: '/b/' },
        { path: '/c/cc/ccc/' },
        { path: '/zz/a', pageId: 'ab12cd'  },
        { path: '/zz/z', pageId: 'ab12cd'  },
        { path: '/zz/b/' }]
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
      key = [{ hideCount: 0, depth: 0, path: '/', displayPath: '', open: false, pageId: 'p0' }]
      expect(applyUpdateHitCounts key).toEqual key

    it 'can hide a page in a closed folder', ->
      key = [
        { hideCount: 0, depth: 0, path: '/aa/', displayPath: 'aa/', open: false },
        { hideCount: 1, depth: 1, path: '/aa/bb', displayPath: 'bb', open: false, pageId: 'pbb' },
        ]
      expect(applyUpdateHitCounts key).toEqual key

    it 'can show a page in an open folder', ->
      key = [
        { hideCount: 0, depth: 0, path: '/aa/', displayPath: 'aa/', open: true },
        { hideCount: 0, depth: 1, path: '/aa/bb', displayPath: 'bb', open: false, pageId: 'pbb' },
        ]
      expect(applyUpdateHitCounts key).toEqual key

    it 'can hide one deeper folder', ->
      key = [
        { hideCount: 0, depth: 0, path: '/aa/', displayPath: 'aa/', open: false },
        { hideCount: 1, depth: 1, path: '/aa/bb/', displayPath: 'bb/', open: false },
        ]
      expect(applyUpdateHitCounts key).toEqual key

    it 'can hide many deeper folders', ->
      # /aa/ shouldn't be pop()ed to many times.
      key = [
        { hideCount: 0, depth: 0, path: '/aa/', displayPath: 'aa/', open: false },
        { hideCount: 1, depth: 1, path: '/aa/bb/', displayPath: 'bb/', open: false },
        { hideCount: 1, depth: 1, path: '/aa/cc/', displayPath: 'cc/', open: false },
        { hideCount: 1, depth: 1, path: '/aa/dd/', displayPath: 'dd/', open: false },
        ]
      expect(applyUpdateHitCounts key).toEqual key

    it 'can show a deeper folder that is no child of any prev closed folder', ->
      key = [
        { hideCount: 0, depth: 0, path: '/aa/', displayPath: 'aa/', open: false },
        { hideCount: 0, depth: 0, path: '/bb/cc/', displayPath: 'bb/cc/', open: false }, # not in /aa/
        ]
      expect(applyUpdateHitCounts key).toEqual key

    it 'can handle a folder that is a child of the last but one prev folder', ->
      key = [
        { hideCount: 0, depth: 0, path: '/a/', displayPath: 'a/', open: false },
        { hideCount: 1, depth: 1, path: '/a/b/', displayPath: 'b/', open: false },
        { hideCount: 2, depth: 2, path: '/a/b/c', displayPath: 'c', open: false },  # in /a/b/
        { hideCount: 1, depth: 1, path: '/a/x/y/', displayPath: 'x/y/', open: false }, # in /a/
        ]
      expect(applyUpdateHitCounts key).toEqual key

    it 'same as above, but folders open', ->
      key = [
        { hideCount: 0, depth: 0, path: '/a/', displayPath: 'a/', open: true },
        { hideCount: 0, depth: 1, path: '/a/b/', displayPath: 'b/', open: true },
        { hideCount: 0, depth: 2, path: '/a/b/c', displayPath: 'c', open: true },  # in /a/b/
        { hideCount: 0, depth: 1, path: '/a/x/y/', displayPath: 'x/y/', open: true}, # in /a/
        ]
      expect(applyUpdateHitCounts key).toEqual key


# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
