
// Public API Typescript types. [PUB_API]
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


// Old, deprecated?
interface ListUsersApiResponse {
  // RENAME to thingsFound?
  users: UserFound[];
}


// Misc types
// -------------------------

type ApiResponse<R> = ApiErrorResponse | R;

type ApiErrorResponse = { error: any; };

type ParticipantId = string;

type MemberRef = string;
type PageRef = string;
type CategoryRef = string;
type TagRef = string;
type BadgeRef = string;

type SortOrder = 'PopularFirst' | 'ActiveFirst' | 'NewestFirst';

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

  // Users and groups (not guests).
  'Members' |

  // Users, groups, guests.
  'Participants' |

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

  // Find these pages, or posts or participants in these pages.
  // E.g.  { inPages: 'pageid:112233' }  ?
  inPages?: PageRef[];

  // Find pages in these categories.
  // E.g.  { inPages: 'catid:112233' }  ?
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
  ppId: ParticipantId;
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
  numRepliesVisible?: Nr;
}


// Rename to PageWithDefaultFieilds ?
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
// *prefix* only, then instead use a List Query, to list all participants with
// matching usernames — now, you might get back 0, 1 or many matching things.
//
// Tech details: Looks up by database primary key. So you know you'll get 1 or 0.
// That's why the getWhat and ids (e.g. `getPages: [page-id-one, two, three]`)
// are one single same key-value. — Compare with ListQuery, which has two separate
// fields: findWhat: ... and lookWhere: .... E.g. findWhat: 'Posts' and
// lookWhere: category-ids, to find recent posts in those categories.
//
interface GetQueryApiRequest {
  getQuery: GetPagesQuery;
  pretty?: Bo;
}

interface GetPagesQuery {
  getPages: PageRef[];
  fields: { numRepliesVisible: true };
}

interface GetQueryResults<T extends ThingFound> {
  origin: St;
  thingsFound?: T[];
}

// Examples:
//
// Get blog post comment counts:
//
//  /-/v0/get {
//    getQuery: {
//      getPages: ['emburl:https://blog/blog-post', 'emburl:https://blog/another'],
//      fields: { numRepliesVisible: true },
//    }
//  }
//
// Could return this — assuming the first blog post, /blog-post, wasn't found:
//
//   [null, { numRepliesVisible: 123 }]
//



// A  List Query request
// -------------------------


// List Queries are comparatively fast — they lookup things directly, via indexes in
// the PostgreSQL database.  However they cannot do full text search — for that,
// you need a Search Query.
//
// Tech details: Looks up by database index typically other than the primary key index.
// The index might be on table B, although you're finding things in table A.
// E.g. you might list the most recent posts (topics and replies) in a category.
//
interface ListQueryApiRequest {
  // Either:
  listQuery?: ListQuery;
  sortOrder?: SortOrder;

  // Or:
  continueAtScrollCursor?: ListResultsScrollCursor;

  limit?: number;
  pretty?: boolean;
}

interface ListQuery {
  // E.g. username prefix.
  exactPrefix?: string;
  findWhat: FindWhat,
  lookWhere?: LookWhere;
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
//      findWhat: 'Members',
//      lookWhere: { usernames: true },
//    }
//  }
//
// List popular pages in a category:
//
//  /-/v0/list  {
//    listQuery: {
//      findWhat: 'Pages',
//      lookWhere: { inCategories: [categoryA, catB, catC] },
//    }
//    sortOrder: 'PopularFirst',
//    limit: 5,
//  }



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
// Find a user:
//
//  /-/v0/search  {
//    searchQuery: {
//      freetext: 'jane',
//      findWhat: 'Members',
//      lookWhere: { usernames: true, fullNames: true }
//    }
//  }
//
// This compound query finds posts about how to climb a tree, written by someone
// with "Doe" in their name:
//
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


