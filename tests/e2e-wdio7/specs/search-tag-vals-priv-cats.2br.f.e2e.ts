/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';
import { TestThingType, TestTypeValueType } from '../test-constants';



let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maja: Member;
let maja_brB: TyE2eTestBrowser;
let trillian: Member;
let trillian_brB: TyE2eTestBrowser;
let stranger_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;  // or TwoPagesTestForum or EmptyTestForum or LargeTestForum

let MaxPagesHit_Owen = 8;
let MaxPagesHit_Maja = 4;
let MaxPagesHit_Trillian = 7;


/*   The _pages_and_tags:

  Page_AA11:  Nr: 11  Letter: AA  Kittens:  0.0   for everyone   *no* pangolins!
  Page_BB22:  Nr: 22  Letter: BB  Kittens:  1.22  –"–            has pangolins
  Page_BB33:  Nr: 33  Letter: BB  Kittens:  1.33                 has pangolins
  Page_BB44:  Nr: 44  Letter: BB  Kittens:  1.44                 has pangolins
  Page_SS66:  Nr: 66  Letter: SS  Kittens: -1.66  staff-only     has pangolins
  Page_TT77:  Nr: 77  Letter: TT  Kittens:  1.33  trusted group  has pangolins
  Page_TT88:  Nr: 88  Letter: TT  Kittens:  1.33             no pangolins! Nothing here to see
  Page_TT99:  Nr: 99  Letter: TT  Kittens:  1.33                 has pangolins

*/



describe(`search-tag-vals-priv-cats.2br.f  TyTSEARCHTAGSPRIVCAT`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addCatABTrustedForum({
      title: "Search Tag Vals Priv Cats E2E Test",
      members: ['trillian', 'michael', 'maja']
    });

    builder.getSite().isTestSiteIndexAnyway = true;

    // Enable tags.
    // Disable notifications (not part of this test anyway).
    builder.settings({
      enableTags: true,
      numFirstPostsToApprove: 0,
      numFirstPostsToReview: 0,
    });
    builder.getSite().pageNotfPrefs = [{
      memberId: forum.members.owen.id,
      notfLevel: c.TestPageNotfLevel.Muted,
      wholeSite: true,
    }];

    const nrType: TypeV0 = builder.addType({
      // id:  assigned by the server
      refId: 'nr_type',
      canTagWhat: TestThingType.Posts as any, // 'Posts'
      dispName: 'Nr',
      urlSlug: 'nr',
      valueType: TestTypeValueType.Int32 as any, // 'Int32',
      createdById: forum.members.owen.id,
    });

    const letterType: TypeV0 = builder.addType({
      refId: 'letter_type',
      canTagWhat: TestThingType.Posts as any,
      dispName: 'Letter',
      urlSlug: 'letter',
      valueType: TestTypeValueType.StrKwd as any,
      createdById: forum.members.owen.id,
    });

    const kittensType: TypeV0 = builder.addType({
      refId: 'kittens_type',
      canTagWhat: TestThingType.Posts as any,
      dispName: 'Kittens',
      urlSlug: 'kittens',
      valueType: TestTypeValueType.Flt64 as any,
      createdById: forum.members.owen.id,
    });


    // See _pages_and_tags above:

    const pageAA11: PageJustAdded = builder.addPage({
      id: 'pageAA11',  // _try_all_id_types
      folder: '/',
      showId: false,
      slug: 'page-aa11',
      role: c.TestPageRole.Discussion,
      title: "Page_AA11",
      body: "Page_AA11_text, aa11 aa11.",
      categoryId: forum.categories.categoryA.id,
      authorId: forum.members.michael.id,
      tags: [{
        //typeRef: 'rid:nr_type',
        tagTypeId: nrType.id,
        valType: TestTypeValueType.Int32 as any,
        valInt32: 11,
      }, {
        tagTypeId: letterType.id,
        valType: TestTypeValueType.StrKwd as any,
        valStr: 'AA',
      }, {
        tagTypeId: kittensType.id,
        valType: TestTypeValueType.Flt64 as any,
        valFlt64: 0.0,
      }] as TagV0[],
    });

    const pageBB22: PageJustAdded = builder.addPage({
      id: 'pageBB22',
      refId: 'pageBB22',  // _try_all_id_types
      folder: '/',
      showId: false,
      slug: 'page-bb22',
      role: c.TestPageRole.Discussion,
      title: "Page_BB22",
      body: "Page_BB22_text, bb22 bb22. Pangolins.",
      categoryId: forum.categories.catB.id,
      authorId: forum.members.michael.id,
      tags: [{
        tagTypeId: nrType.id,
        valType: TestTypeValueType.Int32 as any,
        valInt32: 22,
      }, {
        tagTypeId: letterType.id,
        valType: TestTypeValueType.StrKwd as any,
        valStr: 'BB',
      }, {
        tagTypeId: kittensType.id,
        valType: TestTypeValueType.Flt64 as any,
        valFlt64: 1.22,
      }] as TagV0[],
    });

    const pageBB33: PageJustAdded = builder.addPage({
      id: 'pageBB33',
      extId: 'pageBB33',  // _try_all_id_types
      folder: '/',
      showId: false,
      slug: 'page-bb33',
      role: c.TestPageRole.Discussion,
      title: "Page_BB33",
      body: "Page_BB33_text, bb33 bb33. Pangolins.",
      categoryId: forum.categories.catB.id,
      authorId: forum.members.michael.id,
      tags: [{
        tagTypeId: nrType.id,
        valType: TestTypeValueType.Int32 as any,
        valInt32: 33,
      }, {
        tagTypeId: letterType.id,
        valType: TestTypeValueType.StrKwd as any,
        valStr: 'BB',
      }, {
        tagTypeId: kittensType.id,
        valType: TestTypeValueType.Flt64 as any,
        valFlt64: 1.33,
      }] as TagV0[],
    });

    const pageBB44: PageJustAdded = builder.addPage({
      id: 'pageBB44',
      folder: '/',
      showId: false,
      slug: 'page-bb44',
      role: c.TestPageRole.Discussion,
      title: "Page_BB44",
      body: "Page_BB44_text, bb44 bb44. Pangolins.",
      categoryId: forum.categories.catB.id,
      authorId: forum.members.michael.id,
      tags: [{
        tagTypeId: nrType.id,
        valType: TestTypeValueType.Int32 as any,
        valInt32: 44,
      }, {
        tagTypeId: letterType.id,
        valType: TestTypeValueType.StrKwd as any,
        valStr: 'BB',
      }, {
        tagTypeId: kittensType.id,
        valType: TestTypeValueType.Flt64 as any,
        valFlt64: 1.44,
      }] as TagV0[],
    });

    const pageSS66: PageJustAdded = builder.addPage({
      id: 'pageSS66',
      folder: '/',
      showId: false,
      slug: 'page-ss66',
      role: c.TestPageRole.Discussion,
      title: "Page_SS66",
      body: "Page_SS66_text, ss66 ss66. Pangolins.",
      categoryId: forum.categories.staffCat.id,
      authorId: forum.members.michael.id,
      tags: [{
        tagTypeId: nrType.id,
        valType: TestTypeValueType.Int32 as any,
        valInt32: 66,
      }, {
        tagTypeId: letterType.id,
        valType: TestTypeValueType.StrKwd as any,
        valStr: 'SS',
      }, {
        tagTypeId: kittensType.id,
        valType: TestTypeValueType.Flt64 as any,
        valFlt64: -1.66,
      }] as TagV0[],
    });

    const pageTT77: PageJustAdded = builder.addPage({
      id: 'pageTT77',
      folder: '/',
      showId: false,
      slug: 'page-tt77',
      role: c.TestPageRole.Discussion,
      title: "Page_TT77",
      body: "Page_TT77_text, tt77 tt77. Pangolins.",
      categoryId: forum.categories.trustedCat.id,
      authorId: forum.members.michael.id,
      tags: [{
        tagTypeId: nrType.id,
        valType: TestTypeValueType.Int32 as any,
        valInt32: 77,
      }, {
        tagTypeId: letterType.id,
        valType: TestTypeValueType.StrKwd as any,
        valStr: 'TT',
      }, {
        tagTypeId: kittensType.id,
        valType: TestTypeValueType.Flt64 as any,
        valFlt64: 1.33,
      }],
    });

    const pageTT88: PageJustAdded = builder.addPage({
      id: 'pageTT88',
      folder: '/',
      showId: false,
      slug: 'page-tt88',
      role: c.TestPageRole.Discussion,
      title: "Page_TT88",
      body: "Page_TT88_text, tt88 tt88.",
      categoryId: forum.categories.trustedCat.id,
      authorId: forum.members.michael.id,
      tags: [{
        tagTypeId: nrType.id,
        valType: TestTypeValueType.Int32 as any,
        valInt32: 88,
      }, {
        tagTypeId: letterType.id,
        valType: TestTypeValueType.StrKwd as any,
        valStr: 'TT',
      }, {
        tagTypeId: kittensType.id,
        valType: TestTypeValueType.Flt64 as any,
        valFlt64: 1.33,
      }] as TagV0[],
    });

    const pageTT99: PageJustAdded = builder.addPage({
      id: 'pageTT99',
      folder: '/',
      showId: false,
      slug: 'page-tt99',
      role: c.TestPageRole.Discussion,
      title: "Page_TT99",
      body: "Page_TT99_text, tt99 tt99. Pangolins.",
      categoryId: forum.categories.trustedCat.id,
      authorId: forum.members.michael.id,
      tags: [{
        tagTypeId: nrType.id,
        valType: TestTypeValueType.Int32 as any,
        valInt32: 99,
      }, {
        tagTypeId: letterType.id,
        valType: TestTypeValueType.StrKwd as any,
        valStr: 'TT',
      }, {
        tagTypeId: kittensType.id,
        valType: TestTypeValueType.Flt64 as any,
        valFlt64: 1.33,
      }],
    });



    builder.addPost({
      page: pageAA11,  // or e.g.: forum.topics.byMichaelCategoryA,
      nr: c.FirstReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.maja.id,
      approvedSource: "You can impress others by boiling potatoes in a frying pan",
    });

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    maja = forum.members.maja;
    maja_brB = brB;
    trillian = forum.members.trillian;
    trillian_brB = brB;
    stranger_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    await server.skipRateLimits(site.id);
  });


  it(`Owen goes to the search page, logs in ... `, async () => {
    await owen_brA.searchResultsPage.goHere(site.origin);
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });



  // ----- Decimal numbers, and = > <=


  it(`Owen searches for the "kittens" tag`, async () => {
    await owen_brA.searchResultsPage.searchForUntilNumPagesFound("tag:kittens", MaxPagesHit_Owen);
  });
  it(`... he finds ${MaxPagesHit_Owen} pages — kittens, so popular`, async () => {
    await owen_brA.searchResultsPage.assertResultLinksAre([
          '/page-aa11#post-1',
          '/page-bb22#post-1',
          '/page-bb33#post-1',
          '/page-bb44#post-1',
          '/page-ss66#post-1',
          '/page-tt77#post-1',
          '/page-tt88#post-1',
          '/page-tt99#post-1',
          ], { anyOrder: true });
  });

  it(`Maja logs in`, async () => {
    await maja_brB.go2(site.origin);
    await maja_brB.complex.loginWithPasswordViaTopbar(maja);
  });

  it(`... searches for the "kittens" tag too`, async () => {
    await maja_brB.topbar.searchFor("tag:kittens");
  });
  it(`... finds the public pages only`, async () => {
    await maja_brB.searchResultsPage.assertResultLinksAre([
          '/page-aa11#post-1',
          '/page-bb22#post-1',
          '/page-bb33#post-1',
          '/page-bb44#post-1',
          ], { anyOrder: true });
  });

  it(`But more Kittens, of course, is better.  Owen searches for  >=1.33`, async () => {
    await owen_brA.searchResultsPage.searchForWaitForResults("tag:kittens>=1.33");
  });
  it(`... he finds some pages`, async () => {
    await owen_brA.searchResultsPage.assertResultLinksAre([
        //'/page-aa11#post-1',  // kittens  0.0
        //'/page-bb22#post-1',  // kittens  1.22
          '/page-bb33#post-1',  // kittens  1.33
          '/page-bb44#post-1',  // kittens  1.44
        //'/page-ss66#post-1',  // kittens -1.66
          '/page-tt77#post-1',  // kittens  1.33
          '/page-tt88#post-1',  // kittens  1.33
          '/page-tt99#post-1',  // kittens  1.33
          ], { anyOrder: true });
  });

  it(`Maja likes more kittens too, also searches for  >=1.33`, async () => {
    await maja_brB.searchResultsPage.searchForWaitForResults("tag:kittens>=1.33");
    await maja_brB.searchResultsPage.assertResultLinksAre([
        //'/page-aa11#post-1',  // kittens  0.0
        //'/page-bb22#post-1',  // kittens  1.22
          '/page-bb33#post-1',  // kittens  1.33
          '/page-bb44#post-1',  // kittens  1.44
          ], { anyOrder: true });
  });

  it(`If  >1.33,  they find just one page`, async () => {
    await owen_brA.searchResultsPage.searchForWaitForResults("tag:kittens>1.33");
    await owen_brA.searchResultsPage.assertResultLinksAre([
          '/page-bb44#post-1',  // kittens  1.44
          ]);
  });

  it(`Negative numbers work`, async () => {
    await owen_brA.searchResultsPage.searchForWaitForResults("tag:kittens<0.5");
    await owen_brA.searchResultsPage.assertResultLinksAre([
          '/page-aa11#post-1',  // kittens  0.0
          '/page-ss66#post-1',  // kittens -1.66
          ], { anyOrder: true });
  });

  it(`Too many zeros works too`, async () => {
    // When we added the tag, we set it to 0.0, but since are numbers, 0.000 is the same.
    await owen_brA.searchResultsPage.searchForWaitForResults("tag:kittens=0.00000");
    await owen_brA.searchResultsPage.assertResultLinksAre([
          '/page-aa11#post-1',  // kittens  0.0
          ]);
  });

  it(`... also for negative numbers`, async () => {
    await owen_brA.searchResultsPage.searchForWaitForResults("tag:kittens=-1.66000");
    await owen_brA.searchResultsPage.assertResultLinksAre([
          '/page-ss66#post-1',  // kittens -1.66
          ]);
  });



  // ----- Integers, and = > <=


  it(`Owen searches for Nr = 77,  a trusted-members-only page`, async () => {
    await owen_brA.searchResultsPage.searchForUntilNumPagesFound("tag:nr=77", 1);
  });
  it(`... he finds page TT77`, async () => {
    await owen_brA.searchResultsPage.assertResultLinksAre([
          '/page-tt77#post-1',
          ]);
  });

  it(`Maja searches for Nr = 77, finds nothing — she's not a Trusted member`, async () => {
    await maja_brB.searchResultsPage.searchForWaitForResults("tag:nr=77");
    await maja_brB.searchResultsPage.assertResultLinksAre([]);
  });

  it(`Maja searches for Nr = 22 instead`, async () => {
    await maja_brB.searchResultsPage.searchForUntilNumPagesFound("tag:nr=22", 1);
  });
  it(`... finds BB22, a public topic`, async () => {
    await maja_brB.searchResultsPage.assertResultLinksAre([
          '/page-bb22#post-1',
          ]);
  });

  it(`Owen searches for Nr > 33`, async () => {
    await owen_brA.searchResultsPage.searchForUntilNumPagesFound("tag:nr>33", 5);
  });
  it(`... finds pages 44, 66, 77, 88, 99`, async () => {
    await owen_brA.searchResultsPage.assertResultLinksAre([
        //'/page-aa11#post-1',
        //'/page-bb22#post-1',
        //'/page-bb33#post-1',
          '/page-bb44#post-1',
          '/page-ss66#post-1',
          '/page-tt77#post-1',
          '/page-tt88#post-1',
          '/page-tt99#post-1',
          ], { anyOrder: true });
  });

  it(`But when Maja searches for Nr > 33`, async () => {
    await maja_brB.searchResultsPage.searchForUntilNumPagesFound("tag:nr>33", 1);
  });
  it(`... she finds only page BB44`, async () => {
    await maja_brB.searchResultsPage.assertResultLinksAre([
          '/page-bb44#post-1',
          ]);
  });



  // ----- Words, and = > <=

  // Currently case-sensitive, this won't work:  'tag:letter=bb'  hmm.

  it(`Maja searches for  letter=BB`, async () => {
    await maja_brB.searchResultsPage.searchForUntilNumPagesFound("tag:letter=BB", 3);
  });
  it(`... finds page BB22, BB33, BB44`, async () => {
    await maja_brB.searchResultsPage.assertResultLinksAre([
          '/page-bb22#post-1',
          '/page-bb33#post-1',
          '/page-bb44#post-1',
          ], { anyOrder: true });
  });

  it(`Maja searches for Letter = SS, finds nothing — she's not staff`, async () => {
    await maja_brB.searchResultsPage.searchForWaitForResults("tag:letter=SS");
    await maja_brB.searchResultsPage.assertResultLinksAre([]);
  });

  it(`Owen, though, searches for SS`, async () => {
    await owen_brA.searchResultsPage.searchForUntilNumPagesFound("tag:letter=SS", 1);
  });
  it(`... and finds the staff-only page`, async () => {
    await owen_brA.searchResultsPage.assertResultLinksAre([
          '/page-ss66#post-1',
          ]);
  });

  it(`Range searches work with letters:  >=BB`, async () => {
    await owen_brA.searchResultsPage.searchForUntilNumPagesFound("tag:letter>=BB", 7);
  });
  it(`Owen finds all pages except for AA11`, async () => {
    await owen_brA.searchResultsPage.assertResultLinksAre([
        //'/page-aa11#post-1',
          '/page-bb22#post-1',
          '/page-bb33#post-1',
          '/page-bb44#post-1',
          '/page-ss66#post-1',
          '/page-tt77#post-1',
          '/page-tt88#post-1',
          '/page-tt99#post-1',
          ], { anyOrder: true });
  });

  it(`... but Maja`, async () => {
    await maja_brB.searchResultsPage.searchForUntilNumPagesFound("tag:letter>=BB", 3);
  });
  it(`... finds only BB22, BB33, BB44`, async () => {
    await maja_brB.searchResultsPage.assertResultLinksAre([
          '/page-bb22#post-1',
          '/page-bb33#post-1',
          '/page-bb44#post-1',
          ], { anyOrder: true });
  });



  // ----- Sort order: 'tags:...:asc/desc'


  it(`Owen searches for  tags:letter:asc,nr:desc`, async () => {
    await owen_brA.searchResultsPage.searchForUntilNumPagesFound(
            "tags:letter:asc,nr:desc", MaxPagesHit_Owen);
  });
  it(`... finds page AA11, BB44, BB33, BB22 ...`, async () => {
    await owen_brA.searchResultsPage.assertResultLinksAre([
          '/page-aa11#post-1',
          '/page-bb44#post-1',
          '/page-bb33#post-1',
          '/page-bb22#post-1',
          '/page-ss66#post-1',
          '/page-tt99#post-1',
          '/page-tt88#post-1',
          '/page-tt77#post-1',
          ]);
  });

  it(`Owen searches for  tags:letter:asc,nr:asc`, async () => {
    await owen_brA.searchResultsPage.searchForUntilNumPagesFound(
            "tags:letter:asc,nr:asc", MaxPagesHit_Owen);
  });
  it(`... finds page AA11, BB22, BB33, BB44 ...`, async () => {
    await owen_brA.searchResultsPage.assertResultLinksAre([
          '/page-aa11#post-1',
          '/page-bb22#post-1',
          '/page-bb33#post-1',
          '/page-bb44#post-1',
          '/page-ss66#post-1',
          '/page-tt77#post-1',
          '/page-tt88#post-1',
          '/page-tt99#post-1',
          ]);
  });



  // ----- Sort order:  Separate  'sort:...'

  const qSortOrd = `tag:letter sort-by:tag-value:kittens:asc,tag-value:nr:desc`;

  it(`Owen searches:  ${qSortOrd}`, async () => {
    await owen_brA.searchResultsPage.searchForUntilNumPagesFound(qSortOrd, MaxPagesHit_Owen);
  });
  it(`... finds page SS66, AA11, BB22, ...`, async () => {
    await owen_brA.searchResultsPage.assertResultLinksAre([
          '/page-ss66#post-1',  // kittens -1.66
          '/page-aa11#post-1',  // kittens  0.0
          '/page-bb22#post-1',  // kittens  1.22
          '/page-tt99#post-1',  // kittens  1.33
          '/page-tt88#post-1',  // kittens  1.33
          '/page-tt77#post-1',  // kittens  1.33
          '/page-bb33#post-1',  // kittens  1.33
          '/page-bb44#post-1',  // kittens  1.44
          ]);
  });



  // ----- Sort order:  Combine  'tags:...:desc'  and  'sort:...'


  const qSortOrd02 = `tag:nr:asc sort-by:tag-value:kittens:desc`;

  it(`Owen searches:  ${qSortOrd02}  — 'sort-by:...' has precedence over tags:...asc/desc`,
          async () => {
    await owen_brA.searchResultsPage.searchForUntilNumPagesFound(qSortOrd02, MaxPagesHit_Owen);
  });
  it(`... finds page BB44, BB33, TT77, TT88...`, async () => {
    await owen_brA.searchResultsPage.assertResultLinksAre([
          '/page-bb44#post-1',  // kittens  1.44
          '/page-bb33#post-1',  // kittens  1.33
          '/page-tt77#post-1',  // kittens  1.33
          '/page-tt88#post-1',  // kittens  1.33
          '/page-tt99#post-1',  // kittens  1.33
          '/page-bb22#post-1',  // kittens  1.22
          '/page-aa11#post-1',  // kittens  0.0
          '/page-ss66#post-1',  // kittens -1.66
          ]);
  });


  // ----- Combine filter & sort


  const qSortOrd03 = `tag:letter,nr:asc<89,kittens>-0.5 sort-by:tag-value:kittens:desc`;

  it(`Owen searches:  ${qSortOrd03}`, async () => {
    await owen_brA.searchResultsPage.searchForUntilNumPagesFound(qSortOrd03, 6);
  });
  it(`... finds page BB44, BB33, TT77, but not TT88, ...`, async () => {
    await owen_brA.searchResultsPage.assertResultLinksAre([
          '/page-bb44#post-1',  // kittens  1.44
          '/page-bb33#post-1',  // kittens  1.33
          '/page-tt77#post-1',  // kittens  1.33
          '/page-tt88#post-1',  // kittens  1.33
        //'/page-tt99#post-1',  // kittens  1.33  'nr' isn't <89
          '/page-bb22#post-1',  // kittens  1.22
          '/page-aa11#post-1',  // kittens  0.0
        //'/page-ss66#post-1',  // kittens -1.66  'kittens' isn't >-0.5
          ]);
  });



  // ----- Access control: Strangers and Trusted members


  it(`Maja leaves, a stranger appears`, async () => {
    await maja_brB.topbar.clickLogout();
  });
  it(`The stranger searches for:  tags:nr:desc`, async () => {
    await stranger_brB.searchResultsPage.searchForUntilNumPagesFound('tags:nr:desc', 4);
  });
  it(`... finds the AA and BB pages`, async () => {
    // TESTS_MISSING It'd be nice if cat_B_members_only. (Then would find only AA11 here.)
    await stranger_brB.searchResultsPage.assertResultLinksAre([
          '/page-bb44#post-1',
          '/page-bb33#post-1',
          '/page-bb22#post-1',
          '/page-aa11#post-1',
          ]);
  });


  it(`Trillian arrives`, async () => {
    await trillian_brB.complex.loginWithPasswordViaTopbar(trillian);
  });
  it(`... searches for:  tags:nr:desc`, async () => {
    await trillian_brB.searchResultsPage.searchForUntilNumPagesFound('tags:nr:desc',
            MaxPagesHit_Trillian);
  });
  it(`... she finds the TT pages too, but not the staff page`, async () => {
    await trillian_brB.searchResultsPage.assertResultLinksAre([
          '/page-tt99#post-1',
          '/page-tt88#post-1',
          '/page-tt77#post-1',
          '/page-bb44#post-1',
          '/page-bb33#post-1',
          '/page-bb22#post-1',
          '/page-aa11#post-1',
          ]);
  });


  // ----- Combined with free text

  const pangolinsQ = "Pangolins sort:tagval:kittens:desc,tagval:nr";

  it(`Trillian searches for:  "${pangolinsQ}"`, async () => {
    await trillian_brB.searchResultsPage.searchForUntilNumPagesFound(pangolinsQ,
            MaxPagesHit_Trillian - 2);
  });
  it(`... she finds only pangolin pages, except for the staff page`, async () => {
    await trillian_brB.searchResultsPage.assertResultLinksAre([
          '/page-bb44#post-1',  // kittens  1.44
          '/page-bb33#post-1',  // kittens  1.33
          '/page-tt77#post-1',  // kittens  1.33
        //'/page-tt88#post-1',  // kittens  1.33 — no pangolins here
          '/page-tt99#post-1',  // kittens  1.33
          '/page-bb22#post-1',  // kittens  1.22
        //'/page-aa11#post-1',  // kittens  0.0  — where are the pangolins? Not here
          ]);
  });


  it(`Owen also searches for:  "${pangolinsQ}"  but with:  kittens<1.4`, async () => {
    await owen_brA.searchResultsPage.searchForUntilNumPagesFound(pangolinsQ + ' tag:kittens<1.4',
            MaxPagesHit_Owen - 3);
  });
  it(`... finds also the staff page`, async () => {
    await owen_brA.searchResultsPage.assertResultLinksAre([
        //'/page-bb44#post-1',  // kittens  1.44
          '/page-bb33#post-1',  // kittens  1.33
          '/page-tt77#post-1',  // kittens  1.33
        //'/page-tt88#post-1',  // kittens  1.33 — no pangolins
          '/page-tt99#post-1',  // kittens  1.33
          '/page-bb22#post-1',  // kittens  1.22
        //'/page-aa11#post-1',  // kittens  0.0  — totally zero pangolins
          '/page-ss66#post-1',  // kittens -1.66
          ]);
  });

});

