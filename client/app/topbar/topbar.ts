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

/// <reference path="../../typedefs/react/react.d.ts" />
/// <reference path="../ReactStore.ts" />
/// <reference path="../links.ts" />
/// <reference path="../widgets.ts" />
/// <reference path="../page-methods.ts" />
/// <reference path="../utils/page-scroll-mixin.ts" />
/// <reference path="../utils/scroll-into-view.ts" />
/// <reference path="../utils/utils.ts" />
/// <reference path="../avatar/avatar.ts" />
/// <reference path="../more-bundle-not-yet-loaded.ts" />

//------------------------------------------------------------------------------
   module debiki2.reactelements {  // rename to debiki2.topbar
//------------------------------------------------------------------------------

var r = React.DOM;

var FixedTopDist = 8;


export function getTopbarHeightInclShadow(): number {
  return $('.dw-fixed-topbar-wrap').height() + 4; // shadow size (the '+ X') dupl here: [5YKW25]
}


export var TopBar = createComponent({
  displayName: 'TopBar',
  mixins: [debiki2.StoreListenerMixin, debiki2.utils.PageScrollMixin],

  getInitialState: function() {
    return {
      store: debiki2.ReactStore.allData(),
      fixed: false,
      initialOffsetTop: undefined,
      enableGotoTopBtn: false,
      enableGotoEndBtn: true,
    };
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  componentDidMount: function() {
    doNextFrameOrNow(() => {
      // This unfortunately still triggers a FORCED_REFLOW before the first paint. Is there any
      // way to avoid that? Perhaps if window.scrollTop is 0, then we know the topbar should
      // *not* be position = fixed, initially. And can do:
      //    getPageScrollableRect().top - this-rect.top
      // later? — This layout reflow takes about 15 ms (core i7 laptop), that's about 5% of
      // the total time spent scripting & rendering before the first paint.
      if (this.isGone) return;
      var rect = this.getThisRect();
      var pageTop = getPageScrollableRect().top;
      this.setState({
        initialOffsetTop: rect.top - pageTop,
        fixed: rect.top < -FixedTopDist,
      });
    });
  },

  getThisRect: function() {
    return ReactDOM.findDOMNode(this).getBoundingClientRect();
  },

  onChange: function() {
    this.setState({
      store: debiki2.ReactStore.allData()
    });
    // If the watchbar was opened or closed, we need to rerender with new left: offset.
    this.onScroll();
  },

  onScroll: function() {
    if (!_.isNumber(this.state.initialOffsetTop))
      return;

    var store: Store = this.state.store;
    var pageRect = getPageScrollableRect();
    var pageLeft = pageRect.left;
    if (store.isWatchbarOpen && !store.shallSidebarsOverlayPage) {
      pageLeft -= WatchbarWidth;
    }
    var pageTop = pageRect.top;
    var newTop = -pageTop - this.state.initialOffsetTop;
    this.setState({ top: newTop, left: -pageLeft }); // CLEAN_UP `top` not used. What about `left`?
    if (!this.state.fixed) {
      if (-pageTop > this.state.initialOffsetTop + FixedTopDist || pageLeft < -40) {
        var rect = this.getThisRect();
        this.setState({
          fixed: true,
          // Update the height here, not in componentDidMount, because the height might change
          // if the window is made wider/smaller, after mount.
          placeholderHeightPx: rect.height + 'px',
        });
      }
    }
    else if (pageLeft < -20) {
      // We've scrolled fairly much to the right, so stay fixed.
    }
    else {
      // Add +X otherwise sometimes the fixed state won't vanish although back at top of page.
      if (-pageTop < this.state.initialOffsetTop + 5) {
        this.setState({ fixed: false, top: 0, left: 0 });
      }
    }
    var calcCoords = utils.calcScrollIntoViewCoordsInPageColumn;
    this.setState({
      // We cannot scroll above the title anyway, so as long as the upper .dw-page is visible,
      // disable the go-to-page-top button. Also, the upper parts of the page is just whitespace,
      // so ignore it, set marginTop -X.
      enableGotoTopBtn: calcCoords($('.dw-page'), { marginTop: -10, height: 0 }).needsToScroll,
      enableGotoEndBtn: calcCoords($('#dw-the-end')).needsToScroll,
    });
  },

  onSignUpClick: function() {
    morebundle.openLoginDialogToSignUp(this.props.purpose || 'LoginToLogin');
  },

  onLoginClick: function() {
    morebundle.openLoginDialog(this.props.purpose || 'LoginToLogin');
  },

  onLogoutClick: function() {
    debiki2.ReactActions.logout();
  },

  showTools: function() {
    morebundle.openPageToolsDialog();
  },

  openMyMenu: function() {
    morebundle.openMyMenu(this.state.store, this.refs.myMenuButton);
  },

  viewOlderNotfs: function() {
    let store: Store = this.state.store;
    ReactActions.goToUsersNotifications(store.me.id);
  },

  render: function() {
    var store: Store = this.state.store;
    var me: Myself = store.me;
    var pageRole = store.pageRole;
    var isChat = page_isChatChannel(store.pageRole);

    // Don't show all these buttons on a homepage / landing page, until after has scrolled down.
    // If not logged in, never show it — there's no reason for new users to login on the homepage.
    if (pageRole === PageRole.CustomHtmlPage && (!this.state.fixed || !me || !me.isLoggedIn))
      return r.div();

    // Sidebars just make newcomers confused, if shown on some About Us page. However, if logged
    // in already, then one likely knows how they work —> then one would instead be confused,
    // if the open-sidebars buttons were suddenly gone?
    var hideSidebarBtns = page_isInfoPage(pageRole) && !me.isLoggedIn;

    // ------- Forum --> Category --> Sub Category

    let ancestorCategories;
    let shallShowAncestors = settings_showCategories(store.settings, me);
    let thereAreAncestors = nonEmpty(store.ancestorsRootFirst);
    let isUnlisted = _.some(store.ancestorsRootFirst, a => a.unlisted);

    if (isUnlisted || isSection(pageRole)) {
      // Show no ancestors.
    }
    else if (thereAreAncestors && shallShowAncestors) {
      ancestorCategories =
        r.ol({ className: 'esTopbar_ancestors' },
          store.ancestorsRootFirst.map((ancestor: Ancestor) => {
            let deletedClass = ancestor.isDeleted ? ' s_TB_Cs_C-Dd' : '';
            return (
                r.li({ key: ancestor.categoryId, className: 's_TB_Cs_C' + deletedClass },
                  r.a({ className: 'esTopbar_ancestors_link btn', href: ancestor.path },
                    ancestor.title)));
          }));
    }
    // Add a Home link 1) if categories hidden (!shallShowAncestors), and 2) for
    // direct messages, which aren't placed in any category (!thereAreAncestors).
    else if (thereAreAncestors || store.pageRole === PageRole.FormalMessage) {
      // Currently there's always just one site section, namely the forum.
      var homePath = store.siteSections[0].path;
      ancestorCategories =
        r.ol({ className: 'esTopbar_ancestors' },
          r.li({},
            r.a({ className: 'esTopbar_ancestors_link btn', href: homePath }, "Home")));
    }
    else {
      // This isn't a private-message topic, and still it isn't placed in any section,
      // — probably an old page, from before I added all pages to some section.
      // Nowhere to home-link to, so don't show.
    }


    // ------- My Menu (avatar + username dropdown menu)

    var urgentReviewTasks = makeNotfIcon('reviewUrgent', me.numUrgentReviewTasks);
    var otherReviewTasks = makeNotfIcon('reviewOther', me.numOtherReviewTasks);

    var talkToMeNotfs = makeNotfIcon('toMe', me.numTalkToMeNotfs);
    var talkToOthersNotfs = makeNotfIcon('toOthers', me.numTalkToOthersNotfs);
    var otherNotfs = makeNotfIcon('other', me.numOtherNotfs);

    let isImpersonatingClass = '';
    let impersonatingStrangerInfo;
    if (store.isImpersonating) {
      isImpersonatingClass = ' s_MMB-IsImp';
      if (!me.isLoggedIn) {
        isImpersonatingClass += ' s_MMB-IsImp-Stranger';
        impersonatingStrangerInfo = "Viewing as stranger";
        // SECURITY COULD add a logout button, so won't need to first click stop-viewing-as,
        // and then also click Logout. 2 steps = a bit risky, 1 step = simpler, safer.
      }
    }

    let myAvatar = !me.isLoggedIn ? null :
        avatar.Avatar({ user: me, tiny: true, ignoreClicks: true });

    var avatarNameDropdown = !me.isLoggedIn && !impersonatingStrangerInfo ? null :
      Button({ onClick: this.openMyMenu,
          // RENAME 'esAvtrName' + 'esMyMenu' to 's_MMB' (my-menu button).
          className: 'esAvtrName esMyMenu' + isImpersonatingClass,
          ref: 'myMenuButton' },
        urgentReviewTasks,
        otherReviewTasks,
        impersonatingStrangerInfo,
        myAvatar,
        r.span({ className: 'esAvtrName_name' }, me.username || me.fullName), // if screen wide
        r.span({ className: 'esAvtrName_you' }, "You"), // if screen narrow
        talkToMeNotfs,
        talkToOthersNotfs,
        otherNotfs);


    // ------- Login button

    // Don't show Log In on info pages, like a custom HTML homepage or About pages — that
    // has so far only made people confused.
    var hideLogInAndSignUp =
        me.isLoggedIn || page_isInfoPage(pageRole) || impersonatingStrangerInfo;

    var signupButton = hideLogInAndSignUp ? null :
      PrimaryButton({ className: 'dw-login esTopbar_signUp', onClick: this.onSignUpClick },
        r.span({}, "Sign Up"));

    var loginButton = hideLogInAndSignUp ? null :
        PrimaryButton({ className: 'dw-login esTopbar_logIn', onClick: this.onLoginClick },
            r.span({ className: 'icon-user' }, 'Log In'));

    // ------- Tools button
    // Placed here so it'll be available also when one has scrolled down a bit.

    // (Is it ok to call another React component from here? I.e. the page tools dialog.)
    var toolsButton = !isStaff(me) || !store_shallShowPageToolsButton(store) ? null :
        Button({ className: 'dw-a-tools', onClick: this.showTools },
          r.a({ className: 'icon-wrench' }, 'Tools'));

    // ------- Search button

    var searchButton =
       utils.ModalDropdownButton({ title: r.span({ className: 'icon-search' }),
            className: 'esTB_SearchBtn', allowFullWidth: true, closeOnClick: false },
         SearchForm({}));

    // ------- Forum title

    var pageTitle;
    if (pageRole === PageRole.Forum) {
      var titleProps: any = _.clone(store);
      titleProps.hideButtons = this.state.fixed;
      pageTitle =
          r.div({ className: 'dw-topbar-title' }, page.Title(titleProps));
    }

    // ------- Custom title & Back to site button

    var customTitle;
    if (this.props.customTitle) {
      customTitle = r.h1({ className: 'esTopbar_custom_title' }, this.props.customTitle);
    }

    var backToSiteButton;
    if (this.props.showBackToSite || this.props.backToSiteButtonTitle) {
      backToSiteButton = r.a({ className: 'esTopbar_custom_backToSite btn icon-reply',
          onClick: goBackToSite }, this.props.backToSiteButtonTitle || "Back from admin area");
    }

    // ------- Open Contextbar button

    // If server side, don't render any "X online" because that'd make the server side html
    // different from the html React generates client side to verify that the server's
    // html is up-to-date.
    var usersHere = store.userSpecificDataAdded ? store_getUsersHere(store) : null;

    // We'll show "X users online", to encourage people to open and learn about the contextbar.
    // They'll more likely to do that, if they see a message that means "other people here too,
    // check them out".
    var contextbarTipsDetailed;
    var contextbarTipsBrief;
    if (!usersHere) {
      // Server side — skip this. Or own data not yet activated – wait until later.
    }
    else if (usersHere.areTopicContributors) {
      // Don't show any num-users tip for normal forum topics like this, because non-chat
      // discussions happen slowly, perhaps one comment per user per day. Doesn't matter
      // which people are online exactly now. — Instead, when opening the sidebar,
      // we'll show a list of the most recent comments (rather than onlne topic contributors).
      // COULD show click-to-see-recent-comments tips, if the user doesn't seem to know about that.
      // For now, show this dummy text, because otherwise people get confused when the
      // "X users online" text disappears:
      contextbarTipsDetailed = "Recent posts";
      contextbarTipsBrief = r.span({}, '0', r.span({ className: 'icon-comment-empty' }));
    }
    else {
      /* don't:
      var numOthers = usersHere.numOnline - (usersHere.iAmHere ? 1 : 0);
      because then people get confused when inside the contextbar they see: sth like '1 user, you'
      although when collapsed, says '0 users'. So for now: */
      var numOthers = usersHere.numOnline;
      var inThisWhat = usersHere.areChatChannelMembers ? "chat"  : "forum";
      contextbarTipsDetailed = numOthers + " online in this " + inThisWhat;
      contextbarTipsBrief = r.span({}, '' + numOthers, r.span({ className: 'icon-user' }));
    }
    var contextbarTips = !contextbarTipsDetailed ? null :
        r.span({ className: 'esOpenCtxbarBtn_numOnline'},
          r.span({ className: 'detailed' }, contextbarTipsDetailed),
          r.span({ className: 'brief' }, contextbarTipsBrief));

    var openContextbarButton = hideSidebarBtns ? null :
        Button({ className: 'esOpenPagebarBtn', onClick: ReactActions.openPagebar,
            title: contextbarTipsDetailed },
          contextbarTips, r.span({ className: 'icon-left-open' }));

    // ------- Open Watchbar button

    var openWatchbarButton = hideSidebarBtns ? null :
        Button({ className: 'esOpenWatchbarBtn', onClick: ReactActions.openWatchbar,
            title: "Your recent topics, joined chats, direct messages" },
          r.span({ className: 'icon-right-open' }),
          // An eye icon makes sense? because the first list is "Recently *viewed*".
          // And one kind of uses that whole sidebar to *watch* / get-updated-about topics
          // one is interested in.
          // — no, hmm, someone remembers it from Photoshop and view-layers.
          // r.span({ className: 'icon-eye' }));
          /* Old:
          // Let's call it "Activity"? since highlights topics with new posts.
          // (Better give it a label, then easier for people to remember what it does.)
          r.span({ className: 'esOpenWatchbarBtn_text' }, "Activity"));
          */
          r.span({ className: 'esOpenWatchbarBtn_text' }, "Your topics"));


    // ------- The result

    var extraMarginClass = this.props.extraMargin ? ' esTopbar-extraMargin' : '';

    var topbar =
      r.div({ className: 'esTopbar' + extraMarginClass },
        r.div({ className: 'esTopbar_right' },
          signupButton,
          loginButton,
          toolsButton,
          searchButton,
          avatarNameDropdown),
        r.div({ className: 'esTopbar_custom' },
          customTitle,
          backToSiteButton),
        pageTitle,
        ancestorCategories);

    var fixItClass = '';
    var styles = {};
    var placeholderIfFixed;
    if (this.state.fixed) {
      fixItClass = ' dw-fixed-topbar-wrap';
      // (This placeholder is actually totally needed, otherwise in some cases it'd be
      // impossible to scroll down — because when the topbar gets removed from the flow
      // via position:fixed, the page gets shorter, and then sometimes this results in the
      // scrollbars disappearing and scroll-top becoming 0. Then onScroll() above
      // gets called, it changes the topbar to position:static again, the topbar gets reinserted
      // and the bottom of the page gets pushed down again — the effect is that, in this
      // rare case, it's impossible to scroll down (without this placeholder). )
      placeholderIfFixed =
          r.div({ style: { height: this.state.placeholderHeightPx, width: '10px' } });
      // No, use position: fixed instead. CLEAN_UP 2016-10: remove `styles` + this.state.top & left
      //styles = { top: this.state.top, left: this.state.left }
    }
    return (
      r.div({},
        placeholderIfFixed,
        r.div({ className: 'esTopbarWrap' + fixItClass, style: styles },
          openWatchbarButton,
          openContextbarButton,
          r.div({ className: 'container' },
            topbar))));
  }
});


function makeNotfIcon(type: string, number: number) {
  if (!number) return null;
  var numMax99 = Math.min(99, number);
  var wideClass = number >= 10 ? ' esNotfIcon-wide' : '';
  return r.div({ className: 'esNotfIcon esNotfIcon-' + type + wideClass}, numMax99);
}


// COULD move SearchForm to more-bundle, so won't need to access via ['search']
// (needs to do that currently, because not available server side)
//
var SearchForm = createComponent({
  displayName: 'SearchForm',

  getInitialState: function() {
    return { queryInputText: '' };
  },

  componentDidMount: function() {
    $(this.refs.input).focus();
  },

  onQueryChange: function(event) {
    this.setState({ queryInputText: event.target.value });
  },

  render: function() {
    let urlEncodedQuery = debiki2['search'].urlEncodeSearchQuery(this.state.queryInputText);
    let searchEndpoint    = '/-/search';
    let searchUrl         = '/-/search?q=' + urlEncodedQuery;
    let searchUrlAdvanced = '/-/search?advanced=true&q=' + urlEncodedQuery;
    return (
        r.form({ className: 'esTB_SearchD', ref: 'form',
            method: 'get', acceptCharset: 'UTF-8', action: searchEndpoint },
          r.input({ type: 'text', tabIndex: '1', placeholder: "Text to search for",
              ref: 'input', name: 'q',
              value: this.state.queryInputText, onChange: this.onQueryChange }),
          PrimaryLinkButton({ href: searchUrl, className: 'e_SearchB' }, "Search"),
          r.div({},
            r.a({ className: 'esTB_SearchD_AdvL', href: searchUrlAdvanced },
              "Advanced search"))));
  }
});

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
