/**
 * Copyright (C) 2016 Kaj Magnus Lindberg
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

/// <reference path="../../typedefs/react/react.d.ts" />
/// <reference path="../slim-bundle.d.ts" />
/// <reference path="../widgets.more.ts" />

//------------------------------------------------------------------------------
   module debiki2.search {
//------------------------------------------------------------------------------

var r = React.DOM;


// COULD config the router to avoid % encoding in the URL inside tag names,
// e.g. ',' ':' '/' needn't be escaped in the query:
//   http://stackoverflow.com/questions/75980/when-are-you-supposed-to-use-escape-instead-of-encodeuri-encodeuricomponent
//   https://github.com/ReactTraining/react-router/issues/3764
export function routes() {
  return (
    Route({ path: '/-/search', component: SearchPageComponent },
      IndexRoute({ component: SearchPageContentComponent })));
}


export function urlEncodeSearchQuery(query: string): string {
  // encodeURIComponent encodes a query string param and escapes "everything", but we
  // don't need to do that. Instead, use encodeURI, and then manually escape a few
  // more chars. This is the difference between encodeURIComponent and encodeURI:
  // for (var i = 0; i < 256; i++) {
  //   var char = String.fromCharCode(i);
  //   if (encodeURI(char) !== encodeURIComponent(char)) {
  //     console.log(char + ': ' + encodeURI(char) + ' —> ' + encodeURIComponent(char));
  //   }
  // }
  // (see http://stackoverflow.com/a/23842171/694469)
  // ==>
  // #: # —> %23
  // $: $ —> %24
  // &: & —> %26
  // +: + —> %2B
  // ,: , —> %2C
  // /: / —> %2F
  // :: : —> %3A
  // ;: ; —> %3B
  // =: = —> %3D
  // ?: ? —> %3F
  // @: @ —> %40

  var encoded = encodeURI(query);
  encoded = encoded.replace('#', '%23');
  encoded = encoded.replace('$', '%24');
  encoded = encoded.replace('&', '%26');
  // '+' means space in a query param and is easier to read. First encode all "real" '+' to %2B,
  // then decode spaces to '+':
  encoded = encoded.replace('+', '%2B');
  encoded = encoded.replace('%20', '+');
  // leave , / :  — they're reserved for us to use as delimiters or whatever.
  encoded = encoded.replace(';', '%3B');
  encoded = encoded.replace('=', '%3D');
  encoded = encoded.replace('?', '%3F');
  // leave @  — it's reserved for us.
  return encoded;
}


var SearchPageComponent = React.createClass(<any> {
  displayName: 'SearchPageComponent',

  render: function() {
    return (
      r.div({},
        reactelements.TopBar({ backToSiteButtonTitle: "Back" }),
        r.div({ className: 'esLegal_home container', style: { marginTop: '20px' } },
          // href="/" will be wrong if coming from the forum and it's base path isn't /, but e.g.
          // /forum/. Ignore this minor problem, for now. [7KUFS25]
          r.a({ className: 'esLegal_home_link', href: '/' }, "Home",
            r.span({ className: 'esLegal_home_arw' }, ' →'))),
        r.div({},
          this.props.children)));
  }
});



var SearchPageContentComponent = React.createClass(<any> {
  displayName: 'SearchPageContentComponent',
  mixins: [debiki2.StoreListenerMixin],

  contextTypes: {
    router: React.PropTypes.object.isRequired
  },

  getInitialState: function() {
    return {
      searchResults: null,
      isSearching: false,
      store: debiki2.ReactStore.allData(),
    };
  },

  onChange: function() {
    this.setState({
      store: debiki2.ReactStore.allData(),
    });
  },

  componentWillMount: function() {
    let queryString = this.props.location.query;
    let queryParam = queryString.q || '';
    // queryParam has already been url decoded.
    let query = parseSearchQueryInputText(queryParam);
    this.setState({ query: query });
    if (queryParam) {
      this.search(query);
    }
    if (this.props.location.query.advanced) {
      this.tagsLoaded = true;
      Server.loadTagsAndStats();
    }
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  search: function(query?: SearchQuery) {
    query = query || this.state.query;
    this.setState({ isSearching: true });
    if (this.props.location.query.q !== query.rawQuery) {
      let queryStringObj = _.assign({}, this.props.location.query, { q: query.rawQuery });
      this.context.router.push({
        pathname: this.props.location.pathname,
        query: queryStringObj,
      });
    }
    Server.search(query.rawQuery, (results: SearchResults) => {
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
    let queryStringObj = _.assign({}, this.props.location.query);
    if (queryStringObj.advanced) {
      delete queryStringObj.advanced;
    }
    else {
      if (!this.tagsLoaded) {
        this.tagsLoaded = true;
        Server.loadTagsAndStats();
      }
      queryStringObj.advanced = true;
    }
    this.context.router.push({
      pathname: this.props.location.pathname,
      query: queryStringObj,
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
    let store: Store = this.state.store;
    let query: SearchQuery = this.state.query;
    let searchResults: SearchResults = this.state.searchResults;

    let isAdvancedOpen = !!this.props.location.query.advanced;
    let advancedSearch =
      Expandable({ header: "Advanced Search", onHeaderClick: this.toggleAdvanced,
          openButtonId: 'e_SP_AdvB', className: 's_SP_Adv', isOpen: isAdvancedOpen },
        !isAdvancedOpen ? null :
          AdvancedSearchPanel({ store: store, query: query,
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
      resultsList = pagesAndHits.map(pageAndHits =>
          SearchResultListItem({ pageAndHits: pageAndHits, key: pageAndHits.pageId }));
    }

    let resultsForText = !this.state.lastRawQuery ? null :
      r.p({ className: 's_SP_SearchedFor' },
        "Results for ",
          r.b({}, r.samp({ id: 'e2eSERP_SearchedFor' }, `"${this.state.lastRawQuery}"`)));

    return (
      r.div({ className: 's_SP container' },
        r.form({},
          r.div({},
            "Search: ",
            r.input({ type: 'text', tabIndex: '1', placeholder: "Text to search for",
                value: query.rawQuery,
                className: 's_SP_QueryTI', onChange: this.onQueryTextEdited }),
            PrimaryButton({ value: "Search", className: 's_SP_SearchB',
                onClick: () => this.search() },
              "Search"),
          advancedSearch),
        anyInfoText,
        resultsForText,
        anyNothingFoundText,
        r.div({ className: 's_SP_SRs' },
          r.ol({},
            resultsList)))));
  }
});



function AdvancedSearchPanel(props: {
      store: Store,
      query: SearchQuery,
      onTagsSelectionChange: any,
      onNotTagsSelectionChange: any,
      onCategoriesSelectionChange: any }) {
  return (
    r.div({},
      r.div({ className: 'form-group' },
        r.label({ className: 'control-label' }, "Search in these categories:"),
        // UX SHOULD add a modal backdrop and close Select if clicked.
        rb.ReactSelect({ multi: true, value: props.query.categorySlugs,
          placeholder: "Select categories", autoBlur: true,
          options: makeCategoryLabelValues(props.store.categories),
          onChange: props.onCategoriesSelectionChange })),
      r.div({ className: 'form-group' },
        r.label({ className: 'control-label' }, "For posts with tags:"),
        // UX SHOULD add a modal backdrop and close Select if clicked.
        rb.ReactSelect({ multi: true, value: props.query.tags,
          placeholder: "Select tags",
          options: makeTagLabelValues(props.store.tagsStuff),
          onChange: props.onTagsSelectionChange })),
      r.div({ className: 'form-group' },
        r.label({ className: 'control-label' }, "But ", r.i({}, "without"), " these tags:"),
        // UX SHOULD add a modal backdrop and close Select if clicked.
        rb.ReactSelect({ multi: true, value: props.query.notTags,
          placeholder: "Select tags",
          options: makeTagLabelValues(props.store.tagsStuff),
          onChange: props.onNotTagsSelectionChange }))
      // On pages with tags:
      // But without these tags:
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


function makeTagLabelValues(tagsStuff: TagsStuff) {
  if (!tagsStuff || !tagsStuff.tagsAndStats)
    return [];
  return tagsStuff.tagsAndStats.map((tagAndStats: TagAndStats) => {
    return {
      label: tagAndStats.label,
      value: tagAndStats.label,
    };
  });
}



function SearchResultListItem(props: { pageAndHits: PageAndHits, key?: any }) {
  let pageAndHits: PageAndHits = props.pageAndHits;
  let hits = pageAndHits.hits.map(hit =>
      SearchResultHit({ hit: hit, pageId: pageAndHits.pageId, key: hit.postNr }));
  return (
    r.li({ className: 's_SR', key: props.key },
      r.h3({ className: 'esSERP_Hit_PageTitle' },
        r.a({ href: `/-${pageAndHits.pageId}` }, pageAndHits.pageTitle)),
      r.ol({}, hits)));
}



function SearchResultHit(props: { hit: any, pageId: PageId, key?: any }) {
  let hit: SearchHit = props.hit;
  let pageId = props.pageId;
  // Any html stuff was escaped here: [7YK24W].
  let safeHtml = hit.approvedTextWithHighligtsHtml.join(" <b>...</b> ");
  return (
    r.li({ className: 's_SR_Hit', key: props.key },
      r.span({ className: 'esSERP_Hit_In' },
        "In ", r.a({ href: `/-${pageId}#post-${hit.postNr}`, className: 'esSERP_Hit_In_Where' },
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
