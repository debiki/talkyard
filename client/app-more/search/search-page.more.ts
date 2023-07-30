/**
 * Copyright (c) 2016, 2017 Kaj Magnus Lindberg
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/// <reference path="../more-prelude.more.ts" />
/// <reference path="../widgets.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.search {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;


// COULD config the router to avoid % encoding in the URL inside tag names,
// e.g. ',' ':' '/' needn't be escaped in the query:
//   http://stackoverflow.com/questions/75980/when-are-you-supposed-to-use-escape-instead-of-encodeuri-encodeuricomponent
//   https://github.com/ReactTraining/react-router/issues/3764
export function searchRoute() {
  return (
    Route({ path: SearchRootPath, component: SearchPageComponent }));
}


var SearchPageComponent = createReactClass(<any> {
  displayName: 'SearchPageComponent',

  render: function() {
    return rFragment({},
        r.div({ className: 'esLegal_home container', style: { marginTop: '20px' } },
          // href="/" will be wrong if coming from the forum and it's base path isn't /, but e.g.
          // /forum/. Ignore this minor problem, for now. [7KUFS25]
          r.a({ className: 'esLegal_home_link', href: '/' }, "Home",
            r.span({ className: 'esLegal_home_arw' }, ' →'))),
        r.div({},
          Route({ path: SearchRootPath, component: SearchPageContentComponent, exact: true })));
  }
});



var SearchPageContentComponent = createReactClass(<any> {
  displayName: 'SearchPageContentComponent',
  mixins: [debiki2.StoreListenerMixin],

  getInitialState: function() {
    const store = debiki2.ReactStore.allData();
    return {
      store,
      me: store.me,  // remove 'me' [8GKB3QA]
    };
  },

  onChange: function() {
    const store = debiki2.ReactStore.allData();
    this.setState({ store, me: store.me });  // remove 'me' [8GKB3QA]
  },

  componentDidMount: function() {
    const urlQueryParams = parseQueryString(this.props.location.search);
    this.searchUseUrlQuery(urlQueryParams);
    if (urlQueryParams.advanced) {
      this.tagsLoaded = true;
      Server.loadCatsAndTagsPatchStore();  // [search_page_cats_tags]
    }
  },

  componentDidUpdate: function(prevProps, prevState) {
    // If 1) the user searches via the top bar search button, when already on the search page,
    // the url query will change. (Don't know why hen would do that.)
    const oldParams = parseQueryString(prevProps.location.search);
    const curParams = parseQueryString(this.props.location.search);
    const isNewQuery = oldParams.q !== curParams.q;

    // Or if 2) the user clicks the Search button — then we'll update the URL to show the new query,
    // which triggers this receive-props. But then we've sent a search request already.
    const ignoreUrlChange = this.ignoreUrlChange;
    this.ignoreUrlChange = false;

    // If a new user logged in, hen might be allowed to see different search results.
    const oldMe: Myself = prevState.me;
    const curMe: Myself = this.state.me;
    const isDifferentUser = oldMe.id !== curMe.id;

    if ((isNewQuery && !ignoreUrlChange) || isDifferentUser) {
      this.searchUseUrlQuery(curParams);
    }
  },

  searchUseUrlQuery: function(urlQueryParams) {
    const searchQueryText = urlQueryParams.q || '';
    // searchQueryText has already been url decoded.
    const query = parseSearchQueryInputText(searchQueryText);
    this.setState({ query: query });
    if (searchQueryText) {
      this.search(query);
    }
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  searchAndUpdateUrl: function() {
    // Update the URL if the user typed a new search query. This triggers a new search.
    const query = this.state.query;
    const urlQueryParams = parseQueryString(this.props.location.search);
    if (urlQueryParams.q !== query.rawQuery) {
      this.props.history.push({
        pathname: this.props.location.pathname,
        search: stringifyQueryString({ ...urlQueryParams,  q: query.rawQuery }),
      });
    }
    // Do search, also if has searched for the same thing — because maybe new content was just added.
    this.ignoreUrlChange = true;
    this.search(query);
  },

  search: function(query: SearchQuery) {
    if (this.searchingFor === query.rawQuery)
      return;
    this.searchingFor = query.rawQuery;
    this.setState({ isSearching: true });
    Server.search(query.rawQuery, (results: SearchResults) => {
      this.searchingFor = null;
      if (this.isGone) return;
      this.setState({
        isSearching: false,
        searchResults: results,
        lastRawQuery: query.rawQuery,
      });
    });
  },

  onQueryTextEdited: function(event) {
    let query = parseSearchQueryInputText(event.target.value);
    this.setState({ query: query });
  },

  toggleAdvanced: function() {
    let queryStringObj = parseQueryString(this.props.location.search);
    if (queryStringObj.advanced) {
      delete queryStringObj.advanced;
    }
    else {
      if (!this.tagsLoaded) {
        this.tagsLoaded = true;
        Server.loadCatsAndTagsPatchStore();
      }
      queryStringObj.advanced = 'true';
    }
    this.props.history.push({
      pathname: this.props.location.pathname,
      search: stringifyQueryString(queryStringObj),
    });
  },

  onTagsSelectionChange: function(labelsAndValues: any) {
    // Dupl code [4S5KU02]
    // We got null if the clear-all [x] button was pressed.
    labelsAndValues = labelsAndValues || [];
    let newTags = <string[]> _.map(labelsAndValues, 'value');
    let newQuery = updateTags(this.state.query, newTags);
    this.setState({ query: newQuery });
  },

  onNotTagsSelectionChange: function(labelsAndValues: any) {
    // Dupl code [4S5KU02]
    // We got null if the clear-all [x] button was pressed.
    labelsAndValues = labelsAndValues || [];
    let newTags = <string[]> _.map(labelsAndValues, 'value');
    let newQuery = updateNotTags(this.state.query, newTags);
    this.setState({ query: newQuery });
  },

  onCategoriesSelectionChange: function(labelsAndValues: any) {
    // Dupl code [4S5KU02]
    // We got null if the clear-all [x] button was pressed.
    labelsAndValues = labelsAndValues || [];
    let newCatSlugs = <string[]> _.map(labelsAndValues, 'value');
    let newQuery = updateCategories(this.state.query, newCatSlugs);
    this.setState({ query: newQuery });
  },

  render: function() {
    // BUG: """Warning: Each child in an array or iterator should have a unique "key" prop.
    // Check the render method of `SearchPageContentComponent`."""

    const store: Store = this.state.store;
    const query: SearchQuery | U = this.state.query;
    const searchResults: SearchResults | U = this.state.searchResults;

    const urlQueryParams = parseQueryString(this.props.location.search);
    const isAdvancedOpen = !!urlQueryParams.advanced;
    const advancedSearch =
      Expandable({ header: "Advanced Search", onHeaderClick: this.toggleAdvanced,
          openButtonId: 'e_SP_AdvB', className: 's_SP_Adv', isOpen: isAdvancedOpen },
        !query || !isAdvancedOpen ? null :
          AdvancedSearchPanel({ store, query,
            onTagsSelectionChange: this.onTagsSelectionChange,
            onNotTagsSelectionChange: this.onNotTagsSelectionChange,
            onCategoriesSelectionChange: this.onCategoriesSelectionChange }));

    let anyInfoText;
    let anyNothingFoundText;
    let resultsList;
    if (!searchResults) {
      if (this.state.isSearching) {
        anyInfoText = r.p({id: 'e_SP_IsSearching'}, "Searching...");
      }
    }
    else if (!searchResults.pagesAndHits.length) {
      anyNothingFoundText = r.p({ id: 'e_SP_NothingFound' }, "Nothing found.");
    }
    else {
      let pagesAndHits: PageAndHits[] = searchResults.pagesAndHits;
      resultsList = pagesAndHits.map((pageAndHits: PageAndHits) =>
          SearchResultListItem({ pageAndHits: pageAndHits, key: pageAndHits.pageId }));
    }

    let resultsForText = !this.state.lastRawQuery ? null :
      r.p({ className: 's_SP_SearchedFor' },
        "Results for ",
          r.b({}, r.samp({ id: 'e2eSERP_SearchedFor' }, `"${this.state.lastRawQuery}"`)));

    const anyWarningsList = searchResults && searchResults.warnings.map(err =>
        r.li({},
          r.span({ className: 'n_Err_Msg' }, err.errMsg),
          r.span({ className: 'n_Err_Code' }, err.errCode)));

    return (
      r.div({ className: 's_SP container' },
        r.form({},
          r.div({},
            "Search: ",
            (<any> r.input)({ type: 'text', tabIndex: '1', placeholder: "Text to search for",   // [TYPEERROR]
                value: query ? query.rawQuery : '',
                className: 's_SP_QueryTI', onChange: this.onQueryTextEdited }),
            PrimaryButton({ value: "Search", className: 's_SP_SearchB',
                onClick: () => this.searchAndUpdateUrl() },
              "Search"),
          !anyWarningsList ? null :
              r.ul({ className: 'c_SP_QueryWarns' }, anyWarningsList),
          advancedSearch),
        anyInfoText,
        resultsForText,
        anyNothingFoundText,
        r.div({ className: 's_SP_SRs' },
          r.ol({},
            resultsList)))));
  }
});



// COULD:
// - search in titles only
// - search by user, but then, consider hens privacy seeActivityMinTrustLevel setting,
//    and add e2e test here: [6UKDSQ29].
function AdvancedSearchPanel(props: {
      store: Store,
      query: SearchQuery,
      onTagsSelectionChange: any,
      onNotTagsSelectionChange: any,
      onCategoriesSelectionChange: any }) {
  const store: Store = props.store;
  return (
    r.div({},
      r.div({ className: 'form-group' },
        r.label({ className: 'control-label' }, "Search in these categories:"),
        // UX SHOULD add a modal backdrop and close Select if clicked.
        rb.ReactSelect({ multi: true, value: props.query.categorySlugs,
          placeholder: "Select categories", autoBlur: true,
          // BUG: [4GWRQA28] (need not fix now) If many sub communities, this'll list categories from ...
          // ?which? sub community? But not all. Probably want to list cats from all sub communities?
          options: makeCategoryLabelValues(store.currentCategories),
          onChange: props.onCategoriesSelectionChange })),
      /* Reimplement, with new tags. & add username search too?  [missing_tags_feats]
      r.div({ className: 'form-group' },
        r.label({ className: 'control-label' }, "For posts with tags:"),
        // UX SHOULD add a modal backdrop and close Select if clicked.
        rb.ReactSelect({ multi: true, value: props.query.tags,
          placeholder: "Select tags",
          options: makeTagLabelValues(store.tagsStuff),
          onChange: props.onTagsSelectionChange })),
      r.div({ className: 'form-group' },
        r.label({ className: 'control-label' }, "But ", r.i({}, "without"), " these tags:"),
        // UX SHOULD add a modal backdrop and close Select if clicked.
        rb.ReactSelect({ multi: true, value: props.query.notTags,
          placeholder: "Select tags",
          options: makeTagLabelValues(store.tagsStuff),
          onChange: props.onNotTagsSelectionChange }))
      // On pages with tags:
      // But without these tags:
      */
    ));
}


function makeCategoryLabelValues(categories: Category[]) {
  if (!categories)
    return [];
  return categories.map((category: Category) => {
    return {
      label: category.name,
      value: category.slug,
    };
  });
}

/*  [missing_tags_feats]
function makeTagLabelValues(tagsStuff: TagsStuff) {
  if (!tagsStuff || !tagsStuff.tagsAndStats)
    return [];
  return tagsStuff.tagsAndStats.map((tagAndStats: TagAndStats) => {
    return {
      label: tagAndStats.label,
      value: tagAndStats.label,
    };
  });
} */



function SearchResultListItem(props: { pageAndHits: PageAndHits, key?: string | number }) {
  let pageAndHits: PageAndHits = props.pageAndHits;
  let hits = pageAndHits.hits.map(hit =>
      SearchResultHit({ hit: hit, urlPath: pageAndHits.urlPath, key: hit.postNr }));
  return (
    r.li({ className: 's_SR', key: props.key },
      r.h3({ className: 'esSERP_Hit_PageTitle' },
        r.a({ href: pageAndHits.urlPath }, pageAndHits.pageTitle)),
      r.ol({}, hits)));
}



function SearchResultHit(props: { hit: any, urlPath: string, key?: string | number }) {
  let hit: SearchHit = props.hit;
  // Any html stuff was escaped here: [7YK24W].
  let safeHtml = hit.approvedTextWithHighlightsHtml.join(" <b>...</b> ");
  return (
    r.li({ className: 's_SR_Hit', key: props.key },
      r.span({ className: 'esSERP_Hit_In' },
        "In ", r.a({ href: `${props.urlPath}#post-${hit.postNr}`,   // I18N
                  className: 'esSERP_Hit_In_Where' },
          foundWhere(hit)), ':'),
      r.p({ className: 'esSERP_Hit_Text',
          dangerouslySetInnerHTML: { __html: safeHtml }})));
}



function foundWhere(hit: SearchHit): string {
  switch (hit.postNr) {
    case TitleNr: return "the title";
    case BodyNr: return "the page text";
    default: return "a comment";
  }
}


// Regex syntax: *? means * but non-greedy
const TagNamesRegex = /^(.*? )?tags:([^ ]*) *(.*)$/;
const NotTagNamesRegex = /^(.*? )?-tags:([^ ]*) *(.*)$/;
const CategorySlugsRegex = /^(.*? )?categories:([^ ]*) *(.*)$/;

function parseSearchQueryInputText(text: string): SearchQuery {
  // Sync with Scala [5FK8W2R]
  function findMatches(regex): string[] {
    let matches = text.match(regex);
    return matches && matches[2] ? matches[2].split(',') : [];
  }
  let tagNames = findMatches(TagNamesRegex);
  let notTagNames = findMatches(NotTagNamesRegex);
  let categorySlugs = findMatches(CategorySlugsRegex);
  return {
    rawQuery: text,
    tags: tagNames,
    notTags: notTagNames,
    categorySlugs: categorySlugs,
  };
}


function updateTags(oldQuery: SearchQuery, newTags: string[]): SearchQuery {
  return updateListInQuery(oldQuery, 'tags', 'tags', TagNamesRegex, newTags);
}


function updateNotTags(oldQuery: SearchQuery, newTags: string[]): SearchQuery {
  return updateListInQuery(oldQuery, 'notTags', '-tags', NotTagNamesRegex, newTags);
}


function updateCategories(oldQuery: SearchQuery, newCategorySlugs: string[]): SearchQuery {
  return updateListInQuery(oldQuery, 'categorySlugs', 'categories', CategorySlugsRegex,
      newCategorySlugs);
}


function updateListInQuery(oldQuery: SearchQuery, fieldName: string, what: string,
      whatRegex, newThings: string[]): SearchQuery {
  let newRawQuery;
  let spaceAndThings = newThings.length ? ` ${what}:` + newThings.join(',') : '';
  let matches = oldQuery.rawQuery.match(whatRegex);
  if (!matches) {
    newRawQuery = oldQuery.rawQuery.trim() + spaceAndThings;
  }
  else {
    let matches3 = (matches[3] || '').trim();
    newRawQuery = (matches[1] || '').trim() + spaceAndThings + (matches3 ? ' ' : '') + matches3;
  }
  let newQuery = _.clone(oldQuery);
  newQuery.rawQuery = newRawQuery;
  newQuery[fieldName] = newThings;
  return newQuery;
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
