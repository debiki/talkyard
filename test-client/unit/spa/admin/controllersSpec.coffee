

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

  it 'should recognize pages', ->
    expect(scope.isPage { pageId: '12ab34' }).toBe true
    expect(scope.isPage {}).toBe false

  it 'should recognize folders', ->
    expect(scope.isFolder { pageId: '12ab34' }).toBe false
    expect(scope.isFolder {}).toBe true

  it 'can sort an empty list', ->
    expect(test.sortPathsInPlace []).toEqual []
    #expect(true).toEqual(false)

  it 'can sort a single page and a single folder', ->
    page = -> [{ value: '/a',  pageId: 'ab12cd' }]
    folder = -> [{ value: '/a/' }]
    expect(test.sortPathsInPlace page()).toEqual page()
    expect(test.sortPathsInPlace folder()).toEqual folder()
    #expect(true).toEqual(false)

  it 'can sort pages in the same folder', ->
    key = -> [
        { value: '/',  pageId: 'ab12cd' },
        { value: '/a', pageId: 'ab12cd' },
        { value: '/z', pageId: 'ab12cd' }]
    expect(test.sortPathsInPlace key().reverse()).toEqual key()
    expect(test.sortPathsInPlace key()).toEqual key()
    #expect(true).toEqual(false)

  it 'can sort a page and a folder', ->
    key = -> [
        { value: '/a',  pageId: 'ab12cd' },
        { value: '/a/', pageId: 'ab12cd' }]
    expect(test.sortPathsInPlace key().reverse()).toEqual key()
    expect(test.sortPathsInPlace key()).toEqual key()
    #expect(true).toEqual(false)

  it 'can sort folders', ->
    key = -> [
        { value: '/a/' },
        { value: '/b/' }]
    expect(test.sortPathsInPlace key().reverse()).toEqual key()
    expect(test.sortPathsInPlace key()).toEqual key()
    #expect(true).toEqual(false)

  it 'can sort deep folders', ->
    key = -> [
        { value: '/a/a/a/' },
        { value: '/a/b/' },
        { value: '/c/' }]
    expect(test.sortPathsInPlace key().reverse()).toEqual key()
    expect(test.sortPathsInPlace key()).toEqual key()
    #expect(true).toEqual(false)

  it 'can sort a folder and its index page', ->
    key = -> [
        { value: '/a/' },
        { value: '/a/', pageId: 'ab12cd' }]
    expect(test.sortPathsInPlace key().reverse()).toEqual key()
    expect(test.sortPathsInPlace key()).toEqual key()
    #expect(true).toEqual(false)

  it 'can sort a few pages and folders, pages first', ->
    key = -> [
        { value: '/' },
        { value: '/', pageId: 'ab12cd' },
        { value: '/a', pageId: 'ab12cd' },
        { value: '/z', pageId: 'ab12cd' },
        { value: '/a/' },
        { value: '/a/', pageId: 'ab12cd' }]
    expect(test.sortPathsInPlace key().reverse()).toEqual key()
    expect(test.sortPathsInPlace _(key()).shuffle()).toEqual key()
    #expect(true).toEqual(false)

  it 'can sort many pages and folders', ->
    key = -> [
        { value: '/' },
        { value: '/', pageId: 'ab12cd' },
        { value: '/a', pageId: 'ab12cd'  },
        { value: '/aa', pageId: 'ab12cd'  },
        { value: '/z', pageId: 'ab12cd'  },
        { value: '/zz', pageId: 'ab12cd'  },
        { value: '/aa/' },
        { value: '/aa/', pageId: 'ab12cd'  },
        { value: '/aa/a', pageId: 'ab12cd'  },
        { value: '/aa/z', pageId: 'ab12cd'  },
        { value: '/aa/aa/' },
        { value: '/aa/aa/a', pageId: 'ab12cd'  },
        { value: '/aa/aa/z', pageId: 'ab12cd'  },
        { value: '/aa/aa/a/' },
        { value: '/b/' },
        { value: '/c/cc/ccc/' },
        { value: '/zz/a', pageId: 'ab12cd'  },
        { value: '/zz/z', pageId: 'ab12cd'  },
        { value: '/zz/b/' }]
    expect(test.sortPathsInPlace key().reverse()).toEqual key()
    expect(test.sortPathsInPlace _(key()).shuffle()).toEqual key()
    expect(test.sortPathsInPlace key()).toEqual key()
    #expect(true).toEqual(false)


# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
