/*
 * Copyright (c) 2014-2016 Kaj Magnus Lindberg
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

/// <reference path="../prelude.ts" />
/// <reference path="../utils/utils.ts" />
/// <reference path="../utils/react-utils.ts" />
/// <reference path="../help/help.ts" />
/// <reference path="../topbar/topbar.ts" />
/// <reference path="../help/help.ts" />
/// <reference path="../rules.ts" />
/// <reference path="discussion.ts" />
/// <reference path="chat.ts" />
/// <reference path="scroll-buttons.ts" />

// Wrapping in a module causes an ArrayIndexOutOfBoundsException: null error, see:
//  http://stackoverflow.com/questions/26189940/java-8-nashorn-arrayindexoutofboundsexception
// The bug has supposedly been fixed in Java 8u40. Once I'm using that version,
// remove `var exports = {};` from app/debiki/ReactRenderer.scala.
//------------------------------------------------------------------------------
   namespace debiki2 {
//------------------------------------------------------------------------------

var r = React.DOM;


var PageWithState = createComponent({
  mixins: [debiki2.StoreListenerMixin],

  getInitialState: function() {
    return debiki2.ReactStore.allData();
  },

  onChange: function() {
    this.setState(debiki2.ReactStore.allData());
  },

  render: function() {
    return Page(this.state);
  }
});


var Page = createComponent({
  getInitialState: function() {
    return {
      useWideLayout: this.isPageWide(),
    };
  },

  componentDidMount: function() {
    // A tiny bit dupl code though, perhaps break out... what? a mixin? [5KFEWR7]
    this.timerHandle = setInterval(this.checkSizeChangeLayout, 200);
  },

  componentWillUnmount: function() {
    this.isGone = true;
    clearInterval(this.timerHandle);
  },

  checkSizeChangeLayout: function() {
    // Dupl code [5KFEWR7]
    if (this.isGone) return;
    var isWide = this.isPageWide();
    if (isWide !== this.state.useWideLayout) {
      this.setState({ useWideLayout: isWide });
    }
  },

  isPageWide: function(): boolean {
    return store_getApproxPageWidth(this.props) > UseWidePageLayoutMinWidth;
  },

  render: function() {
    const isEmbeddedComments: boolean = debiki.internal.isInEmbeddedCommentsIframe;
    const store: Store = this.props;
    const content = page_isChatChannel(store.pageRole)
        ? debiki2.page.ChatMessages({ store: store })
        : debiki2.page.TitleBodyComments({ store: store });
    const compactClass = this.state.useWideLayout ? '' : ' esPage-Compact';
    const pageTypeClass = ' s_PT-' + store.pageRole;
    return (
      r.div({ className: 'esPage' + compactClass + pageTypeClass },
        page_isChatChannel(store.pageRole) ? null : debiki2.reactelements.TopBar({}),
        isEmbeddedComments ? null : debiki2.page.ScrollButtons(),
        r.div({ className: 'container' },
          r.article({},
            content))));
  }
});


export function renderTitleBodyComments() {
  const root = document.getElementById('dwPosts');
  if (!root)
    return;

  debiki2.avatar.resetAvatars();

  const store: Store = debiki2.ReactStore.allData();
  if (store.pageRole === PageRole.Forum) {
    // scrollBehavior: debiki2.forum.ForumScrollBehavior,
    ReactDOM.render(
        Router({}, debiki2.forum.buildForumRoutes()), root);
  }
  else {
    ReactDOM.render(PageWithState(), root);
  }
}


export function renderTitleBodyCommentsToString() {
  debiki2.avatar.resetAvatars();

  // Comment in the next line to skip React server side and debug in browser only.
  //return '<p class="dw-page" data-reactid=".123" data-react-checksum="123">react_skipped [BRWSRDBG]</p>'

  const store: Store = debiki2.ReactStore.allData();
  if (store.pageRole === PageRole.Forum) {
    const routes = debiki2.forum.buildForumRoutes();
    // In the future, when using the HTML5 history API to update the URL when navigating
    // inside the forum, we can use `store.pagePath` below. But for now:
    const store: Store = debiki2.ReactStore.allData();
    const path = store.pagePath.value + 'latest';
    return ReactDOMServer.renderToString(
        Router({ location: path }, routes));
  }
  else {
    return ReactDOMServer.renderToString(Page(store));
  }
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
