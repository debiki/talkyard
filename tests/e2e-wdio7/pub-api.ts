
// Public API Typescript types. [PUB_API]  [todoc_api]
//
// These shouldn't be used by the Talkyard client itself — because if
// the Ty client were to use the public stable API, there'd be a
// slightly higher risk that the Ty developers accidentally changed
// the public API just because the Talkyard client needed some
// API changes?  Instead, the Ty client uses an internal API that
// it's fine to change in any way at any time.
//
// ... So this file is placed in <root>/tests/... where the Talkyard
// client (located in <root>/client/) cannot access it.


// Dependent types, nice, see:
// https://www.javiercasas.com/articles/typescript-dependent-types
// section "A first touch of Dependent Types in Typescript".
// — Ty uses this to create an easy to remember, and type safe API,
// even works with VSCode's autocomplete.
//
// For example listQuery:s for different things: pages, posts, participants,
// have the same fields: { listWhat: ..., lookWhere: ..., ..., inclFields: ... }
// and thanks to the 'listWhat' type discriminator field,
// the other fields can be type safe, so if you specify e.g. a *page* field
// in inclFields, when asking for a *participant* — there'd be a compile time error.
//
// This is called Discriminated Unions or Tagged Unions:
// Only one type, of some specific types, can be in use at any one time,
// and a tag field (getWhat, listWhat, findWhat) decides which one is in use.
// https://en.wikipedia.org/wiki/Tagged_union


/// <reference path="./../../client/types-and-const-enums.ts" />

// Old, deprecated?
interface ListUsersApiResponse {
  // RENAME to thingsFound?
  users: UserFound[];
}


// Misc types
// -------------------------

interface MaybePrettyApiRequest {
  pretty?: Bo;
}


type ApiResponse<R> = ApiErrorResponse | R;

interface ApiErrorResponse {
  error: ResponseError;
}

interface ResponseError extends ErrCodeMsg {
  httpStatusCode?: Nr;
}

interface ErrCodeMsg {
  errCode?: St;
  errMsg?: St;
}


type ParticipantId = string;

type MemberRef = string;
type GuestRef = string;
type PatRef = MemberRef | GuestRef;
type PageRef = string;
type TagRef = string;
type BadgeRef = string;

type PageSortOrder = 'PopularFirst' | 'ActiveFirst' | 'NewestFirst';
type PageTypeSt = 'Question' | 'Problem' | 'Idea' | 'Discussion';

type Unimplemented = undefined;


/*
// When finding, say, pages, the page authors are not included in the
// thingsFound[] list. Instead, the authors are  included in a
// ReferencedThings object — then, each author needs to be included
// only once, even though they might have written many of the pages found.
//
interface ReferencedThings {
  participantsById: { [id: string]: Participant_ };
}

function testA() { return (null as Participant_).class === '' + Date.now(); }
function testB() { return (null as Participant_).interface === '' + Date.now(); }
function testC() { return (null as Participant_).type === '' + Date.now(); }

interface Participant_ {
  interface: '123test is interface always a keyword?';
  type: 'im a type';
  class: 'hmm?';
  id: UserId;
  fullName?: string;
  username?: string;
  avatarUrl?: string;
  isGroup?: boolean;
  isGuest?: boolean;
} */


// What you're looking for
// -------------------------

// The different things Search Queries and List Queries can find:

type FindWhat =
  'Pages' |

  'Posts' |

  // Users and groups (not guests).  (Shorthand for 'Pats' + is-member-not-guest filter?)
  'Members' |

  // Users, groups, guests.
  'Pats' |

  // Maybe you don't remember if you invited someone, and want to find
  // any invite with the relevant email address.
  'Invites' |

  // Maybe you wonder if a reply notification email got sent or not — maybe your
  // mail server was offline for a while.
  'EmailsSent' |

  // If you have many tags, and want to find a tag via its About text or title.
  'Tags' |

  // If you have many categories so you need to search & find.
  'Categories' |

  // If you want to find a user badge, by searching badge titles or about texts.
  'Badges';



// Where to search
// -------------------------

// In which text fields or content sections to look, when searching for things,
// or listing things.
//
interface LookWhere {
  // E.g for autocompleting a username, when @mentioning someone.
  usernames?: boolean;

  // Users, groups and guests can have full names.
  fullNames?: boolean;

  emailAddresses?: boolean;

  // Find members in these groups.
  // E.g.  { inGroups: ['username:some_group', 'patid:223344'] }   or 'groupid:...'  ?
  inGroups?: MemberRef[];

  // Find members with these badges.
  withBadges?: BadgeRef[];

  // About a user / group,  or category, or tag, or user badge.
  aboutText?: boolean;

  // Search page titles, or tag titles, or user badge titles, or email subject lines.
  titleText?: boolean;

  // Searches the page body (original post) only, not the title, not any replies.
  // Or an email body (not subject line).
  bodyText?: boolean;

  // Searches replies, but not page title or body (original post).
  repliesText?: boolean;

  // Searches everything: Page tite, body, and replies.
  pageText?: boolean;

  // If you want to search only, say, pages of type Article and Question.
  pageTypes?: PageType[];

  // List posts or participants in these pages.
  // E.g.  { inPages: 'pageid:112233' }  ?
  inPages?: PageRef[];

  // Find pages in these categories.
  // E.g.  { inCategories: 'catid:112233' }  ?
  inCategories?: CategoryRef[];

  // Pages with these tags.
  withTags?: TagRef[];

  // Posts written by these users or groups.
  writtenBy?: MemberRef[];
};


// What you get back
// -------------------------

type ThingFound = PageOptFields
                | PageFound
                | PageListed  // hmm, incl in  PageOptFields  above
                | PostListed
                | ParticipantFound | TagFound | CategoryFound;



interface ParticipantFound {
  ppId: ParticipantId;  // RENAME to patId
  username?: string;
  fullName?: string;
  tinyAvatarUrl?: string;
  isGroup?: boolean;
  isGuest?: boolean;
}

interface GuestFound extends ParticipantFound {
  username?: undefined; // guests don't have real accounts
  fullName: string;  // they always have a name or alias though
  isGroup?: false;
  isGuest: true;
}

interface MemberFound extends ParticipantFound {
  username: string;  // members always have usernames
  isGuest?: false;
}

interface UserFound extends MemberFound {
  isGroup?: false;
  // soId?: St;   later (sign-on id)
  // extId?: St;  later (external id)
}

interface GroupFound extends MemberFound {
  isGroup: true;
}


interface PageOptFields {
  pageId?: PageId;
  title?: St;
  // Prefix with the origin (included in the response) to get the full URL.
  urlPath?: St;
  excerpt?: St;
  author?: ParticipantFound;
  categoriesMainFirst?: CategoryFound[];
  numOpLikeVotes?: Nr;
  numTotRepliesVisible?: Nr;
}


// Rename to PageDef(ault)Fields ?
interface PageFoundOrListed extends PageOptFields {
  pageId: PageId;
  title: string;
  // Prefix with the origin (included in the response) to get the full URL.
  urlPath: string;
  excerpt?: string;
  author?: ParticipantFound;
  categoriesMainFirst?: CategoryFound[];
}

interface PageFound extends PageFoundOrListed {
  postsFound: PostFound[];
}

type PageListed = PageFoundOrListed;



interface PostFoundOrListed {
  isPageTitle?: boolean;
  isPageBody?: boolean;
  author?: ParticipantFound;
}

interface PostFound extends PostFoundOrListed {
  // With <mark> tags and html escapes, like:
  //   ["When you want to <mark>climb</mark> a tall
  //    &amp; exciting <mark>tree</tree> then",
  //   ... ].
  htmlWithMarks: string[];
}

interface PostListed extends PostFoundOrListed {
  id: number;
  nr: number;
  parentNr?: number;
  pageId: PageId;
  pageTitle: string;
  urlPath: string;
  author: UserFound,
  approvedHtmlSanitized?: string;
}



type TagFound = Unimplemented;



interface CategoryFound {
  categoryId: CategoryId;
  name: string;
  urlPath: string;
};



// A  Get Query request
// -------------------------

// When you know precisely what you want, you can use a Get Query, to look up
// directly by id / url / username / something. For each lookup key you specify,
// you'll get back exactly one thing, or null.
//
// But if you don't know the exact ids / something, e.g. you have a username
// *prefix* only, then you can use a List Query instead, to list all participants
// with matching usernames — now, you might get back 0, 1 or many matching things.
//
// Tech details: Looks up by database primary key. So you know you'll get 1 or 0.
// That's why the getWhat and ids (e.g. `getPages: [page-id-one, two, three]`)
// are one single same key-value. — Compare with ListQuery, which has two separate
// fields: listWhat: ... and lookWhere: .... E.g. listWhat: 'Posts' and
// lookWhere: category-ids, to find recent posts in those categories.
//

interface GetQueryApiRequest extends MaybePrettyApiRequest {
  getQuery: GetPagesQuery | GetPatsQuery;
  pretty?: Bo;
}


interface GetQuery {
  getWhat: FindWhat;
  getRefs: Ref[];
  inclFields: Object;
}


interface GetPagesQuery extends GetQuery {
  getWhat: 'Pages',
  getRefs: PageRef[];
  inclFields: {
    // Only the orig post:
    //numOpRepliesVisible?: Bo;
    numOpLikeVotes?: Bo;

    // Whole page:
    numTotRepliesVisible?: Bo;
    //numTotLikeVotesVisible?: Bo;
  };
}


interface GetPatsQuery extends GetQuery {   // not impl
  getWhat: 'Pats',
  getRefs: PatRef[];
  inclFields: {
    fullName?: Bo;
    username?: Bo;
    isGuest?: Bo;
  };
}




type GetQueryApiResponse<T extends ThingFound> = ApiResponse<GetQueryResults<T>>;

interface GetQueryResults<T extends ThingFound> {
  origin: St;

  // One item for each getRefs[] item, in the same order.
  thingsOrErrs: (T | ErrCodeMsg | null)[];
}

// Examples:
//
// Get blog post comment counts:
//
//  /-/v0/get {
//    getQuery: {
//      getWhat: 'Pages',
//      getRefs: [
//        'emburl:https://blog/a-blog-post',
//        'emburl:https://blog/another',
//        'emburl:https://blog/a-third',
//      ],
//      inclFields: {
//        numOpLikeVotes: true,
//        numTotRepliesVisible: true,
//
//        // // Maybe later: Nested fields:
//        // author: {
//        //   fullName: true,
//        //   username: true,
//        //   smallAvatarUrl: true,
//        // }
//        // // Or sth like:
//        // whichPosts: { opAndNumTopReplies: 10 }
//        // inclPostAuthors: true,
//        // whichAuthorFields: { fullName: true, username: true }
//      },
//    }
//  }
//
// Sample response, assuming /a-blog-post  couldn't be found:
//
//   {
//     origin: "https://example.com",
//     thingsOrErrs: [
//       { error: { errCode: 'TyEPGNF', errMsg: ...,  } },
//       { numOpLikeVotes: 11, numTotRepliesVisible: 22 },
//       { numOpLikeVotes: 33, numTotRepliesVisible: 44 },
//     ],
//   }
//
// Or total request failure, no results back:
//
// {
//   error: {
//     httpStatusCode: NNN,
//     errCode: "TyEMMMMMM",
//     errMsg: "...",
//   }
// }
//



// A  List Query request
// -------------------------


// List Queries are comparatively fast — they lookup things directly, via indexes in
// the PostgreSQL database.  However they cannot do full text search — for that,
// you need a Search Query.
//
// Tech details: Looks up by database index, often not the primary key.
// The index might be on table B, although you're finding things in table A.
// E.g. you might list the most recent topics in a category.
//
interface ListQueryApiRequest {
  // Either:
  listQuery?: ListQuery;

  // Or:
  continueAtScrollCursor?: ListResultsScrollCursor;

  limit?: Nr;
  pretty?: Bo;
}

interface ListQuery {
  // Query type discriminator.
  // To find different types of things, e.g. a participant or tag or category
  // — something, but you don't remember precisely what —
  // then use a BatchQuery composed of many ListQuery:s ?
  listWhat: FindWhat;

  // E.g. username prefix.
  exactPrefix?: St;
  lookWhere?: LookWhere;
  filter?: QueryFilter;
  sortOrder?;
  limit?: Nr;
}


type QueryFilter = PageFilter;  // for now


interface ListPagesQuery extends ListQuery {
  listWhat: 'Pages';
  lookWhere?: { inCategories: CategoryRef[] };
  filter?: PageFilter;
  sortOrder?: PageSortOrder;
}


interface PageFilter {
  isDeleted?: Bo;  // default: false
  isOpen?: Bo;
  isAuthorWaiting?: Bo;
  pageType?: { _in: PageTypeSt[] };
}

// interface PatFilter {
//   isStaff?: Bo;
//   isMember?: Bo;
//   memberSinceMins?: { _ge: 60*24*31*3 }    // at least 3 months
//   trustLevel: { _ge?: Nr, _le?: Nr, ... }  // at least, at most
//   trustLevel: 4;   // exact
// }


type ListQueryApiResponse<T extends ThingFound> = ApiResponse<ListQueryResults<T>>;

interface ListQueryResults<T extends ThingFound> {
  origin: string;
  thingsFound?: T[];
  scrollCursor?: ListResultsScrollCursor;
}

type ListResultsScrollCursor = Unimplemented;


// Examples:
//
// Auto-complete username "jane_doe" when typing a username prefix:
//
//  /-/v0/list  {
//    listQuery: {
//      exactPrefix: 'jane_d',
//      listWhat: 'Members',
//      lookWhere: { usernames: true },
//
//      // Later:
//      // inclFields: { fullName: true, username: true }
//    }
//  }
//
//
//  /-/v0/list  {
//    listQuery: {
//      listWhat: 'Pats'
//      exactPrefix: 'jane_d',   // can use db index
//      lookWhere: { usernames: true },
//      inclFields: {
//        fullName: true,
//        username: true,
//      }
//      filter: {   // Filters<PatFilters>, [api_json_query]
//        isStaff: false,
//        something: { _isDef: true },         // field is defined (not absent or null)
//        sthelse:   { _isDef: false },        // field is absent or null
//        sthelse2:  { _ge: 100, _le: 200 } ,  // between 100 and 200 (inclusive)
//        sthelse3:  { _in: [1, 3, 5] },       // value is one of 1, 3 or 5.
//        livedIn:   { _contains: ['Alaska', 'Australia'] },
//
//        username:  { _regex: /.*kitten.*/ }, // cannot use db index, since starts
//                                             // with: '.*'; needs to be a filter
//        _not: {
//          username:  { _regex: /.*cruel.*/ },
//          eats: 'birds'
//        },
//
//        // Fuzzy match, per language values, here English and Swedish:
//        fullName:  { _fuzzyMatch: 'kitty', _langs: ['en', 'sv'] },
//
//
//        sth:  { _count: 8 },                 // exactly 8 something
//        sth:  { _count: { _ge: 10, _lt: 20 } // 10 - 19 something
//
//        _or: [
//          { memberSinceMins: { _ge: 60*24*7 } },  // at least one week
//          { trustLevel: { _ge: 3 } }]             // at least full member
//      }
//    }
//  }
//
// type OptOrFilter<T> = { _or?: OptOrFilter<T>[] };
// type Filter<T> = T | { _or: Filters<T>[] }
//
//
//
// List popular pages in a category:
//
//  /-/v0/list  {
//    listQuery: {
//      listWhat: 'Pages',
//      lookWhere: { inCategories: [categoryA, catB, catC] },
//      filter: {
//        isOpen: true,
//        pageType: { _in: ['Question', 'Problem'] },
//        // or, later, excl types?:
//        pageType: { _notIn: ['Question', 'Problem'] },
//
//        // No: onlyWaiting: true  — because, waiting for *what*?
//        // maybe for the OP author to reply with more info?
//        // then not interesting to see it in the Waiting list?
//        pageStatus: ['!Closed', '!Postponed'],
//
//        pageStatus: [{
//          // Probably won't do like this:
//          waitingForReplyBy: ...
//          waiting: { forReply: { notBy: 'Author' }}}
//          waiting: { forReplyBy: '!OP-Author' },
//          waiting: { forTopicDone: { 'pageid:1234' }}
//          waiting: { forTag: 'tagid:...' }
//
//          waiting: true,
//          not: { waiting: { forReplyBy: 'username:someone' }},
//          }]
//      },
//      asWho: ['username:all_members'],
//      // Later, like getQuery?:
//      //inclFields: {
//      //  numRepliesVisible: true,
//      //},
//      sortOrder: 'PopularFirst',
//      limit: 5,
//    }
//  }
//
// Response ex:
//
//   { origin: "https://example.com", thingsFound: [...]  }
//



// A  Search Query request
// -------------------------

// Finds things via the full text search / faceted serarch database —
// that is, ElasticSearch (currently), not PostgreSQL.
//

interface SearchQueryApiRequest {
  // Either:
  searchQuery?: SearchQuery2;

  // Or:
  continueAtScrollCursor?: SearchResultsScrollCursor;

  limit?: number;
  pretty?: boolean;
}

type SearchQuery2 = SinglSearchQuery | CompoundSearchQuery;

// Not implemented.
type CompoundSearchQuery =
  // All must match.
  SinglSearchQuery[];

interface SinglSearchQuery {
  // "Freetext" refers to free-form text, meaning, unstructured text:
  // The user can type anything. And the server interprets the meaning as best
  // it can, maybe interprets "buy ice skating shoes" as "buy ice skates".
  freetext?: string;

  findWhat?: FindWhat,
  lookWhere?: LookWhere;
};

type SearchQueryApiResponse<T extends ThingFound> = ApiResponse<SearchQueryResults<T>>;

interface SearchQueryResults<T extends ThingFound> {
  origin: string;
  thingsFound?: T[];
  scrollCursor?: SearchResultsScrollCursor;
}

type SearchResultsScrollCursor = Unimplemented;


// Examples:
//
//  /-/v0/search  {
//    searchQuery: { freetext: "how climb a tree" }
//  }
//
// The above is the same as:
//
//  /-/v0/search  {
//    searchQuery: {
//      freetext: 'how climb a tree',
//      findWhat: 'Pages',             // the default
//      lookWhere: { pageText: true }. // the default, when finding pages
//    }
//  }
//
// Response ex:
//
//   { origin: "https://example.com", thingsFound: [...]  }
//
//
// Find a user: (participant)
//
//  /-/v0/search  {
//    searchQuery: {
//      freetext: 'jane',
//      findWhat: 'Pats',
//      lookWhere: { usernames: true, fullNames: true }
//    }
//  }
//
// This compound query finds posts about how to climb a tree, written by someone
// with "Doe" in their name:
//
// No!:
//  /-/v0/search  {
//    searchQuery: [{
//      freetext: 'doe',
//      findWhat: 'Members',
//    }, {
//      freetext: 'trees',
//      findWhat: 'Pages',
//    }]
//  }
//
// Instead?  No, neither this:
//  /-/v0/search  {
//    searchQuery: {
//      findWhat: 'Posts',
//      matchAll: [{
//        freetext: 'doe',
//        lookWhere:  pat names
//      }, {
//        freetext: 'trees',
//        lookWhere:  post texts
//      }]
//    }
//  }
//
// The above is useful, if you remember that, say, someone with a name like "Doe"
// wrote something about trees. You might then find out that Jane Doe wrote an article
// about how to climb trees. The search result would include a UserFound
// and a PageFound, in the ThingsFound[] list — in the order the search engine
// thinks is the best.
//
// ( ElasticSearch compound queries docs:
//  https://www.elastic.co/guide/en/elasticsearch/reference/current/compound-queries.html
//  — the example above, Jane Doe and trees, is a query of type: bool must match.
//  Others, like Toshi + Tantivy — yes, supports compound queries:
//   https://github.com/toshi-search/Toshi#boolean-query
//  PostgreSQL built-in search: maybe by joining tables? But I think this
//  cannot work as well as ElasticSearch?
//  Meilisearch: https://www.meilisearch.com — no compound queries. )
//
// However if you already know who wrote something about trees, then, don't
// search for that person — instead use LookWhere.writtenBy:
//
//  /-/v0/search  {
//    searchQuery: {
//      freetext: 'climb trees',
//      lookWhere: { pageText: true, writtenBy: 'username:jane_doe' },
//    }
//  }
//




// An  Upsert  request  ?
// -------------------------

//
//
/*
interface UpsertApiRequest extends MaybePrettyApiRequest {
  upsertCmd: UpsertCommand;
  pretty?: Bo;
}


interface UpsertCommand {
  upsertWhat: FindWhat;
}


interface UpsertPatsCommand extends UpsertCommand {
  upsertWhat: 'Pats';
  upsertThings: PatToUpsert[];
}


interface PatToUpsert {
  key: St;
  username?: St;
  fullName?: St;
  primaryEmailAddr?: St;
  primaryEmailAddrVerified?: Bo;
}


type UpsertApiResponse<T extends ThingFound> = ApiResponse<GetQueryResults<T>>;

interface UpsertCommandResults<T extends ThingFound> {
  origin: St;

  // One item for each upsertThings[] item, in the same order.
  thingsOrErrs: (T | ErrCodeMsg | null)[];
}
*/



// Batch search/list/get requests?
// -------------------------

// Should Not implement this, unless clearly needed.
// Still, good to think about in advance, so as not to paint oneself into a corner?
//
//   /-/v0/batch-query {
//     batchQuery: {
//       // Maybe sth like:
//       //perQueryLimit: NN,
//       //this: mergeResultsHow:  ... ?? ..,
//       //or?: perQuerySortOrder:
//       //     totalSortOrder:
//
//       queryList: [
//         getQuery: {
//           getWhat: 'Pages',
//           getRefs: [
//             'emburl:https://blog/a-blog-post':
//             'emburl:https://blog/another',
//             'emburl:https://blog/a-third',
//           ],
//           inclFields: {
//             numRepliesVisible: true,
//             numOrigPostLikeVotes: true,
//           },
//         },
//
//         getQuery: {
//           getWhat: 'Pages',
//           getRefs: [ ... ],
//           inclFields: {
//             someOtherField: true,
//           },
//         },
//
//         listQuery: {
//           listWhat: 'Members',
//           exactPrefix: 'jane_d',
//           lookWhere: { usernames: true },
//         },
//
//         listQuery: {
//           listWhat: 'Pages',
//           lookWhere: { inCategories: [catB, catC] },
//         },
//
//         searchQuery: {
//           findWhat: 'Posts',
//           freetext: "how to feed an anteater that has climbed a tall tree",
//         },
//       ],
//     },
//   }
//
// Response could be:
//
//   {
//     origin: "https://example.com",
//     batchQueryResults: [
//       { getResults: ... },
//       { getResults: ... },
//       { listResults: ... },
//       { listResults: ... },
//       { searchResults: ... },
//     ],
//   }
//


