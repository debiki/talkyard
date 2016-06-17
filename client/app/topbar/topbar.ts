/*
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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
/// <reference path="../page-methods.ts" />
/// <reference path="../login/login-dialog.ts" />
/// <reference path="../page-tools/page-tools.ts" />
/// <reference path="../utils/page-scroll-mixin.ts" />
/// <reference path="../utils/scroll-into-view.ts" />
/// <reference path="../utils/MenuItemLink.ts" />
/// <reference path="../utils/DropdownModal.ts" />
/// <reference path="../utils/utils.ts" />
/// <reference path="../avatar/avatar.ts" />
/// <reference path="../notification/Notification.ts" />
/// <reference path="../../typedefs/keymaster/keymaster.d.ts" />

//------------------------------------------------------------------------------
   module debiki2.reactelements {  // rename to debiki2.topbar
//------------------------------------------------------------------------------

var keymaster: Keymaster = window['keymaster'];
var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var Button = reactCreateFactory(ReactBootstrap.Button);
var DropdownButton = reactCreateFactory(ReactBootstrap.DropdownButton);
var MenuItem = reactCreateFactory(ReactBootstrap.MenuItem);
var MenuItemLink = utils.MenuItemLink;

var FixedTopDist = 8;


export function getTopbarHeightInclShadow(): number {
  return $('.dw-fixed-topbar-wrap').height() + 4; // shadow size (the '+ X') dupl here: [5YKW25]
}


export var TopBar = createComponent({
  mixins: [debiki2.StoreListenerMixin, debiki2.utils.PageScrollMixin],

  getInitialState: function() {
    return {
      store: debiki2.ReactStore.allData(),
      showSearchForm: false,
      fixed: false,
      initialOffsetTop: -1,
      enableGotoTopBtn: false,
      enableGotoEndBtn: true,
    };
  },

  componentWillMount: function() {
    // We call it from render(). (Is that ok?)
    pagetools.getPageToolsDialog();
  },

  componentDidMount: function() {
    var rect = this.getThisRect();
    var pageTop = getPageScrollableRect().top;
    this.setState({
      initialOffsetTop: rect.top - pageTop,
      fixed: rect.top < -FixedTopDist,
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
    var store: Store = this.state.store;
    var pageRect = getPageScrollableRect();
    var pageLeft = pageRect.left;
    if (store.isWatchbarOpen && !store.shallSidebarsOverlayPage) {
      pageLeft -= 230; // dupl value, in css too [7GYK42]
    }
    var pageTop = pageRect.top;
    var newTop = -pageTop - this.state.initialOffsetTop;
    this.setState({ top: newTop, left: -pageLeft });
    if (!this.state.fixed) {
      if (-pageTop > this.state.initialOffsetTop + FixedTopDist || pageLeft < -40) {
        this.setState({ fixed: true });
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
    login.getLoginDialog().openToSignUp(this.props.purpose || 'LoginToLogin');
  },

  onLoginClick: function() {
    login.getLoginDialog().openToLogIn(this.props.purpose || 'LoginToLogin');
  },

  onLogoutClick: function() {
    debiki2.ReactActions.logout();
  },

  showTools: function() {
    pagetools.getPageToolsDialog().open();
  },

  closeSearchForm: function() {
    this.setState({
      showSearchForm: false
    });
  },

  onSearchClick: function() {
    this.setState({
      showSearchForm: !this.state.showSearchForm
    });
  },

  viewOlderNotfs: function() {
    ReactActions.goToUsersNotifications(this.state.store.user.userId);
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

    var ancestorCategories;
    if (nonEmpty(store.ancestorsRootFirst)) {
      var hide = isSection(pageRole) || _.some(store.ancestorsRootFirst, a => a.unlisted);
      ancestorCategories = hide ? null :
        r.ol({ className: 'esTopbar_ancestors' },
          store.ancestorsRootFirst.map((ancestor: Ancestor) => {
            return (
                r.li({ key: ancestor.categoryId },
                  r.a({ className: 'esTopbar_ancestors_link btn', href: ancestor.path },
                    ancestor.title)));
          }));
    }

    // ------- Staff link, notfs, help

    var urgentReviewTasks = makeNotfIcon('reviewUrgent', me.numUrgentReviewTasks);
    var otherReviewTasks = makeNotfIcon('reviewOther', me.numOtherReviewTasks);
    var adminMenuItem = !isStaff(me) ? null :
      MenuItemLink({ href: linkToAdminPage(), className: 'esMyMenu_admin' },
        r.span({ className: 'icon-settings' }, "Admin"));
    var reviewMenuItem = !urgentReviewTasks && !otherReviewTasks ? null :
      MenuItemLink({ href: linkToReviewPage() },
        "Needs review ", urgentReviewTasks, otherReviewTasks);

    var adminHelpLink = !isStaff(me) ? null :
      MenuItemLink({ href: externalLinkToAdminHelp(), target: '_blank',
          className: 'esMyMenu_adminHelp' },
        r.span({}, (me.isAdmin ? "Admin" : "Staff") + " help ",
          r.span({ className: 'icon-link-ext' })));


    // ------- Personal notf icons

    var talkToMeNotfs = makeNotfIcon('toMe', me.numTalkToMeNotfs);
    var talkToOthersNotfs = makeNotfIcon('toOthers', me.numTalkToOthersNotfs);
    var otherNotfs = makeNotfIcon('other', me.numOtherNotfs);
    var anyDivider = me.notifications.length ? MenuItem({ divider: true }) : null;
    var notfsElems = me.notifications.map((notf: Notification) =>
        MenuItemLink({ key: notf.id, href: linkToNotificationSource(notf),
            className: notf.seen ? '' : 'esNotf-unseen' },
          notification.Notification({ notification: notf })));
    if (me.thereAreMoreUnseenNotfs) {
      notfsElems.push(
          MenuItem({ key: 'More', onSelect: this.viewOlderNotfs }, "View more notifications..."));
    }

    // ------- Avatar & username dropdown

    var avatarMenuButtonInclNotfIcons =
        r.span({},
          urgentReviewTasks, otherReviewTasks,
          avatar.Avatar({ user: me, tiny: true, ignoreClicks: true }),
          r.span({ className: 'esAvtrName_name' }, me.username || me.fullName),
          r.span({ className: 'esAvtrName_you' }, "You"), // if screen too narrow
          talkToMeNotfs,
          talkToOthersNotfs,
          otherNotfs);

    var avatarNameDropdown = !me.isLoggedIn ? null :
      utils.ModalDropdownButton({ title: avatarMenuButtonInclNotfIcons,
          className: 'esAvtrName esMyMenu' },
        r.ul({ className: 'dropdown-menu' },
          adminMenuItem,
          adminHelpLink,
          reviewMenuItem,
          (adminMenuItem || reviewMenuItem) ? MenuItem({ divider: true }) : null,
          MenuItemLink({ href: linkToMyProfilePage(store) }, "View/edit your profile"),
          MenuItem({ onSelect: this.onLogoutClick }, "Log out"),
          anyDivider,
          notfsElems,
          MenuItem({ divider: true }),
          MenuItem({ onSelect: ReactActions.showHelpMessagesAgain },
            r.span({ className: 'icon-help' }, "Unhide help messages"))));

    // ------- Login button

    // Don't show Log In on info pages, like a custom HTML homepage or About pages — that
    // has so far only made people confused.
    var hideLogInAndSignUp = me.isLoggedIn || page_isInfoPage(pageRole);

    var signupButton = hideLogInAndSignUp ? null :
      Button({ className: 'dw-login esTopbar_signUp btn-primary', onClick: this.onSignUpClick },
        r.span({}, "Sign Up"));

    var loginButton = hideLogInAndSignUp ? null :
        Button({ className: 'dw-login esTopbar_logIn btn-primary', onClick: this.onLoginClick },
            r.span({ className: 'icon-user' }, 'Log In'));

    // ------- Tools button
    // Placed here so it'll be available also when one has scrolled down a bit.

    // (Is it ok to call another React component from here? I.e. the page tools dialog.)
    var toolsButton = !isStaff(me) || pagetools.getPageToolsDialog().isEmpty() ? null :
        Button({ className: 'dw-a-tools', onClick: this.showTools },
          r.a({ className: 'icon-wrench' }, 'Tools'));

    // ------- Search button

    var searchButton =
        null;
    /* Hide for now, search broken, after I rewrote from dw1_posts to dw2_posts.
     Button({ className: 'dw-search', onClick: this.onSearchClick },
     r.span({ className: 'icon-search' }));
     */

    var searchForm = !this.state.showSearchForm ? null :
        SearchForm({ onClose: this.closeSearchForm });

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
    if (this.props.showBackToSite) {
      backToSiteButton = r.a({ className: 'esTopbar_custom_backToSite btn icon-reply',
          onClick: goBackToSite }, "Back from admin area");
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
        searchForm,
        r.div({ className: 'esTopbar_custom' },
          customTitle,
          backToSiteButton),
        pageTitle,
        ancestorCategories);

    var fixItClass = '';
    var styles = {};
    if (this.state.fixed) {
      fixItClass = ' dw-fixed-topbar-wrap';
      styles = { top: this.state.top, left: this.state.left }
    }
    return (
        r.div({ className: 'esTopbarWrap' + fixItClass, style: styles },
          openWatchbarButton,
          openContextbarButton,
          r.div({ className: 'container' },
            topbar)));
  }
});


function makeNotfIcon(type: string, number: number) {
  if (!number) return null;
  var numMax99 = Math.min(99, number);
  var wideClass = number >= 10 ? ' esNotfIcon-wide' : '';
  return r.div({ className: 'esNotfIcon esNotfIcon-' + type + wideClass}, numMax99);
}


var SearchForm = createComponent({
  componentDidMount: function() {
    keymaster('escape', this.props.onClose);
    $(this.refs.input).focus();
  },

  componentWillUnmount: function() {
    keymaster.unbind('escape', 'all');
  },

  search: function() {
    $(this.refs.xsrfToken).val($['cookie']('XSRF-TOKEN'));
    $(this.refs.form).submit();
  },

  render: function() {
    return (
        r.div({ className: 'dw-lower-right-corner' },
          r.form({ id: 'dw-search-form', ref: 'form', className: 'debiki-search-form form-search',
              method: 'post', acceptCharset: 'UTF-8', action: '/-/search/site',
              onSubmit: this.search },
            r.input({ type: 'hidden', ref: 'xsrfToken', name: 'dw-fi-xsrf' }),
            r.input({ type: 'text', tabIndex: '1', placeholder: 'Text to search for',
                ref: 'input', className: 'input-medium search-query', name: 'searchPhrase' }))));
  }
});

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
