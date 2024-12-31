/*
 * Copyright (C) 2014-2016 Kaj Magnus Lindberg
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

/// <reference path="../../../node_modules/@types/keymaster/index.d.ts" />
/// <reference path="../ReactStore.ts" />
/// <reference path="../page/discussion.ts" />
/// <reference path="../page/scroll-buttons.ts" />
/// <reference path="../help/help.ts" />
/// <reference path="../utils/DropdownModal.ts" />
/// <reference path="../avatar/AvatarAndName.ts" />
/// <reference path="../util/FadingBackdrop.ts" />
//xx <reference path="unread-comments-tracker.ts" />
/// <reference path="../more-bundle-not-yet-loaded.ts" />
/// <reference path="../staff-bundle-not-yet-loaded.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.sidebar {
//------------------------------------------------------------------------------

const keymaster: Keymaster = window['keymaster'];
const r = ReactDOMFactories;
const ModalDropdownButton = utils.ModalDropdownButton;

// COULD UX RESPONSIVE: add some screen/window/widget width or size state to some React store somehow. [6KP024]
// Use outerWidth, it won't force a layout reflow.
const smallWindow = Math.min(window.outerWidth, window.outerHeight) < 500;
const windowWideEnoughForTabButtons = window.outerWidth > 1010;

const SidebarNumCommentsLimit = 5 + 1;  // 5 + page body

// Or should one interact with it via Actions instead? For now, this is simpler & faster:
export var contextBar;

export function createContextbar(elem) {
  contextBar = ReactDOM.render(sidebar.Sidebar({}), elem);
}


type WhichPanel = 'Recent' | 'Starred' | 'Users' | 'AdminGuide'


interface ContextbarState {
  store: Store
  lastLoadedOnlineUsersAsId: PatId
  commentsType: WhichPanel
  curPostNr?: PostNr
  adminGuide?: RElm
}


export var Sidebar = createComponent({  // RENAME to ContextBar
  displayName: 'ContextBar',
  mixins: [debiki2.StoreListenerMixin],

  getInitialState: function() {
    const store: Store = debiki2.ReactStore.allData();
    const page: Page = store.currentPage;
    const me = store.me;
    // Show sidebar by default, in 1D layout, otherwise people will never notice
    // that it exists.

    // Move this elsewhere? To where?
    /*
    var showSidebar = false;
    if (!store.horizontalLayout && canUseLocalStorage()) {
      var setting = getFromLocalStorage('debikiShowSidebar');
      if (page.numPosts <= SidebarNumCommentsLimit) {
        // Sidebar not needed — navigating only this few comments with not sidebar, is okay.
      }
      else if (!setting || setting === 'true') {
        showSidebar = true;
        $('html').addClass('dw-sidebar-open');
      }
    }

    and:
     putInLocalStorage('debikiShowSidebar', this.state.showSidebar ? 'true' : 'false');
    */

    // If is admin, show the admin guide, unless the admin has clicked away from it.
    // If is chat, then we want to see online users (however, showing recent comments makes no
    // sense, because the chat messages (= comments) are already sorted chronologically).
    let commentsType: WhichPanel;
    if (me.isAdmin && getFromLocalStorage('showAdminGuide') !== 'false') {
      commentsType = 'AdminGuide';
      this.loadAdminGuide();
    }
    else {
      commentsType = isPageWithComments(page.pageRole) && !page_isChat(page.pageRole)
          ? 'Recent'
          : 'Users';
    }

    const state: ContextbarState = {
      store: store,
      lastLoadedOnlineUsersAsId: null,
      commentsType: commentsType,
      // showPerhapsUnread: false,
    };
    return state;
  },

  onChange: function() {
    const newStore: Store = debiki2.ReactStore.allData();
    this.setState({
      store: newStore,
    } as ContextbarState);
    this.maybeLoadOnlineUsers(newStore);
  },

  showRecent: function() {
    this.setState({ commentsType: 'Recent' } as ContextbarState);
    setTimeout(() => {
      if (this.isGone) return;
      processTimeAgo('.esCtxbar_list')
    });
  },

  /*
  showUnread: function() {
    this.setState({ commentsType: 'Unread' } as ContextbarState);
  },*/

  showStarred: function() {
    this.setState({ commentsType: 'Starred' } as ContextbarState);
  },

  /*
  togglePerhapsUnread: function() {
    this.setState({ showPerhapsUnread: !this.state.showPerhapsUnread } as ContextbarState);
  }, */

  showUsers: function() {
    this.setState({ commentsType: 'Users' } as ContextbarState);
  },

  showAdminGuide: function() {
    this.setState({ commentsType: 'AdminGuide' } as ContextbarState);
    this.loadAdminGuide();
  },

  loadAdminGuide: function() {
    if (!this.state || !this.state.adminGuide) {
      staffbundle.loadAdminGuide(adminGuide => {
        if (this.isGone) return;
        this.setState({ adminGuide } as ContextbarState);
      });
    }
  },

  highligtDuringMillis: function(millis: number) {
    this.refs.fadingBackdrop.showForMillis(millis);
  },

  componentDidMount: function() {
    const store: Store = this.state.store;
    keymaster('s', this.toggleSidebarOpen);
    this.maybeLoadOnlineUsers();
  },

  componentWillUnmount: function() {
    this.isGone = true;
    keymaster.unbind('s', 'all');
  },

  componentDidUpdate: function(prevProps, prevState) {
    // Stop always-showing-the-admin-guide-on-page-load if the admin clicks away from it.
    const state: ContextbarState = this.state;
    const store: Store = state.store;
    if (store.me.isAdmin && state.commentsType !== prevState.commentsType) {
      putInLocalStorage(
          'showAdminGuide', state.commentsType === 'AdminGuide' ? 'true' : 'false');
    }
    // And:
    // if is-2d then: this.updateSizeAndPosition2d(event);
  },

  maybeLoadOnlineUsers: function(anyNewStore?: Store) {
    const state: ContextbarState = this.state;
    const store: Store = anyNewStore || state.store;

    // Online users list not visible, or disabled?
    if (!store.isContextbarOpen || !store.userIdsOnline)
      return;

    // Not logged in? Then likely won't care who's online or not.
    if (!store.me.id)
      return;

    // List already loaded?
    if (store.me.id === this.state.lastLoadedOnlineUsersAsId)
      return;

    this.setState({ lastLoadedOnlineUsersAsId: store.me.id } as ContextbarState);
    // Skip for now, because now I'm including all online users are included in the page html.
    //Server.loadOnlineUsers();
  },

  updateSizeAndPosition2d: function(event) {
    /* Try to remove. Or does this do sth useful for the minimap? Test if it's broken, to find out.
    var win = debiki.window;
    var nextState = '' + win.width() + ',' + win.height() + ':' + (event ? event.type : null);
    if (this.lastState === nextState && event && event.type === 'scroll') {
      // Need do nothing.
      return;
    }
    this.lastState = nextState;

    var padding = $('#dw-sidebar-padding');
    if (this.state.showSidebar) {
      this.sidebar.height(win.height());
      this.updateCommentsScrollbar();

      // When the window viewport is at the right doc edge, we don't want the sidebar
      // to overlap the rightmost comments. So add some horizontal padding after the
      // rightmost comment column, as wide as the sidebar.
      if (!padding.length) {
        padding =  $('<li id="dw-sidebar-padding"><div ' +
            'style="height: 1px; background-color: transparent;"></div></li>');
        padding.appendTo($('.dw-t.dw-depth-0 > .dw-single-and-multireplies > .dw-res'));
      }
      // The <li> has display: table-cell, so need to (?) set width on something inside.
      padding.children('div').width(this.sidebar.width());
    }
    else {
      padding.remove();
    } */
  },

  toggleSidebarOpen: function() {
    ReactActions.togglePagebarOpen();
  },

  openSidebar: function() {
    ReactActions.setPagebarOpen(true);
  },

  closeSidebar: function() {
    ReactActions.setPagebarOpen(false);
  },

  findComments: function() {
    const state: ContextbarState = this.state;
    const store: Store = state.store;
    const page: Page = store.currentPage;
    const unreadComments = [];
    let recentComments = [];
    const starredComments = [];

    // Find 1) all unread comments, sorted in the way they appear on the page
    // And 2) all visible comments.
    // Should fetch from server, if page big. [fetch_alias]
    const addRecursively = (postNrs: number[]) => {
      _.each(postNrs, (postNr) => {
        const post: Post = page.postsByNr[postNr];
        if (post && post.nr >= BodyNr) {
          addPost(post);
          addRecursively(post.childNrsSorted);
        }
      });
    };

    const addPost = (post: Post) => {
      if (isDeleted(post))
        return;

      recentComments.push(post);
      if (this.isStarred(post.nr)) {
        starredComments.push(post);
      }

      /* Unread? Skip for now, not saved anywhere anyway
      // Do include comments that where auto-read right now — it'd be annoying
      // if they suddenly vanished from the sidebar just because the computer
      // suddenly automatically thought you've read them.
      var autoReadLongAgo = store.user.myCurrentPageData.postNrsAutoReadLongAgo.indexOf(postId) !== -1;
      // No do include comments auto-read just now. Otherwise it's impossible to
      // figure out how the Unread tab works and the 'Let computer determine' checkbox.
      autoReadLongAgo = autoReadLongAgo || store.user.postIdsAutoReadNow.indexOf(postId) !== -1;
      var hasReadItForSure = this.manuallyMarkedAsRead(postId);
      var ownPost = post.authorId === store.user.id;
      if (!ownPost && !hasReadItForSure) {
        if (!autoReadLongAgo || this.state.showPerhapsUnread) {
          unreadComments.push(post);
        }
      }
      */
    };

    const rootPost = page.postsByNr[store.rootPostId];
    addRecursively(rootPost.childNrsSorted);

    _.each(page.postsByNr, (child: Post) => {
      if (child.postType === PostType.Flat) {
        addPost(child);
      }
    });

    recentComments.sort((a: Post, b: Post) => {
      // Newest first.
      if (a.createdAtMs < b.createdAtMs)
        return +1;
      if (a.createdAtMs > b.createdAtMs)
        return -1;
      return a.nr < b.nr ? +1 : -1;
    });
    recentComments = _.take(recentComments, 50);

    return { unread: unreadComments, recent: recentComments, starred: starredComments };
  },

  manuallyMarkedAsRead: function(postId: number): boolean {
    const state: ContextbarState = this.state;
    const store: Store = state.store;
    const mark = store.me.myCurrentPageData.marksByPostId[postId];
    return !!mark; // any mark means it's been read already.
  },

  isStarred: function(postId: number) {
    const state: ContextbarState = this.state;
    const store: Store = state.store;
    const mark = store.me.myCurrentPageData.marksByPostId[postId];
    return mark === BlueStarMark || mark === YellowStarMark;
  },

  onPostClick: function(post: Post) {
    this.focusPost(post);
  },

  focusPost: function(post: Post) {
    const state: ContextbarState = this.state;
    const store: Store = state.store;
    this.setState({
      curPostNr: post.nr
    } as ContextbarState);
    page.addVisitedPosts(null, post.nr);
    ReactActions.loadAndShowPost(post.nr);
    if (store.shallSidebarsOverlayPage) {
      // Won't see the post unless we first close the contextbar.
      ReactActions.closePagebar();
    }
  },

  render: function() {
    const state: ContextbarState = this.state;
    const store: Store = state.store;
    const page: Page = store.currentPage;
    const me: Myself = store.me;

    //var minimapProps = _.assign({ ref: 'minimap' }, store);
    const commentsFound = isPageWithComments(page.pageRole) ? this.findComments() : null;
    const isChat = page_isChat(page.pageRole);
    const isStaffOrMyPage = isStaff(me) || store_thisIsMyPage(store);

    let sidebarClasses = '';
    if (page.horizontalLayout) {
      sidebarClasses += ' dw-sidebar-fixed';
    }

    const usersHere = store_getUsersHere(store);

    // If the current user is the only active user, write "you" instead of "1"
    // because it'd be so boring to see "1" online user and click the Users tab only
    // to find out that it's oneself. (Also, skip spaces around '/' if number not "you")
    const numOnlineTextSlash = usersHere.onlyMeOnline ? t.you + ' / ' : usersHere.numOnline + "/";

    //var unreadBtnTitle = commentsFound ? 'Unread (' + commentsFound.unread.length + ')' : null;
    const starredBtnTitle = commentsFound ? `${t.Bookmarks} (${commentsFound.starred.length})` : null;

    const specificPage = usersHere.areChatChannelMembers || usersHere.areTopicContributors;
    const anyUsersBtnTitle: St | N = (
        // If the presence feature is enabled, we'll include a num-online count.
        store.userIdsOnline
          ? (specificPage
              // List users on current page, and indicate which ones are online?
              ? `${t.Users} (${numOnlineTextSlash + usersHere.users.length})`
              // List users in the whole forum, and indicate which ones are online?
              : `${t.Users} (${usersHere.numOnline})`)
          : (specificPage
              // List users on current page, but without any is-online indicators.
              ? t.Users
              // List no users. Not a specific page, & presence disabled, don't know who's online.
              : null));

    // COULD show a "Recent searches" on the search results page. Click a recent search, to
    // use it again.

    let title;
    let unreadClass = '';
    let recentClass = '';
    let starredClass = '';
    let usersClass = '';
    let adminGuideActiveClass = '';
    let listItems: any[];

    // (If the page type was just changed to a page without comments, the Recent or Bookmarks
    // tab might be open, although commentsFound is now null (40WKP20) )
    switch (state.commentsType) {
      case 'Recent':
        let recentComments = commentsFound ? commentsFound.recent : []; // see (40WKP20) above
        title = recentComments.length ? t.cb.RecentComments : t.cb.NoComments;
        recentClass = ' active';
        listItems = makeCommentsContent(recentComments, state.curPostNr, store,
            this.onPostClick);
        break;
      /*
      case 'Unread':
        let unreadComments = commentsFound ? commentsFound.unread : []; // see (40WKP20) above
        title = unreadComments.length ?
            'Unread Comments: (click to show)' : 'No unread comments found.';
        unreadClass = ' active';
        listItems = ...
        break; */
      case 'Starred':
        title = t.cb.YourBookmarks;
        starredClass = ' active';
        let starredComments = commentsFound ? commentsFound.starred : []; // see (40WKP20) above
        listItems = makeCommentsContent(starredComments, state.curPostNr, store,
            this.onPostClick);
        break;
      case 'Users':
        let numOnlineStrangers: Nr | N = store.numOnlineStrangers;
        const seeOnlineDisabled = "See-online feature disabled."; // 0I18N, just temporary
        if (page.pageRole === PageRole.Forum) {
          title = store.userIdsOnline ? t.cb.UsersOnlineForum :
                    // Can happen when toggling off the presence feature? [settings_race]
                    // UX: This isn't great, what to do instead when moving from one page to
                    // another, but the currently selected tab doesn't "work" at the other page?
                    seeOnlineDisabled;
        }
        else if (!usersHere.areChatChannelMembers && !usersHere.areTopicContributors) {
          title = store.userIdsOnline ? t.cb.UsersOnline : seeOnlineDisabled; // [settings_race]
        }
        else if (page.pageRole === PageRole.JoinlessChat) {
          // Then, list the most recent people who posted in the chat?
          // Not impl though.
          title = ''; // "People here recently:"  // I18N, unimplemented
        }
        else {
          const titleText = isChat ? t.cb.UsersInThisChat : t.cb.UsersInThisTopic; // [users_here]
          title = r.div({},
              titleText,
              store.userIdsOnline && r.span({ className: 'esCtxbar_onlineCol' }, t.Online));
          // Don't show num online strangers, when listing post authors for the current topic only.
          numOnlineStrangers = null;
        }
        usersClass = ' active';
        listItems = makeUsersContent(store, usersHere.users, store.me.id, numOnlineStrangers);
        break;
      case 'AdminGuide':
        title = t.cb.GettingStartedGuide;
        adminGuideActiveClass = ' active';
        break;
      default:
        console.error('[DwE4PM091]');
    }

    let tipsGuideOrExtraConfig;
    if (state.commentsType === 'Recent') {
      /* Skip this, I think people won't read it anyway and it makes the page look very
          cluttered and complicated.
      tipsOrExtraConfig =
          r.p({}, 'Find listed below the beginning of every comment, newest comments first. ' +
              'Click a comment to view it in full in the threaded view to the left. ' +
              'A black star means that you have not yet read that comment. Gray means ' +
              'the computer thinks you have read it.');
      */
    }
    if (state.commentsType === 'Starred') {
      tipsGuideOrExtraConfig =
        r.div({},
          r.p({}, t.NotImplemented)); /*
          r.p({}, "You have not bookmarked any comments on this page."),
          r.p({}, 'To bookmark a comment, click the star in its upper left ' +
            "corner, so the star turns blue or yellow. (You can use these two colors in " +
            'any way you want.)'));
            */
    }
    /*
    else if (state.commentsType === 'Unread') {
      var tips = state.showPerhapsUnread
          ? r.p({}, 'Find listed below all comments that you have not marked as ' +
              'read. To mark a comment as read, click anywhere inside it, in the ' +
              "threaded view **to the left**. (Then the star in the comment's " +
              'upper left corner will turn white.)')
          : r.p({}, 'The computer thinks you have not read these comments:');
      tipsOrExtraConfig =
        r.div({},
          r.label({ className: 'checkbox-inline' },
            r.input({ type: 'checkbox', checked: !state.showPerhapsUnread,
                onChange: this.togglePerhapsUnread }),
            'Let the computer try to determine when you have read a comment.'),
          tips);
    }*/
    else if (state.commentsType === 'AdminGuide') {
      tipsGuideOrExtraConfig = state.adminGuide || r.p({}, t.Loading);
    }

    let recentButton;
    let starredButton;
    let unreadButton;
    let adminGuideButton;
    if (commentsFound) {
      if (windowWideEnoughForTabButtons) {
        recentButton = isChat ? null :
            r.button({ className: 'btn btn-default' + recentClass, onClick: this.showRecent },
              t.Recent);
        //unreadButton =
        // r.button({ className: 'btn btn-default' + unreadClass, onClick: this.showUnread },
        //   unreadBtnTitle);
        starredButton =
            r.button({ className: 'btn btn-default' + starredClass, onClick: this.showStarred },
              starredBtnTitle);
      }
      else {
        recentButton = isChat ? null : MenuItem({ onClick: this.showRecent }, t.Recent);
        //unreadButton = MenuItem({ onClick: this.showUnread }, "Unread"),
        starredButton = MenuItem({ onClick: this.showStarred },
          starredBtnTitle);
      }
    }

    if (me.isAdmin) {
      if (windowWideEnoughForTabButtons) {
        adminGuideButton = r.button({ className: 'btn btn-default' + adminGuideActiveClass,
          onClick: this.showAdminGuide }, t.cb.Guide);
      }
      else {
        adminGuideButton = MenuItem({ onClick: this.showAdminGuide }, t.cb.AdminGuide);
      }
    }

    let tabButtons;
    if (windowWideEnoughForTabButtons) {
      tabButtons =
        r.div({},
          recentButton,
          unreadButton,
          starredButton,
          anyUsersBtnTitle && r.button({ className: 'e_CtxBarB btn btn-default' + usersClass,
                onClick: this.showUsers },
              anyUsersBtnTitle),
          adminGuideButton);
    }
    else {
      const title = r.span({}, state.commentsType + ' ', r.span({ className: 'caret' }));
      tabButtons =
        ModalDropdownButton({ title, key: 'showRecent', pullRight: true },
          r.ul({ className: 'dropdown-menu' },
            recentButton,
            unreadButton,
            starredButton,
            anyUsersBtnTitle && MenuItem({ onClick: this.showUsers }, anyUsersBtnTitle),
            adminGuideButton));
    }

    // Show help messages, one at a time, to clarify how the recent comments list works.
    // (Previously there were 4 tips, and people thought that was too many, so skip the
    // first two: helpMessageOne & Two — you can find them out commented below.)
    let helpMessageBoxTree: RElm | U;
    let helpMessageBoxFour: RElm | U;
    let dimCommentsStyle: { opacity: St } | U;
    if (state.commentsType === 'Recent' && listItems.length >= 6) {
      helpMessageBoxTree =
          help.HelpMessageBox({ className: 'es-editor-help-three', message: helpMessageThree,
            showUnhideTips: false });
      if (help.isHelpMessageClosed(store, helpMessageThree)) {
        helpMessageBoxFour =
            help.HelpMessageBox({ className: 'es-editor-help-four', message: helpMessageFour,
              // Don't show, because would cause them to forget what they just read about
              // the recent comments list. This is complicated enough already.
              showUnhideTips: false } as TipsBoxProps);
      }
      // Dim the comments list until all help messages have been closed.
      dimCommentsStyle = help.isHelpMessageClosed(store, helpMessageFour) ?
          null : { opacity: '0.5' };
    }

    const addMorePeopleButton = !page_isGroupTalk(page.pageRole) || !isStaffOrMyPage ? null :
        r.button({ className: 'btn btn-default', onClick: () => {
              morebundle.openAddPeopleDialog({ curPatIds: page.pageMemberIds,
                      onChanges: (res: PatsToAddRemove) => {
                Server.addUsersToPage(res.addPatIds, () => {
                  util.openDefaultStupidDialog({ body: "Now I've added him/her/them. Currently you need " +
                    "to reload the page (hit F5) to see them in the users list." }); // [5FKE0WY2] also in e2e
                });
              }});
            },
            id: 'e2eCB_AddPeopleB' },
          t.cb.AddPeople);

    sidebarClasses += adminGuideActiveClass ? ' esCtxbar-adminGuide' : '';

    return (
      r.div({ className: 'dw-sidebar-z-index' },
      /* Don't do until 2d-bundle.js has been loaded
      r.div({ id: 'dw-minimap-holder', className: 'dw-sidebar-is-open' },
        r.div({ className: 'dw-upper-right-corner' },
          MiniMap(minimapProps))),
          */
      r.div({ id: 'dw-sidebar', className: 'esCtxbar' + sidebarClasses, ref: 'sidebar' },
        r.div({ className: 'esCtxbar_btns', style: dimCommentsStyle  },
          CloseSidebarButton({ onClick: this.closeSidebar }),
          tabButtons),
        r.div({ className: 'dw-comments esCtxbar_list' },
          helpMessageBoxTree,
          helpMessageBoxFour,
          r.div({ style: dimCommentsStyle },
            r.div({ ref: 'commentsScrollable' },
              r.h3({ className: 'esCtxbar_list_title' }, title),
              tipsGuideOrExtraConfig,
              r.div({},
                utils.FadeGrowIn({},
                  listItems)),
              addMorePeopleButton)))),
      util.FadingBackdrop({ ref: 'fadingBackdrop' })));  // [6KEP0W2]
  }
});


function makeCommentsContent(comments: Post[], currentPostNr: PostNr, store: Store, onPostClick) {
  const abbreviateHowMuch = smallWindow ? 'Much' : 'ABit';
  return comments.map((post: Post, index) => {
    const postProps: any = { store };
    postProps.post = post;
    postProps.onClick = (event) => onPostClick(post);
    postProps.abbreviate = abbreviateHowMuch;
    if (post.nr === currentPostNr) {
      postProps.className = 'dw-current-post';
    }
    return (
        r.div({ key: post.nr },
            page.Post(postProps)));
  });
}


function makeUsersContent(store: Store, users: BriefUser[], myId: UserId,
      numOnlineStrangers: Nr | N) {
  // List the current user first, then online users, then others.
  // COULD: list alphabetically, so one can scan and find one's friends by name easily
  users.sort((a, b) => {
    if (a.id === myId) return -1;
    if (b.id === myId) return +1;
    if (store_isUserOnline(store, a.id) === store_isUserOnline(store, b.id)) {
      if (user_isMember(a) === user_isMember(b)) return 0;
      return user_isMember(a) ? -1 : +1;
    }
    return store_isUserOnline(store, a.id) ? -1 : +1;
  });
  let currentUserIsStranger = true;
  const listItems = users.map((user: BriefUser) => {
    const thatsYou = user.id === myId ?
        r.span({ className: 'esPresence_thatsYou' }, ' — ' + t.cb.thatsYou) : null;
    currentUserIsStranger = currentUserIsStranger && user.id !== myId;
    const isUserOnline = store_isUserOnline(store, user.id);

    // Presence feature enabled?
    const presEna: Object | NU = store.userIdsOnline;
    const presenceClass = !presEna ? '' : (isUserOnline ? 'esPresence-active' : 'esPresence-away');
    return (
        r.div({ key: user.id, className: 'esPresence ' + presenceClass,
            onClick: (event: MouseEvent) =>
                morebundle.openAboutUserDialog(user.id, event.target) },
          avatar.AvatarAndName({ user, origins: store, ignoreClicks: true }),
          thatsYou,
          presEna && r.span({ className: 'esPresence_icon',
                          title: isUserOnline ? t.Active : t.Away })));
  });

  if (numOnlineStrangers) {
    const numOtherStrangers = numOnlineStrangers - (currentUserIsStranger ? 1 : 0);
    const plus = listItems.length ? '+ ' : '';
    const youAnd = currentUserIsStranger ? t.cb.YouAnd : '';
    const strangers = numOtherStrangers === 0 && currentUserIsStranger
        ? (listItems.length ? t.you : t.cb.OnlyYou)
        : youAnd + t.cb.NumStrangers(numOtherStrangers);
    listItems.push(
        r.div({ key: 'strngrs', className: 'esPresence esPresence-strangers' }, plus + strangers));
  }

  return listItems;
}


/*
var helpMessageOne = {
  id: 'EsH2QMUW1',
  version: 1,
  content: r.span({}, "This is a list of ", r.b({}, "the most recent comments"), " on this page."),
  okayText: "I understand",
  moreHelpAwaits: true,
};

var helpMessageTwo = {
  id: 'EsH5GPMU2',
  version: 1,
  content: r.span({}, "Don't try to read them here — only the first words are shown."),
  okayText: "I won't",
  moreHelpAwaits: true,
}; */

const helpMessageThree = {
  id: 'EsH7UGY2',
  version: 1,
  content: r.div({ className: 'esCB_Help' },
    r.p({},
      r.span({ className: 'esCB_Help_ArwLeft' }, "➜"),
      t.cb.RepliesToTheLeft, r.b({}, t.cb.bestFirst)),
    r.p({},
      t.cb.ButBelow, r.span({ className: 'esCB_Help_ArwDown' }, "➜"),
      t.cb.insteadBy, r.b({}, t.cb.newestFirst))),
  okayText: t.OkayDots,
  moreHelpAwaits: true,
};

const helpMessageFour = {
  id: 'EsH6GJYu8',
  version: 1,
  content: r.div({ className: 'esCB_Help' },
    r.p({}, t.cb.SoIfLeave,
      r.strong({ className: 'esCB_Help_Large' }, t.cb.allNewReplies)),
    r.p({}, r.strong({ className: 'esCB_Help_Large' }, t.cb.Click),
      t.cb.aReplyToReadIt)),
  okayText: t.Okay + '.',
  moreHelpAwaits: false,
};


function CloseSidebarButton(props) {
  return (
      r.button({ className: 'esCtxbar_close esCloseCross', onClick: props.onClick,
          title: t.cb.CloseShortcutS }));
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
