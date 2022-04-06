
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

interface ApiRequest {
  pretty?: Bo;
}

// An API request can include one or many things for the server to do — many tasks.
// For example, a SearchQueryApiRequest includes just a single SearchQueryApiTask,
// whilst a ManyQueriesApiRequest can include many SearchQueryApiTask:s.
interface ApiTask {}

type ApiResponse<R> = ApiErrorResponse | R;

interface ApiErrorResponse {
  error: ResponseError;
}

interface ResponseError extends Partial<ErrCodeMsg> {
  httpStatusCode?: Nr;
}

interface ErrCodeMsg {
  errCode: St;
  errMsg: St;
}


interface ManyResults {
  results: (OkResult | ErrorResult | ManyResults)[];
}


interface OkResult {
  ok: true;
}

interface ErrorResult {
  error: ErrCodeMsg;
}


type ParticipantId = string;

type MemberRef = string;
type GuestRef = string;
type PatRef = MemberRef | GuestRef;
type PageRef = string;
type TagRef = string;
type BadgeRef = string;

type PageSortOrder = 'PopularFirst' | 'ActiveFirst' | 'NewestFirst';
type PageTypeSt = 'Question' | 'Problem' | 'Idea' | 'Discussion' | 'Other';
type PageDoingStatusSt = null | 'Planned' | 'Doing' | 'Done';
type PageClosedStatusSt = null | 'Closed' | 'Locked' | 'Frozen';
type PageDeletedStatusSt = null | 'Deleted' | 'HardDeleted';

type EventSortOrder = 'NewestFirst' | 'OldestFirst';

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
  // Info about  also be sent via webhoos (not yet impl)
  'Events' |

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


type WhatThing =
  'Event' |
  'Page'  |
  'Post'  |
  'Pat'; /*  // short for "Participant"
  'Invite' |
  'EmailOut' |
  'Tag' |
  'Category' |
  'Badge';  */


interface Thing {
  // Not needed, if only one thing type allowed, e.g. a webhook request would
  // only include Event:s — then, no need for `what: 'Event'`.
  what?: WhatThing;

  // Can be left out, if looking up one specific thing, by id. Then the caller
  // already knows its id (e.g. in client/embedded-comments/comments-count.ts).
  id?: St | Nr;
}



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
            //  | Event
                | TyPat | TagFound | CategoryFound;



// RENAME to Pat ?
interface TyPat extends Thing {
  what?: 'Pat';
  id: PatId;
  ssoId?: St;
  extId?: St;
  ppId: ParticipantId;  // deprecated
  username?: string;
  fullName?: string;
  tinyAvatarUrl?: string;
  isGroup?: boolean;
  isGuest?: boolean;
}

interface GuestFound extends TyPat {
  username?: undefined; // guests don't have real accounts
  fullName: string;  // they always have a name or alias though
  isGroup?: false;
  isGuest: true;
}

interface MemberFound extends TyPat {
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


interface PageOptFields extends Thing {
  what?: 'Page';
  id?: PageId;

  // Deprecated:
  pageId?: PageId;

  //pageType: PageTypeSt; ... etc, see EventPageData
  title?: St;
  // Prefix with the origin (included in the response) to get the full URL.
  urlPath?: St;
  excerpt?: St;
  author?: TyPat;
  categoriesMainFirst?: CategoryFound[];
  numOpLikeVotes?: Nr;
  numTotRepliesVisible?: Nr;
}


// Rename to PageDef(ault)Fields ?
interface PageFoundOrListed extends PageOptFields {
  id: PageId;

  // Deprecated:
  pageId: PageId;

  title: string;
  // Prefix with the origin (included in the response) to get the full URL.
  urlPath: string;
  excerpt?: string;
  author?: TyPat;
  categoriesMainFirst?: CategoryFound[];
}

interface PageFound extends PageFoundOrListed {
  postsFound: PostFound[];
}

type PageListed = PageFoundOrListed;



// RENAME to just Post?
interface PostFoundOrListed extends Thing {
  what?: 'Post';
  isPageTitle?: boolean;
  isPageBody?: boolean;
  author?: TyPat;
}

interface PostFound extends PostFoundOrListed {
  // With <mark> tags and html escapes, like:
  //   ["When you want to <mark>climb</mark> a tall
  //    &amp; exciting <mark>tree</tree> then",
  //   ... ].
  htmlWithMarks: string[];
}

// RENAME to PostAlone?  (not wrapped in page)
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

// Page id not needed, since is in a page {} obj.
interface PostWrappedInPage extends PostFoundOrListed {
  id: Nr;
  nr: Nr;
  parentNr?: Nr;
  author?: UserFound,
  approvedHtmlSanitized: St;
}



type TagFound = Unimplemented;



interface CategoryFound {
  categoryId: CategoryId;
  name: string;
  urlPath: string;
};

// User  ^^\__.--  Individual?
// Guest   |
// Anon  __/
//
// UserCreated
// UserUpdated
//
// GuestCreated
// GuestUpdated (was that possible?)
//
// AnonymCreated
// AnonymUpdated
//
// GroupCreated
// GroupUpdated
// GroupMembersChanged
//
// CircleCreated ?
// CircleUpdated ?
//
// PageCreated
// PageUpdated
//
// PostCreated
// PostUpdated
//
// CategoryCreated
// CategoryUpdated

// Site.UserJoined
// Group.Created | .Updated | .Deleted  | .MemberJoined | .MemberLeft
// User.JoinedGroup | .LeftGroup
// User.Deactivated | .Deleted
// Page.Created | .Answered | .Done | .Closed | .Deleted
// Post.Created | .Edited | .Changed | .Deleted

interface EventDefaultFields__no {
  id: Nr;
  eventType: St; // ['Page.Created', 'Post.Created'],
  //eventSubtypes: St[];
  eventData: {
    page?: {   // JsPageFound
      title: St;
      urlPath: St;
      categoriesMainFirst: CategoryFound[]
      author: UserFound; // JsParticipantFoundOrNull
      postsByNr: {
        '1': {
          approvedHtmlSanitized: St;
        }
      }
    };

    post?: {
      urlPath: St;
      author: UserFound;
      approvedHtmlSanitized: St;
    }
  }
}


type EventType =
    'PageCreated' | 
    'PageUpdated' | 
    'PostCreated' | 
    'PostUpdated' |
    'PatCreated'  |    // subtype: 'User/Group/Guest/AnonCreated' ?
    'PatUpdated';


interface Event_ extends Thing {
  what?: 'Event';
  id: Nr;
  when: WhenMs,
  eventType: EventType;
  //eventSubtypes: EventSubtype[];
  eventData: Object;
}

interface PageCreatedEvent extends Event_ {
  eventType: 'PageCreated';
  eventData: {
    page: EventPageData & { posts: PostWrappedInPage[] };
  }
}

interface PageUpdatedEvent extends Event_ {
  eventType: 'PageUpdated';
  eventData: {
    page: EventPageData;
  }
}

interface PostCreatedEvent extends Event_ {
  eventType: 'PostCreated';
  eventData: {
    post: PostListed;
  }
}

interface PostUpdatedEvent extends Event_ {
  eventType: 'PostUpdated';
  eventData: {
    post: PostListed;
  }
}

interface PatCreatedEvent extends Event_ {
  eventType: 'PatCreated';
  eventData: {
    pat: TyPat;
  }
}

interface PatUpdatedEvent extends Event_ {
  eventType: 'PatUpdated';
  eventData: {
    pat: TyPat;
  }
}


interface EventPageData {
  id: PageId;
  title: St;
  urlPath: St;
  pageType: PageTypeSt;
  answerPostId?: PostId;
  doingStatus?: PageDoingStatusSt;
  closedStatus?: PageClosedStatusSt;
  deletedStatus?: PageDeletedStatusSt;
  categoriesMainFirst: CategoryFound[];
}


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

interface GetQueryApiRequest extends ApiRequest, GetQueryApiTask {
}


interface GetQueryApiTask extends ApiTask {
  getQuery: GetPagesQuery | GetPatsQuery;
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
    tyId?: Bo;   // unimpl
    extId?: Bo;  // unimpl

    // Only the orig post:
    //numOpRepliesVisible?: Bo;
    numOpLikeVotes?: Bo;

    // Whole page:
    numTotRepliesVisible?: Bo;
    //numTotLikeVotesVisible?: Bo;

    title?: Bo;
    origPost?: Bo;  // unimpl

    /* Later — and this would be the same as some render page UX settings?  [get_what_fields]
    replies?: {  — maybe not
      numTop?: Nr;
      numFirst?: Nr;
      numLast?: Nr;
      numNested?: ... hmm ...,  how many 2nd level replies to incl, of each top level
         reply. And 3rd level etc. And how many to max incl, if "too many" replies
         in a sub tree.
    }
    Or maybe there could be different algorithms, for deciding what replies to
    include — and one would specify an algorithm, and parameters?
    So, maybe instead:

    replies: {
      asPerAlg: St;  // algorithm name and version, e.g. 'TopReplies/v0.1'
      algParams: Object;
    */
  };
}


interface GetPatsQuery extends GetQuery {   // not impl
  getWhat: 'Pats',
  getRefs: PatRef[];
  inclFields: {   // Later.  [get_what_fields]
    tyId?: Bo;
    extId?: Bo;
    ssoId?: Bo;

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
interface ListQueryApiRequest extends ApiRequest, ListQueryApiTask {
}

interface ListQueryApiTask extends ApiTask {
  listQuery: ListQuery;
  limit?: Nr;
}

interface ContinueListQueryApiRequest extends ApiRequest {
  continueAtScrollCursor?: ListResultsScrollCursor;
  limit?: Nr;
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


interface ListEventsQuery extends ListQuery {
  listWhat: 'Events';
  sortOrder?: EventSortOrder;
}


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
//   // or:  { origin: ..., pages: [...]  }
//
// List recent webhook events:
//  curl --user tyid=2:14xubgffn4w1b3iluvd2uyntzm -X POST -H 'Content-Type: application/json' http://e2e-test-cid-0-0-now-6795.localhost/-/v0/list -d '{ "listQuery": { "listWhat": "Events" }}'
//
//  /-/v0/list  {    // or just  /-/v0/events  ?
//    listQuery: {
//      listWhat: 'Events',
//      sortOrder: 'NewestFirst',
//    }
//  }
//
// Response ex:
//
// {
//   jsonVersion: 1,
//   origin: "https://talkyard.example.com",
//   thingsFound: [{   //  or  events: ...  and skip 'what: ...'?
//     what: 'Event',
//     id: 1234,  // event id
//     type: 'PageCreated',
//     subTypes: [],
//     data: {
//       page: {   // JsPageFound
//         id:
//         title:
//         urlPath:
//         categoriesMainFirst: 
//         author: {
//           JsParticipantFoundOrNull
//         },
//         postsByNr: {
//           '1': {
//             body: "Orig post text",
//             bodyFormat: "CommonMark",
//           }
//         }]
//       },
//     }
//   }, {
//     what: 'Event',
//     id: 567,
//     type: 'PagesMoved',    // cmp w the Do API: `doWhat: 'MovePages'`
//     data: {
//       whichPages: [...],
//       toCategory: [...],
//   }]
// }
//
// No!:
// {
//   origin: "https://example.com",
//   thingsFound: [{
//     eventId: __,
//     eventTypes: ['Page.Created', 'Post.Created'],
//     eventData: {
//       page: {   // JsPageFound
//         title:
//         urlPath:
//         categoriesMainFirst: 
//         author: {
//           JsParticipantFoundOrNull
//         }
//       },
//       posts: [{
//       }]
//     }
//   }]
// }
//



// A  Search Query request
// -------------------------

// Finds things via the full text search / faceted serarch database —
// that is, ElasticSearch (currently), not PostgreSQL.
//

interface SearchQueryApiRequest extends ApiRequest, SearchQueryApiTask {
}

interface SearchQueryApiTask extends ApiTask {
  searchQuery: SearchQuery_;
  limit?: number;
}

interface ContinueSearchQueryApiRequest extends ApiRequest {
  continueAtScrollCursor?: SearchResultsScrollCursor;
  limit?: Nr;
}


type SearchQuery_ = SinglSearchQuery | CompoundSearchQuery;

// Not implemented.
type CompoundSearchQuery =
  // 'And' match — all must match.
  // (For 'or' match, instead, send many SearchQueryRequest:s.)
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


// A Query API request
// -------------------------
//
//  POST /-/v0/query  {
//    manyQueries: [{
//      getQuery: {
//        getWhat: 'Pages',
//        getRefs: [
//          'emburl:https://blog/a-blog-post':
//          'emburl:https://blog/another',
//          'emburl:https://blog/a-third',
//        ],
//        inclFields: {
//          numRepliesVisible: true,
//          numOrigPostLikeVotes: true,
//        },
//      }
//    }, {
//      listQuery: {
//        listWhat: 'Members',
//        exactPrefix: 'jane_d',
//        lookWhere: { usernames: true },
//      }
//    }, {
//      listQuery: {
//        listWhat: 'Pages',
//        lookWhere: { inCategories: [catB, catC] },
//      }
//    }, {
//      searchQuery: {
//        ...
//      }
//    }, {
//      // Nested query list — to run in single transaction.
//      inSingleTransaction: true,
//      manyQueries: [...]
//    }, {
//      ...
//    }]
//  }

interface QueryApiRequest extends ApiRequest, ManyQueriesApiTask {
}

interface ManyQueriesApiTask extends ApiTask {
  inSingleTransaction?: Bo;
  manyQueries: (QueryApiTask | ManyQueriesApiTask)[];

  // Optional default for each QueryRequest.
  // sortOrder?
  // perQueryLimit?
  // totalLimit?
  // limit?: number; — for what?
}

type QueryApiTask = GetQueryApiTask | ListQueryApiTask | SearchQueryApiTask;




// A Do API request   [ACTNPATCH]   [use_the_Do_API]
// -------------------------

interface DoApiRequest extends ApiRequest, DoActionsApiTask {
}

interface DoActionsApiTask extends ApiTask {
  //inSingleTransaction: true;  // later: optional
  doActions: (Action | ActionGraph | DoActionsApiTask)[];

  // Maybe in the distant future: (could also be inside each Action)
  // doWhen: 'now' | 'YYYY-MM-DDTHH:MI:SSZ'
  // doIf: hmm
}

type DoActionsApiResponse = ApiResponse<ManyResults>;

type ActionGraph = Unimplemented;

interface Action {
  asWho: St; // 'sysbot' | 'tyid:_' | 'extid:_' | 'ssoid:_' | 'username:_';
  doWhat: ActionType,
  //doWhen?: 'YYYY-MM-DDTHH:MI:SSZ';
  //doIf?;
  doWhy?: St; // optional description for the audit log
  doHow: Object;  // per action type parameters
}

type ActionType =
  'CreateReplyPost' |
  'CreateMetaPost' |
  'SetVote' |
  'SetNotfLevel';
  // Distant future:
  // 'CreateWorkfow' with  doHow: { workflowSteps: ActionGraph }  // directed, asyclic?
  //   returns a workflow id
  // 'DeleteWorkfow'
  // 'RunWorkfowNow'
  // 'CreateWorkfowTrigger' with doHow: { runWorkflow: _ runIf: __ runWhen: __ }
  // 'DeleteWorkfowTrigger'
  // A workflow step could be a RunScriptAction for example.


interface SetVoteAction extends Action {
  doWhat: 'SetVote';
  doHow: {
    whatVote: 'Like';
    whatPost: { pageId: St, postNr: 1 };  // { postId: _ } | { pageId: _, postNr: _ },
    howMany: 0 | 1;
  }
}

interface SetNotfLevelAction extends Action {
  doWhat: 'SetNotfLevel';
  doHow: {
    toLevel: Nr;
    whatPages: ({ pageId: St } | { inCategoryId: CatId })[];
  }
}

interface CreateReplyPostAction extends Action {
  doWhat: 'CreateReplyPost';
  doHow: {
    replyTo: { pageId: PageId, postNr?: PostNr } | { postId: PostId };
    body: St;
    bodyFormat: 'CommonMark';
  }
}

interface CreateMetaPostAction extends Action {
  doWhat: 'CreateMetaPost';
  doHow: {
    appendTo: { pageId: PageId };
    body: St;
    bodyFormat: 'CommonMark';
  }
}



// Example Do API request:
//
//  /-/v0/do  {
//    doActions: [{
//      asWho: 'sysbot' | 'tyid:_' | 'extid:_' | 'ssoid:_' | 'username:_',
//      doWhat: 'SetVote'
//      doHow: {
//        whatVote: 'Like',
//        whatPost: { postId: _ } | { pageId: _, postNr: 1 },
//        howMany: 1 | 0,
//        // Future compat w assigning many Do-It votes
//        // per person to a single feature request.
//      },
//    }, {
//      asWho: _
//      doWhat: 'SetNotfLevel',
//      doHow: {
//        whatLevel: 'EveryPost',
//        whatPage: { pageId: _ },
//      }
//    }, {
//      asWho: 'ssoid:some-user-id',
//      doWhat: 'CreateMetaPost',
//      doHow: {
//        body: _,
//        bodyFormat: 'CommonMark',
//        appendTo: { pageId: _ },
//      }
//    }, {
//      asWho: 'ssoid:some-user-id',
//      doWhat: 'CreateReplyPost',
//      doHow: {
//        body: _,
//        bodyFormat: 'CommonMark',
//        replyTo: { pageId: _, postNr: _ },
//      }
//    }, {
//      asWho: _
//      doWhat: 'CreatePage',
//      doHow: {
//        pageTitle: _,
//        pageBody: _,
//        inCategory: CatRef,
//        withTags: TagRef[];
//      }
//    }, {
//      asWho: 'sysbot',
//      doWhat: 'CreateUser',
//      doHow: {
//        username: _,
//        fullName: _,
//        primaryEmailAddr?: St;
//        primaryEmailAddrVerified?: Bo;
//        addToGroups: _  // or  doWhat: 'AddUserToGroup'  below, instead?
//      }
//    }, {
//      asWho: 'sysbot',
//      doWhat: 'AddUserToGroup',
//      doHow: {
//        whichUser: _,  // reference user above
//        whichGroup: _,
//      }
//    }, {
//      asWho: 'sysbot',
//      doWhat: 'MovePages',
//      doHow: {
//        whichPages: _,
//        toCategory: _,
//    }, {
//      // Nested — e.g. to run in single transaction. Not implemented (maybe never).
//      inSingleTransaction: true;
//      doActions: [{ ... }, { ... }, { ... }],
//    }],
//  }
//
//
// Response is ManyResults:
//
//  {
//    results: [{
//      ok: true,   // if 'SetVote' went fine
//    }, {
//      ok: true,   // if 'SetNotfLevel' went fine
//    }, {
//      error: {    // if 'CreateMetaPost' failed
//        errCode: _,
//        errMsg: _,
//      }
//    }, {
//    ...
//    }, {
//      ok: true,   // user created
//    }, {
//      ok: true,   // user added to group
//    }, {
//      results: [{ ... }, { ... }, { ... }]  // nested doActions results
//    }],
//  }
//
//
//  Distant future, custom scripts:
//
//  /-/v0/do  {
//    doActions: [{
//      asWho: 'sysbot' | 'tyid:_' | 'extid:_' | 'ssoid:_' | 'username:_',
//      doWhat: 'custom-action:unique-name',  // hmm
//      doHow: {
//        whatVote: 'Like',
//        whatPost: { postId: _ } | { pageId: _, postNr: 1 },
//        howMany: 1 | 0,
//        // Future compat w assigning many Do-It votes
//        // per person to a single feature request.
//      },
//    }, {



// A Query-Do API request
// -------------------------

// Maybe later.

interface QueryDoApiRequest extends ApiRequest, QueryDoApiTask {
}

interface QueryDoApiTask extends ApiTask {
  inSingleTransaction?: true;  // default: false
  queriesAndActions: (QueryApiTask | ManyQueriesApiTask | Action | DoActionsApiTask)[];
}

type RunQueriesDoActionsResults = ApiResponse<ManyResults>;


//  Example Query-Do API request:
//
//  POST /-/v0/query-do  {
//    queriesAndActions: [{
//      getQuery: {
//        getWhat: 'Pages',
//        getRefs: ['tyid:1234'],
//        inclFields: { ... },
//      }
//    }, {
//      listQuery: {
//        ...
//      }
//    }, {
//      searchQuery: {
//        findWhat: 'Posts',
//        freetext: "how to feed an anteater that has climbed a tall tree",
//      }
//    }, {
//      // Nested, to run in single transaction.
//      inSingleTransaction: true;
//      doActions: [{
//        ...
//      }]
//    }, {
//      inSingleTransaction: true,
//      manyQueries: [{
//        ...
//      }]
//    }, {
//      ...
//    }]
//  }
//
// Response would be ManyResults?
//
//   {
//     origin: "https://example.com",
//     results: [
//       { thingsOrErrs: [...] },  // getQuery results
//       { thingsFound: [...] },   // listQuery results
//       { thingsFound: [...] },   // searchQuery results
//       { results: [{ ok: true }, ...] },  // nested doActions results
//       { results: [...] },                // nested manyQueries results
//     ],
//   }

