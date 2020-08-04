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

/// <reference path="../ReactStore.ts" />
/// <reference path="../ReactActions.ts" />
/// <reference path="../links.ts" />
/// <reference path="../widgets.ts" />
/// <reference path="../page-methods.ts" />
/// <reference path="../utils/page-scroll-mixin.ts" />
/// <reference path="../utils/scroll-into-view.ts" />
/// <reference path="../utils/utils.ts" />
/// <reference path="../utils/DropdownModal.ts" />
/// <reference path="../avatar/avatar.ts" />
/// <reference path="../login/login-if-needed.ts" />
/// <reference path="../Server.ts" />
/// <reference path="../more-bundle-not-yet-loaded.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.topbar {
//------------------------------------------------------------------------------

const FixedTopDist = 8;


export function getTopbarHeightInclShadow(): number {
  const topbarElem = $first('.s_Tb-Fxd');
  return !topbarElem ? 0 :
      topbarElem.offsetHeight + 4; // shadow size (the '+ X') dupl here: [5YKW25]
}


export const TopBar = createComponent({
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
      const rect = this.getThisRect();
      const pageTop = getPageScrollableRect().top;
      this.setState({
        initialOffsetTop: rect.top - pageTop,
        fixed: rect.top < -FixedTopDist,
      });
    });
  },

  getThisRect: function() {
    return (<HTMLElement> ReactDOM.findDOMNode(this)).getBoundingClientRect();
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

    const store: Store = this.state.store;
    const pageRect = getPageScrollableRect();
    let pageLeft = pageRect.left;
    if (store.isWatchbarOpen && !store.shallSidebarsOverlayPage) {
      pageLeft -= WatchbarWidth;
    }
    const pageTop = pageRect.top;
    const newTop = -pageTop - this.state.initialOffsetTop;
    this.setState({ top: newTop, left: -pageLeft }); // CLEAN_UP `top` not used. What about `left`?
    if (!this.state.fixed) {
      if (-pageTop > this.state.initialOffsetTop + FixedTopDist || pageLeft < -40) {
        const rect = this.getThisRect();
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
    const calcCoords = utils.calcScrollIntoViewCoordsInPageColumn;
    this.setState({
      // We cannot scroll above the title anyway, so as long as the upper .dw-page is visible,
      // disable the go-to-page-top button. Also, the upper parts of the page is just whitespace,
      // so ignore it, set marginTop -X.
      enableGotoTopBtn: calcCoords('.dw-page', { marginTop: -10, height: 0 }).needsToScroll,
      enableGotoEndBtn: calcCoords('#dw-the-end').needsToScroll,
    });
  },

  onSignUpClick: function() {
    login.openLoginDialogToSignUp(this.props.purpose || 'LoginToLogin');
  },

  onLoginClick: function() {
    login.openLoginDialog(this.props.purpose || 'LoginToLogin');
  },

  showTools: function() {
    morebundle.openPageToolsDialog();
  },

  render: function() {
    const store: Store = this.state.store;
    const page: Page = store.currentPage;
    const me: Myself = store.me;
    const pageRole = page.pageRole;
    const isChat = page_isChat(page.pageRole);
    const isEmbComments = pageRole === PageRole.EmbeddedComments;
    const isBitDown = this.state.fixed;
    const navConf: BrowserCode = store.settings.navConf || {};

    // Don't show all these buttons on a homepage / landing page, until after has scrolled down.
    // If not logged in, never show it — there's no reason for new users to login on the homepage.
    if (pageRole === PageRole.CustomHtmlPage && (!this.state.fixed || !me || !me.isLoggedIn))
      return r.div();

    const autoPageType = location_autoPageType(this.props.location);


    // Sidebars just make newcomers confused, if shown on some About Us page. However, if logged
    // in already, then one likely knows how they work —> then one would instead be confused,
    // if the open-sidebars buttons were suddenly gone?
    const hideSidebarBtns = page_isInfoPage(pageRole) && !me.isLoggedIn;

    // ------- Forum --> Category --> Sub Category

    let ancestorCategories;
    const shallShowAncestors = settings_showCategories(store.settings, me);
    const thereAreAncestors = nonEmpty(page.ancestorsRootFirst);
    const isUnlisted = _.some(page.ancestorsRootFirst, a => a.unlistCategory);

    if ((isUnlisted || isSection(pageRole)) && !isEmbComments) {
      // Show no ancestors.
    }
    else if (thereAreAncestors && shallShowAncestors) {
      ancestorCategories =
        r.ol({ className: 'esTopbar_ancestors' },
          page.ancestorsRootFirst.map((ancestor: Ancestor) => {
            const deletedClass = ancestor.isDeleted ? ' s_TB_Cs_C-Dd' : '';
            const categoryIcon = category_iconClass(ancestor.categoryId, store);  // [4JKKQS20]
            return (
                r.li({ key: ancestor.categoryId, className: 's_TB_Cs_C' + deletedClass },
                  Link({ className: categoryIcon + 'esTopbar_ancestors_link btn', to: ancestor.path },
                    ancestor.title)));
          }));
    }
    // Add a Home link 1) if categories hidden (!shallShowAncestors), and 2) for
    // direct messages, which aren't placed in any category (!thereAreAncestors),
    // and 3) for embedded comments, if categories disabled, so can still return to
    // discussion list page.
    else if (thereAreAncestors || page.pageRole === PageRole.FormalMessage ||
        page.pageRole === PageRole.PrivateChat || isEmbComments) {
      const mainSiteSection: SiteSection = store_mainSiteSection(store);
      const homePath = mainSiteSection.path;
      ancestorCategories =
        r.ol({ className: 'esTopbar_ancestors' },
          r.li({},
            Link({ className: 'esTopbar_ancestors_link btn', to: homePath }, t.Home)));
    }
    else {
      // This isn't a private-message topic, and still it isn't placed in any section,
      // — probably an old page, from before I added all pages to some section.
      // Nowhere to home-link to, so don't show.
    }


    // ------- My Menu (avatar + username dropdown menu)

    const urgentReviewTasks = makeNotfIcon('reviewUrgent', me.numUrgentReviewTasks);
    const otherReviewTasks = makeNotfIcon('reviewOther', me.numOtherReviewTasks);

    const talkToMeNotfs = makeNotfIcon('toMe', me.numTalkToMeNotfs);
    const talkToOthersNotfs = makeNotfIcon('toOthers', me.numTalkToOthersNotfs);
    const otherNotfs = makeNotfIcon('other', me.numOtherNotfs);

    let isImpersonatingClass = '';
    let impersonatingStrangerInfo;
    if (store.isImpersonating) {
      isImpersonatingClass = ' s_MMB-IsImp';
      if (!me.isLoggedIn) {
        isImpersonatingClass += ' s_MMB-IsImp-Stranger';
        impersonatingStrangerInfo = "Viewing as stranger"; // (skip i18n, is for staff)
        // SECURITY COULD add a logout button, so won't need to first click stop-viewing-as,
        // and then also click Logout. 2 steps = a bit risky, 1 step = simpler, safer.
      }
    }

    const myAvatar = !me.isLoggedIn ? null :
        avatar.Avatar({ user: me, origins: store, ignoreClicks: true });

    let snoozeLeftMs = pp_snoozeLeftMs(me);
    if (snoozeLeftMs > 50 * 60 * 1000) {
      // Almost an hour — then, exact time isn't important. Add 9 mins, so X hours
      // won't seem to change to X - 1 hours after a millisecond.
      snoozeLeftMs += 9 * 60 * 1000;
    }

    // Show num days, if within a month. Otherwse, exact date.
    const snoozeUntilTxt = snoozeLeftMs && (
        snoozeLeftMs < 1000 * 3600 * 24 * 31
            ? debiki.prettyLetterDuration(snoozeLeftMs)
            : prettyMonthDayYear(getNowMs() + snoozeLeftMs, true));

    const snoozeIcon = !!snoozeUntilTxt &&
        r.span({ className: 's_MMB_Snz' },
          r.img({ alt: "Snoozing", className: 's_SnzI',   // I18N
              src: '/-/media/sysuicons/bell_snooze.svg' }),
          snoozeUntilTxt);

    const avatarNameDropdown = !me.isLoggedIn && !impersonatingStrangerInfo ? null :
      utils.ModalDropdownButton({
          // RENAME 'esMyMenu' to 's_MMB' (my-menu button).
          className: 'esAvtrName esMyMenu s_MMB' + isImpersonatingClass,  // CLEAN_UP RENAME to s_MMB
          dialogClassName: 's_MM',
          ref: 'myMenuButton',
          showCloseButton: true,
          bottomCloseButton: true,
          // MyMenu might list many notifications, and people Command-Click to open
          // them in new browser tabs, or Shift-Click to open in new windows — then,
          // they want MyMenu to stay open so they can continue Command-Click
          // opening notifications.
          stayOpenOnCmdShiftClick: true,
          title: rFragment({},
            urgentReviewTasks,
            otherReviewTasks,
            impersonatingStrangerInfo,
            myAvatar,
            // RENAME classes below to: s_MMB_Un (username) and s_MMB_You
            // If screen wide:
            r.span({ className: 'esAvtrName_name' }, me.username || me.fullName),
            // If screen narrow:
            r.span({ className: 'esAvtrName_you' }, t.You),
            talkToMeNotfs,
            talkToOthersNotfs,
            otherNotfs,
            snoozeIcon) },
        MyMenuContentComponent({ store }));


    // ------- Login button

    // Don't show Log In on info pages, like a custom HTML homepage or About pages — that
    // has so far only made people confused.
    const hideLogInAndSignUp = me.isLoggedIn || page_isInfoPage(pageRole) || impersonatingStrangerInfo;
    const hideSignup = store.settings.allowSignup === false;

    const signupButton = hideLogInAndSignUp || hideSignup ? null :
      PrimaryButton({ className: 'dw-login esTopbar_signUp', onClick: this.onSignUpClick },
        r.span({}, t.SignUp));

    const loginButton = hideLogInAndSignUp ? null :
        PrimaryButton({ className: 'dw-login esTopbar_logIn', onClick: this.onLoginClick },
            r.span({ className: 'icon-user' }, t.LogIn));

    // ------- Tools button
    // Placed here so it'll be available also when one has scrolled down a bit.

    // (Is it ok to call another React component from here? I.e. the page tools dialog.)
    const toolsButton = !isStaff(me) || !store_shallShowPageToolsButton(store) ? null :
        Button({ className: 'dw-a-tools', onClick: this.showTools },
          r.a({ className: 'icon-wrench' }, t.Tools));

    // ------- Search button

    const searchButton =
       utils.ModalDropdownButton({ title: r.span({ className: 'icon-search' }),
            className: 'esTB_SearchBtn', allowFullWidth: true, closeOnClick: false,
          render: SearchForm });

    // ------- Forum title

    const siteLogoHtml =
        isBitDown && navConf.topbarBitDownLogo || navConf.topbarAtTopLogo;

    const siteLogoTitle = siteLogoHtml &&
        // No custom code in the admin area — bad if it breaks.
        autoPageType !== AutoPageType.AdminArea &&
        r.div({
            className: 's_Tb_CuLogo s_Cu',
            dangerouslySetInnerHTML: { __html: siteLogoHtml }});

    let pageTitle;
    if (!siteLogoTitle && pageRole === PageRole.Forum && !autoPageType) {
      pageTitle =
          r.div({ className: 'dw-topbar-title' },
            debiki2.page.Title({ store, hideButtons: this.state.fixed }));
    }

    // ------- Custom title & Back to site button

    // CLEAN_UP remove the props? Use if(path.search..) also for the admin area?
    let extraMargin = this.props.extraMargin;
    let customTitle = this.props.customTitle;
    let backToSiteButton = this.props.backToSiteButtonTitle;

    const backToGroups = autoPageType !== AutoPageType.GroupProfilePage ? null :
            LinkUnstyled({ to: GroupsRoot,
                className: 's_Tb_Ln s_Tb_Ln-Grps btn icon-reply' },
              t.mm.ViewGroups);

    if (autoPageType_isProfile(autoPageType)) {
      backToSiteButton = t.tb.BackFromUsr;
      /*
      const isAllGroupsPage = autoPageType === AutoPageType.AllGroupsPage;
      const isOneGroup = autoPageType === AutoPageType.GroupProfilePage;
      customTitle = isAllGroupsPage
            ? t.GroupsC
            : (isOneGroup ? LinkUnstyled({ to: GroupsRoot }, t.GroupsC)
                          : t.tb.AbtUsr);
      */
    }
    else if (autoPageType === AutoPageType.SearchPage) {
      customTitle = t.tb.SearchPg;
      backToSiteButton = t.Back;
    }

    if (siteLogoTitle) {
      // Show only siteLogoTitle, i.e. custom site logo & title.
      customTitle = undefined;
    }
    else if (customTitle) {
      customTitle = r.h1({ className: 'esTopbar_custom_title' }, customTitle);
    }

    // @ifdef DEBUG
    // Either we're on a page with a title, or we're in some API section.
    dieIf(pageTitle && customTitle, 'TyE06RKTD6');
    // @endif

    if (this.props.showBackToSite || backToSiteButton) {
      backToSiteButton = LinkUnstyled({ className: 's_Tb_Ln s_Tb_Ln-Bck btn icon-reply',
          href: linkBackToSite() }, backToSiteButton || t.tb.BackFromAdm);
      extraMargin = true;
    }

    // ------- Custom navigation

    const custLinksHtml = isBitDown && navConf.topbarBitDownNav || navConf.topbarAtTopNav;
    const customNavLinks = custLinksHtml &&
        r.div({
            className: 's_Tb_CuLns s_Cu',
            dangerouslySetInnerHTML: { __html: custLinksHtml }});

    // ------- Buttons and search field

    const searchAndButtons =
        r.div({ className: 'esTopbar_right' },
          searchButton,  // later:  show input field so can just start typing
          signupButton,
          loginButton,
          toolsButton,
          avatarNameDropdown);

    // ------- Open Contextbar button

    // If server side, don't render any "X online" because that'd make the server side html
    // different from the html React generates client side to verify that the server's
    // html is up-to-date.
    const usersHere = store.userSpecificDataAdded ? store_getUsersHere(store) : null;

    // We'll show "X users online", to encourage people to open and learn about the contextbar.
    // They'll more likely to do that, if they see a message that means "other people here too,
    // check them out".
    let contextbarTipsDetailed;
    let contextbarTipsBrief;
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
      contextbarTipsDetailed = t.tb.RecentPosts;
      contextbarTipsBrief = r.span({}, '0', r.span({ className: 'icon-comment-empty' }));
    }
    else {
      /* don't:
      var numOthers = usersHere.numOnline - (usersHere.iAmHere ? 1 : 0);
      because then people get confused when inside the contextbar they see: sth like '1 user, you'
      although when collapsed, says '0 users'. So for now: */
      const numOthers = usersHere.numOnline;
      const isChat = usersHere.areChatChannelMembers;
      contextbarTipsDetailed = numOthers + (isChat ? t.tb.NumOnlChat : t.tb.NumOnlForum);
      contextbarTipsBrief = r.span({}, '' + numOthers, r.span({ className: 'icon-user' }));
    }
    const contextbarTips = !contextbarTipsDetailed ? null :
        r.span({ className: 'esOpenCtxbarBtn_numOnline'},
          r.span({ className: 'detailed' }, contextbarTipsDetailed),
          r.span({ className: 'brief' }, contextbarTipsBrief));

    const openContextbarButton = hideSidebarBtns ? null :
        Button({ className: 'esOpenPagebarBtn', onClick: ReactActions.openPagebar,
            title: contextbarTipsDetailed },
          contextbarTips, r.span({ className: 'icon-left-open' }));

    // ------- Open Watchbar button

    const openWatchbarButton = hideSidebarBtns ? null :
        Button({ className: 'esOpenWatchbarBtn', onClick: ReactActions.openWatchbar,
            title: t.tb.WatchbToolt },
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
          r.span({ className: 'esOpenWatchbarBtn_text' }, t.tb.WatchbBtn));

    // ------- Admin tips

    const showAdminTips = page.pageRole === PageRole.Forum && me.isAdmin &&
        store.settings.enableForum !== false;

    const adminGettingStartedTips = !showAdminTips ? null :
        r.div({ className: 's_AdmTps container' },
          help.HelpMessageBox({ message: <HelpMessage> {
            id: '94ktj',
            version: 1,
            content: rFragment({},
              r.i({}, "Admin to do: "),
              "Configure ", r.a({ href: linkToAdminPage() }, "settings")),
          }}),
          help.HelpMessageBox({ message: <HelpMessage> {
            id: '40ehw',
            version: 1,
            content: rFragment({},
              "Create ",
              r.a({ href: linkToGroups() }, "groups"), '?'),
          }}),
          help.HelpMessageBox({ message: <HelpMessage> {
            id: '25fwk6',
            version: 1,
            content: rFragment({},
              r.a({ href: linkToStaffInvitePage() }, "Invite people")),
          }}));


    // ------- The result

    const extraMarginClass = extraMargin ? ' esTopbar-extraMargin' : '';

    const anyMaintWorkMessage = !eds.mainWorkUntilSecs || isServerSide() ? null :
        r.div({ className: 's_MaintWorkM' },
          r.b({}, "Under maintenance"),
          ", everything is read-only." ); /* + (
            eds.mainWorkUntilSecs === 1 ? '' : (
              " Time left: " +
              Math.max(0, Math.ceil((eds.mainWorkUntilSecs * 1000 - Date.now()) / 3600/1000)) + " hours")));
              */

    const topbarRow1 =
      r.div({ className: 'esTopbar' + extraMarginClass },
        siteLogoTitle,
        r.div({ className: 'esTopbar_custom' },
          customTitle,
          // UX REFACTOR break out to its own widget, incl a retry-timeout countdown?
          r.div({ className: 's_NoInetM' }, t.ni.NoInet), //  [NOINETMSG]
          // "Will retry in X seconds"  I18N  seconds for live notfs retry, not reading progr
          anyMaintWorkMessage,
          backToGroups,
          backToSiteButton),
        pageTitle,
        customNavLinks,
        ancestorCategories,
        searchAndButtons);

    const topbarRow2 = navConf.topbarAtTopNavLine2 &&
        r.div({
            className: 's_Tb_CuLns2 s_Cu',
            dangerouslySetInnerHTML: { __html: navConf.topbarAtTopNavLine2 }});

    let fixItClass = '';
    let placeholderIfFixed;
    if (this.state.fixed) {
      fixItClass = ' dw-fixed-topbar-wrap s_Tb-Fxd';  // RENAME to s_Tb-Fxd
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

    return rFragment({},
      r.div({},
        placeholderIfFixed,
        r.div({ className: 'esTopbarWrap s_Tb' + fixItClass },  // RENAME to s_Tb, no Wrap
          r.div({ className: 's_Tb_Row1' },
            openWatchbarButton,
            openContextbarButton,
            r.div({ className: 'container' }, topbarRow1)),
          // Sometimes nice with a 2nd row, for nav links, if on mobile.
          // Instead of hamburger menu (which "hides" the nav links).
          topbarRow2 &&
            r.div({ className: 's_Tb_Row2' },
              r.div({ className: 'container' }, topbarRow2)))),
      adminGettingStartedTips);
  }
});


const MyMenuContentComponent = createFactory({   // dupl code [4WKBTP0]
  displayName: 'MyMenuContentComponent',

  componentDidMount: function() {
    Server.loadMoreScriptsBundle(() => {
      if (this.isGone) return;
      this.setState({ moreScriptsLoaded: true });
    });
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  render: function() {
    if (!this.state)
      return r.p({}, t.Loading);

    // Lazy loaded.
    return debiki2.topbar['MyMenuContent']({ store: this.props.store });
  }
});


function makeNotfIcon(type: string, number: number) {
  if (!number) return null;
  const numMax99 = Math.min(99, number);
  const wideClass = number >= 10 ? ' esNotfIcon-wide' : '';
  return r.div({ className: 'esNotfIcon esNotfIcon-' + type + wideClass}, numMax99);
}


// COULD move SearchForm to more-bundle, so won't need to access via ['search']
// (needs to do that currently, because not available server side)
//
const SearchForm = createComponent({
  displayName: 'SearchForm',

  getInitialState: function() {
    return { queryInputText: '' };
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  componentDidMount: function() {
    // Focus the search text input.
    // This won't work — I think focus() gets invoked without 'input' as 'this'
    // causing a "Illegal invocation" error:
    //   setTimeout(this.refs.input.focus, 900);
    // This works:
    this.refs.input.focus();
    // Let's try again soon, in case the above didn't work when fading in:
    setTimeout(() => {
      if (this.isGone) return;
      this.refs.input.focus();
    }, 150);
  },

  onQueryChange: function(event) {
    this.setState({ queryInputText: event.target.value });
  },

  render: function() {
    const urlEncodedQuery = debiki2['search'].urlEncodeSearchQuery(this.state.queryInputText);
    const searchEndpoint    = '/-/search';
    const searchUrl         = '/-/search?q=' + urlEncodedQuery;
    const searchUrlAdvanced = '/-/search?advanced=true&q=' + urlEncodedQuery;
    const afterClick = this.props.closeDropdown;
    return (
        r.form({ className: 'esTB_SearchD', ref: 'form',
            method: 'get', acceptCharset: 'UTF-8', action: searchEndpoint },
          (<any> r.input)({ type: 'text', tabIndex: '1', placeholder: t.s.TxtToFind,  // [TYPEERROR]
              ref: 'input', name: 'q',
              value: this.state.queryInputText, onChange: this.onQueryChange }),
          PrimaryLinkButton({ href: searchUrl, className: 'e_SearchB', afterClick }, t.Search),
          r.div({},
            r.a({ className: 'esTB_SearchD_AdvL', href: searchUrlAdvanced },
              t.AdvSearch))));
  }
});

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
