
d = i: debiki.internal, u: debiki.v0.util


ab = -> { a: 'aa', b: 'bb' }
a  = -> { a: 'aa' }
b  = -> { b: 'bb' }

a2b2 = -> { a: 'aa2', b: 'bb2' }
a2  = -> { a: 'aa2' }
b2  = -> { b: 'bb2' }

a2b = -> { a: 'aa2', b: 'bb' }


describe '_.kick', ->
  it 'should kick away properties from objects', ->
    expect(_(ab()).kick('b')).toEqual(a())
    expect(_(ab()).kick('a')).toEqual(b())
    expect(_(ab()).kick('c')).toEqual(ab())


testMapValsHelper = (f) ->
  expect(f({}, (value) -> value + '2')).toEqual {}
  expect(f(a(), (value) -> value + '2')).toEqual a2()
  expect(f(ab(), (value) -> value + '2')).toEqual a2b2()
  onlyA = f ab(), (value, key) ->
    if key is 'a' then value + '2' else value
  expect(onlyA).toEqual a2b()


describe '_.mapVals', ->
  it 'should transform object property values', ->
    testMapValsHelper(_.mapVals)


describe '_.mapValsKickUndef', ->
  it 'work as mapVals, and also remove keys mapping to `undefined`', ->
    testMapValsHelper(_.mapValsKickUndef)
    expect(_.mapValsKickUndef({}, -> undefined)).toEqual {}
    expect(_.mapValsKickUndef(a(), -> undefined)).toEqual {}
    expect(_.mapValsKickUndef(ab(), -> undefined)).toEqual {}
    # Kick 'b':
    onlyA = _.mapValsKickUndef ab(), (value, key) ->
      if key is 'a' then value + '2' else undefined
    expect(onlyA).toEqual a2()


describe 'analyzePagePath', ->

  analyzePagePath = d.i.analyzePagePath

  it "analyze the homepage", ->
    expect(analyzePagePath '/').toEqual(
        folder: '/'
        pageSlug: ''
        showId: false
        pageId: null)

  it "analyze a page, id hidden", ->
    expect(analyzePagePath '/slug').toEqual(
        folder: '/'
        pageSlug: 'slug'
        showId: false
        pageId: null)

  it "analyze a page with id shown, no slug", ->
    expect(analyzePagePath '/-pageid').toEqual(
        folder: '/'
        pageSlug: ''
        showId: true
        pageId: 'pageid')

  it "analyze a page with id shown, with slug", ->
    expect(analyzePagePath '/-pageid-pageslug').toEqual(
        folder: '/'
        pageSlug: 'pageslug'
        showId: true
        pageId: 'pageid')

  it "analyze an -id-slug page, query string with slashes and dashes", ->
    expect(analyzePagePath '/f/-pageid-slug?/ignore/-this-please').toEqual(
        folder: '/f/'
        pageSlug: 'slug'
        showId: true
        pageId: 'pageid')

  it "analyze a page with id shown, trailing `-`", ->
    expect(analyzePagePath '/-pageid-').toEqual(
        folder: '/'
        pageSlug: ''
        showId: true
        pageId: 'pageid')

  it "analyze a page with id hidden, trailing `-`", ->
    expect(analyzePagePath '/slug-').toEqual(
        folder: '/'
        pageSlug: 'slug-'
        showId: false
        pageId: null)

  it "analyze a deep page, id hidden", ->
    expect(analyzePagePath '/parent/folder/the-page').toEqual(
        folder: '/parent/folder/'
        pageSlug: 'the-page'
        showId: false
        pageId: null)

  it "analyze a deep page, id shown", ->
    expect(analyzePagePath '/parent/folder/-id-the-page').toEqual(
        folder: '/parent/folder/'
        pageSlug: 'the-page'
        showId: true
        pageId: 'id')

  it "analyze a deep page, id shown, no slug", ->
    expect(analyzePagePath '/parent/folder/-pageid').toEqual(
        folder: '/parent/folder/'
        pageSlug: ''
        showId: true
        pageId: 'pageid')

  it "analyze a deep index page", ->
    expect(analyzePagePath '/parent/folder/').toEqual(
        folder: '/parent/folder/'
        pageSlug: ''
        showId: false
        pageId: null)

  it "analyze a path with a ?view-new-page query string, id shown", ->
    expect(analyzePagePath '/f/-ab3-sluggo?view-new-page=ab3').toEqual(
        folder: '/f/'
        pageSlug: 'sluggo'
        showId: true
        pageId: 'ab3')

  it "analyze a path with a ?view-new-page query string, id hidden", ->
    expect(analyzePagePath '/f/slugge?view-new-page=ab3').toEqual(
        folder: '/f/'
        pageSlug: 'slugge'
        showId: false
        pageId: 'ab3')

  it "analyze a ?view-new-page query string, with trailing query params", ->
    expect(analyzePagePath '/f/?view-new-page=ab3&foo=bar').toEqual(
        folder: '/f/'
        pageSlug: ''
        showId: false
        pageId: 'ab3')



describe 'changePageSlugIn', ->

  changePageSlugIn = d.i.changePageSlugIn

  # Note that Jasmin seems to overwrite the error message from the first
  # loop lap with the one from the 2nd lap ??. So if a test fails for both
  # '' and '/folder', the err mess for '' might (incorrectly) be identical
  # to the one for '/folder'. Or am I missing something?
  # COULD replace #{folder} with #folder if porting to LiveScript.

  for folder, i in ['', '/folder']

    # With no slug, before.

    it "can change slug in '#{folder}/' to ''", ->
      expect(changePageSlugIn "#{folder}/", to: "").toEqual("#{folder}/")

    it "can change slug in '#{folder}/' to 'slug'", ->
      expect(changePageSlugIn "#{folder}/", to: "slug").toEqual("#{folder}/slug")

    it "can change slug in '#{folder}/-id' to ''", ->
      expect(changePageSlugIn "#{folder}/-id", to: "").toEqual("#{folder}/-id")

    it "can change slug in '#{folder}/-id' to 'slug'", ->
      expect(changePageSlugIn "#{folder}/-id", to: "slug").toEqual("#{folder}/-id-slug")

    it "can change slug in '#{folder}/-id-' to ''", ->
      expect(changePageSlugIn "#{folder}/-id-", to: "").toEqual("#{folder}/-id")

    it "can change slug in '#{folder}/-id-' to 'slug'", ->
      expect(changePageSlugIn "#{folder}/-id-", to: "slug").toEqual("#{folder}/-id-slug")

    # With slug, before.

    it "can change slug in '#{folder}/old' to ''", ->
      expect(changePageSlugIn "#{folder}/old", to: "").toEqual("#{folder}/")

    it "can change slug in '#{folder}/old' to 'slug'", ->
      expect(changePageSlugIn "#{folder}/old", to: "slug").toEqual("#{folder}/slug")

    it "can change slug in '#{folder}/-id-old' to ''", ->
      expect(changePageSlugIn "#{folder}/-id-old", to: "").toEqual("#{folder}/-id")

    it "can change slug in '#{folder}/-id-old' to 'slug'", ->
      expect(changePageSlugIn "#{folder}/-id-old", to: "slug").toEqual("#{folder}/-id-slug")


# vim: fdm=marker et ts=2 sw=2 fo=tcqwn list tw=80
