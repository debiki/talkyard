

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


# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
