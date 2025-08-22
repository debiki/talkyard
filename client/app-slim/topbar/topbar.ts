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

/// <reference path="../../macros/macros.d.ts" />
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
/// <reference path="../help/serverAnnouncements.ts" />
/// <reference path="../login/login-if-needed.ts" />
/// <reference path="../page/cats-or-home-link.ts" />
/// <reference path="../Server.ts" />
/// <reference path="../more-bundle-not-yet-loaded.ts" />
/// <reference path="../personas/PersonaIndicator.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.topbar {
//------------------------------------------------------------------------------

const FixedTopDist = 8;

// Shadow size (the '+ X') dupl here: [topb_shdw], 6px + 9px diffusion ~= 10px?
// No, skip this — otherwise, when switching from static to fixed, the page
// would jump downwards with this amount.
const TopbarShadow = 0;  // 10;


export function getTopbarHeightInclShadow(): Nr {
  const topbarElem = $first('.s_Tb');
  return !topbarElem ? 0 : topbarElem.offsetHeight + TopbarShadow;
}


interface TopbarProps {
  purpose?: LoginReason;
  location: { pathname: string };
  extraMargin?: Bo;
  customTitle?: St;
  backToSiteButtonTitle?: St;
  showBackToSite?: Bo;
}


interface TopbarState {
  store: Store;
  fixed: Bo;
  initialOffsetTop?: Nr;
  // The browser window minus the topicbar and contextbar.
  pageWidth: Nr;
  // If the username is wide, there's less space for buttons and custom
  // nav links, in the topbar.
  curName: St;
  nameWidth: Nr;
  placeholderHeightPx?: St;
}


export const TopBar = createComponent({
  displayName: 'TopBar',
  mixins: [debiki2.StoreListenerMixin, debiki2.utils.PageScrollMixin],

  getInitialState: function() {
    const store = debiki2.ReactStore.allData();
    const state: TopbarState = {
      store,
      fixed: false,
      curName: '',  //  not logged in, when rendering server side
      nameWidth: 0, //
      pageWidth: store_getApproxPageWidth(store),
    };
    return state;
  },

  componentWillUnmount: function() {
    this.isGone = true;
    clearInterval(this.timerHandle);
  },

  componentDidMount: function() {
    doNextFrameOrNow(() => {
      // This unfortunately still triggers a FORCED_REFLOW before the first paint. Is there any
      // way to avoid that? Perhaps if window.scrollTop is 0, then we know the topbar should
      // *not* be position = fixed, initially. And can do:
      //    getPageScrollableRect().top - this-rect.top
      // later? — This layout reflow takes about 15 ms (core i7 laptop), that's about 5% of
      // the total time spent scripting and rendering before the first paint.
      if (this.isGone) return;
      const rect = this.getThisRect();
      const pageTop = getPageScrollableRect().top;
      this.setState({
        initialOffsetTop: rect.top - pageTop,
        fixed: rect.top < -FixedTopDist,
      });
    });
    // Dupl code [5KFEWR7]  — maybe move to inside doNextFrameOrNow()?
    this.timerHandle = setInterval(this.checkSizeChangeLayout, 500);
  },

  checkSizeChangeLayout: function() {
    // Dupl code [5KFEWR7]  — now no longer dupl, now this is different (& better?)
    if (this.isGone) return;
    const state: TopbarState = this.state;
    const store = state.store;
    const pageWidthNow = store_getApproxPageWidth(store);
    const oldWidth = state.pageWidth;

    // Don't rerender unless 1) the page width changed in a noticeable way,
    // say, > 30 px, and > 10%.
    const signedWidthChange = pageWidthNow - oldWidth;
    const absChange = Math.abs(signedWidthChange);
    const changedALot = absChange > 30 && (absChange / Math.max(oldWidth, 1)) > 0.1;

    // Or 2) if there's a custom navigation menu, on two rows, in narrow layout,
    // and now the window got wider (or narrower) so should switch from two to
    // one row layout (or from one to two) — that is, if the available topbar
    // width crossed the navConf.tb1Rw breakpoint.
    const navConf: BrowserCode = store.settings.navConf || {};
    const justOneRowBefore = !navConf.tb1Rw || navConf.tb1Rw <= oldWidth;
    const justOneRowAfter = !navConf.tb1Rw || navConf.tb1Rw <= pageWidthNow;
    const numRowsChanged = justOneRowBefore !== justOneRowAfter;

    // Or 3) if we logged in / out: then, a username dis/appeared, changing
    // how much space is left for buttons and custom nav links, so
    // we might need to change the layout from one to two rows.
    const curName = store.me?.username || '';
    const nameChanged = curName !== state.curName;
    let nameWidth = state.nameWidth;
    if (nameChanged) {
      // We only do if name actually changed — can otherwise trigger layout reflow?
      // UX COULD:  subtr width of  .s_Tb_MyBs  instead?
      // And, not only if name changed — but if notf icons dis/appeared.
      let nameElem = $first('.esAvtrName_name');
      let width: Nr | U = nameElem?.getBoundingClientRect()?.width;
      if (!width) {
        // Look in row 2 — name shown there, if 2 rows layout.
        nameElem = $first('.s_Tb-Rw2 .esAvtrName_name');
        width = nameElem?.getBoundingClientRect()?.width || 0;
      }
      nameWidth = width;
    }

    if (changedALot || numRowsChanged || nameChanged) {
      const newState: Partial<TopbarState> = {
        pageWidth: pageWidthNow,
        curName,
        nameWidth,
      };

      // If more/fewer rows, and fixed layout, need to resize the placeholder, so the
      // topbar won't occlude the page if scrolling almost all the way up.
      // But wait for a moment, so the browser is done rerendering and we can get
      // the new topbar size.
      if (numRowsChanged && state.fixed) {
        setTimeout(() => {
          if (this.isGone) return;
          const placeholderHeightPx = getTopbarHeightInclShadow();
          this.setState({ placeholderHeightPx });
        }, 1);
      }

      this.setState(newState);
    }
  },

  getThisRect: function() {
    return (<HTMLElement> ReactDOM.findDOMNode(this)).getBoundingClientRect();
  },

  onChange: function() {
    this.setState({
      store: debiki2.ReactStore.allData()
    } as TopbarState);
    // If the watchbar was opened or closed, we need to rerender with new left: offset.
    this.onScroll();
  },

  onScroll: function() {
    const state: TopbarState = this.state;
    if (!_.isNumber(state.initialOffsetTop))
      return;

    const store: Store = state.store;
    const pageRect = getPageScrollableRect();
    let pageLeft = pageRect.left;
    if (store.isWatchbarOpen && !store.shallSidebarsOverlayPage) {
      pageLeft -= WatchbarWidth;
    }
    const pageTop = pageRect.top;
    const newTop = -pageTop - state.initialOffsetTop;
    this.setState({ top: newTop, left: -pageLeft }); // CLEAN_UP `top` not used. What about `left`?
    if (!state.fixed) {
      if (-pageTop > state.initialOffsetTop + FixedTopDist || pageLeft < -40) {
        const rect = this.getThisRect();
        this.setState({
          fixed: true,
          // Update the height here, not in componentDidMount, because the height might change
          // if the window is made wider/smaller, after mount.
          placeholderHeightPx: (rect.height + TopbarShadow) + 'px',
        } as TopbarState);
      }
    }
    else if (pageLeft < -20) {
      // We've scrolled fairly much to the right, so stay fixed.  [2D_LAYOUT]
    }
    else {
      // Add +X otherwise sometimes the fixed state won't vanish although back at top of page.
      if (-pageTop < state.initialOffsetTop + 5) {
        this.setState({ fixed: false, top: 0, left: 0 });
      }
    }
  },

  onSignUpClick: function() {
    const props: TopbarProps = this.props;
    login.loginIfNeededReturnToAnchor(props.purpose || LoginReason.SignUp, '');
  },

  onLoginClick: function() {
    const props: TopbarProps = this.props;
    login.loginIfNeededReturnToAnchor(props.purpose || LoginReason.LoginToLogin, '');
  },

  showTools: function() {
    morebundle.openPageToolsDialog();
  },

  render: function() {
    const props: TopbarProps = this.props;
    const state: TopbarState = this.state;
    const store: Store = state.store;
    const page: Page = store.currentPage;
    const me: Myself = store.me;
    const pageRole = page.pageRole;
    const isEmbComments = pageRole === PageRole.EmbeddedComments;
    const isSectionPage = isSection(pageRole);
    const isBitDown = state.fixed;
    const availableWidth = Math.max(state.pageWidth - state.nameWidth, 0);
    const navConf: BrowserCode = store.settings.navConf || {};

    // [wide_topbar_min_px]
    const justOneRow = !navConf.tb1Rw || navConf.tb1Rw <= availableWidth;

    // Don't show all these buttons on a homepage / landing page, until after has scrolled down.
    // If not logged in, never show it — there's no reason for new users to login on the homepage.
    if (pageRole === PageRole.CustomHtmlPage && (!state.fixed || !me || !me.isLoggedIn))
      return r.div();

    const autoPageType = location_autoPageType(props.location);

    // No custom navigation or menus, when in the admin area
    // — bad if a bug breaks the admin area.
    const skipCustomCode = autoPageType === AutoPageType.AdminArea;


    // Sidebars just make newcomers confused, if shown on some About Us page. However, if logged
    // in already, then one likely knows how they work —> then one would instead be confused,
    // if the open-sidebars buttons were suddenly gone?
    const hideSidebarBtns = page_isInfoPage(pageRole) && !me.isLoggedIn;

    // ------- Page title and categories

    // When we've scrolled down, so the in-page title (rather than in-topbar page title)
    // and category breadcrumbs are no longer visible (they've scrolled up and away),
    // we show the page title in the topbar. And categories too, unless topic unlisted.
    // (So pat sees what topic the page is about, if leaves and returns "much later".)

    let CatsAndTitle = () => null;

    let noCatsMaybeTitle = false;

    // Before we've scrolled down, the title and categories are visible
    // in the page contents instead.
    const catsOrHomeLink: Ay | Nl = !isBitDown ? false :
            debiki2.page.CatsOrHomeLink({ page, store, forTopbar: true });

    const anyUnsafeTitleSource: St | U = page.postsByNr[TitleNr]?.unsafeSource;
    const showTitle = isBitDown && anyUnsafeTitleSource;

    if (catsOrHomeLink || showTitle) {
      // The title, if clicked, shows the Change Page dialog, since when we've scrolled down
      // on a page, the in-page title isn't visible any longer (especially if it's a long chat)
      // but it's still nice to have access to the Change dialog.
      // For chat pages, the Change dialog also shows the chat purpose — the orig post (with
      // the purpose text) is typically is far, far away, at the beginning of the chat history.

      // But if it's not a chat, and we're not the author or a mod, then, there'd be
      // nothing in the Change dialog, so don't show it.
      // But how do we know if it *would* be empty, if opened? The correct approach might be
      // to break out a fn from  ChangePageDialog  that (depending on a param) either
      // creates the dialog content, or just returns true iff there's sth to render,
      // and call that fn from here. [empty_change_page_dlg]  But for now:
      const isOwnPage = store_thisIsMyPage(store);
      const isChat = page_isChat(page.pageRole);
      // Sometimes, should show dialog, if is core member. Oh well, the *important* thing
      // is to always show, if is a *chat* (so can see the chat purpose).
      const showDiagOnClick = isOwnPage || isStaff(me) || isChat;

      const className = 's_Tb_Pg_Ttl';
      const anyTitle = !showTitle ? null : (
          !showDiagOnClick
            ? r.div({ className }, anyUnsafeTitleSource)  // [title_plain_txt]
            : Button({ className,
                onClick: (event: MouseEvent) => {
                  const rect = cloneEventTargetRect(event);
                  morebundle.openChangePageDialog(rect, { page, showViewAnswerButton: true });
                }},
                anyUnsafeTitleSource, r.span({ className: 'caret' })));  // [title_plain_txt]


      noCatsMaybeTitle = isSectionPage;
      CatsAndTitle = () =>
          r.div({ className: 's_Tb_Pg' },
            catsOrHomeLink,
            anyTitle);
    }


    // ------- My Menu (avatar + username dropdown menu)

    const urgentReviewTasks = makeNotfIcon('reviewUrgent', me.numUrgentReviewTasks);
    const otherReviewTasks = makeNotfIcon('reviewOther', me.numOtherReviewTasks);

    const talkToMeNotfs = makeNotfIcon('toMe', me.numTalkToMeNotfs);
    const talkToOthersNotfs = makeNotfIcon('toOthers', me.numTalkToOthersNotfs);
    const otherNotfs = makeNotfIcon('other', me.numOtherNotfs);

    let isImpersonatingClass = '';
    let impersonatingStrangerInfo: St | U;
    if (store.isImpersonating) {
      isImpersonatingClass = ' s_MMB-IsImp';
      if (!me.isLoggedIn) {
        isImpersonatingClass += ' s_MMB-IsImp-Stranger';
        impersonatingStrangerInfo = "Viewing as stranger"; // (0I18N, is for staff)
        // SECURITY COULD add a logout button, so won't need to first click stop-viewing-as,
        // and then also click Logout. 2 steps = a bit risky, 1 step = simpler, safer.
      }
    }


    // ------- Alias info

    // Shows if we're anonymous or have switched to any pseudonym.

    const aliasInfo: RElm | N = !store.userSpecificDataAdded ? null :
            personas.PersonaIndicator({ store, isSectionPage });

    // @ifdef DEBUG
    // COULD_OPTIMIZE: This actually happens —  we're rerendering at least once too much?
    //dieIf(me.usePersona && !aliasInfo, 'TyE60WMJLS256');
    // @endif

    // ------- Username  (click opens: ../../app-more/topbar/my-menu.more.ts)

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
              src: eds.cdnOrServerOrigin + '/-/media/sysuicons/bell_snooze.svg' }),
          snoozeUntilTxt);

    const avatarNameDropdown = !me.isLoggedIn && !impersonatingStrangerInfo ? null :
      utils.ModalDropdownButton({
          // RENAME 'esMyMenu' to 'c_MMB' (my-menu button).
          className: 'esAvtrName esMyMenu s_MMB' +  // CLEAN_UP RENAME to c_MMB
                       isImpersonatingClass +
                       (me.usePersona ? ' n_AliOn' : ''),
          dialogClassName: 's_MM',
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
            // If screen narrow:  [narrow]
            r.span({ className: 'esAvtrName_you' }, t.You),
            talkToMeNotfs,
            talkToOthersNotfs,
            otherNotfs,
            snoozeIcon,
            ) },
        MyMenuContentComponent({ store }));


    // ------- Login button

    // Don't show Log In on info pages, like a custom HTML homepage or About pages — that
    // has so far only made people confused.
    const hideLogInAndSignUp = me.isLoggedIn || page_isInfoPage(pageRole) || impersonatingStrangerInfo;
    const hideSignup = store.settings.allowSignup === false;

    const SignupButton = () => hideLogInAndSignUp || hideSignup ? null :
      PrimaryButton({ className: 'dw-login esTopbar_signUp', onClick: this.onSignUpClick },
        r.span({}, t.SignUp));

    const LoginButton = () => hideLogInAndSignUp ? null :
        PrimaryButton({ className: 'dw-login esTopbar_logIn', onClick: this.onLoginClick },
            r.span({ className: 'icon-user' }, t.LogIn));


    // ------- Tools button
    // Placed in the topbar, so available also when one has scrolled down a bit.

    // (Is it ok to call another React component from here? I.e. the page tools dialog.)
    const toolsButton = !isStaff(me) || !store_shallShowPageToolsButton(store) ? null :
        Button({ className: 'dw-a-tools', onClick: this.showTools },
          r.a({ className: 'icon-wrench' },
              r.span({ className: 's_Ttl' }, t.Tools)));


    // ------- Search button

    const searchButton =
       utils.ModalDropdownButton({ title: r.span({ className: 'icon-search' }),
            className: 'esTB_SearchBtn', allowFullWidth: true, closeOnClick: false,
          render: SearchForm });


    // ------- Custom site logo

    const siteLogoHtml =
        isBitDown && navConf.topbarBitDownLogo || navConf.topbarAtTopLogo;

    const siteLogoTitle = !skipCustomCode && siteLogoHtml &&
        r.div({
            className: 's_Tb_CuLogo s_Cu',
            dangerouslySetInnerHTML: { __html: siteLogoHtml }});


    // ------- Custom title & Back to site button

    // CLEAN_UP remove the props? Use if(path.search..) also for the admin area?
    let extraMargin = props.extraMargin;
    let customTitle: St | U | RElm = props.customTitle;
    let backToSiteButton = props.backToSiteButtonTitle;

    // [back_btn]
    const backToGroups = autoPageType !== AutoPageType.GroupProfilePage ? null :
            LinkUnstyled({ to: GroupsRoot,
                className: 's_Tb_Ln s_Tb_Ln-Grps btn icon-reply' },
              t.mm.ViewGroups);
    const backToTags = autoPageType !== AutoPageType.AboutOneTag ? null :
            LinkUnstyled({ to: UrlPaths.Tags,
                // RENAME  s_Tb_Ln-Grps  to ..Ln-Bck2Ls (back to list)?
                className: 's_Tb_Ln s_Tb_Ln-Grps btn icon-reply' },
              "View tags");  // I18N  [back_btn]


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
    else if (autoPageType === AutoPageType.TagsList) {
      // This is better: customTitle = "All tags"
      // However, doesn't make sense when looking at a single tag — currently
      // no easy way to get its name into the topbar?  [title_in_topbar]
      // See just below....
      backToSiteButton = t.Back;
    }
    else if (autoPageType === AutoPageType.AboutOneTag) {
      // ...Would be nice to show the tag title here, but we don't know what the
      // title is.  [title_in_topbar]
      // customTitle = "About tag: [Tag Name]"
      backToSiteButton = "Back to discussion"; // I18N
    }

    if (siteLogoTitle) {
      // Show only siteLogoTitle, i.e. custom site logo & title.
      customTitle = undefined;
    }
    else if (customTitle) {
      customTitle = r.h1({ className: 'esTopbar_custom_title' }, customTitle);
    }

    if (props.showBackToSite || backToSiteButton) {
      // [back_btn]
      // UX: Depending on to where this link links, change the title? So it
      // is e.g. "Back to tags list" (e.g. back from the Admin Area, to tags),
      // or "Back to discussion" if links back to a discussion page,
      // or "Back to topic list" etc?
      backToSiteButton = LinkUnstyled({ className: 's_Tb_Ln s_Tb_Ln-Bck btn icon-reply',
          href: linkBackToSite() }, backToSiteButton || t.tb.BackFromAdm);
      extraMargin = true;
    }


    // ------- Custom navigation

    const custNavRow1Html = !skipCustomCode && (
            isBitDown && navConf.topbarBitDownNav || navConf.topbarAtTopNav);

    const custNavRow1 = custNavRow1Html &&
        r.div({
            className: 's_Tb_CuNv s_Tb_CuNav s_Cu', // RENAME CLEAN_UP CuNav —> CuNv
            dangerouslySetInnerHTML: { __html: custNavRow1Html }});

    // If we've scrolled down, use the ...BitDown... config, if present.
    // Otherwise use the ...AtTop... config, if present.
    // If ...NavLine2 configured, use it. Otherwise, if ...Nav2Rows == true,
    // use ...TopNav.
    const custNavRow2Html = !skipCustomCode && !justOneRow && (  // (justOneRow || topbarAlw2Rows)
            isBitDown && (
                  navConf.topbarBitDownNavLine2 ||
                  navConf.topbarBitDownNav2Rows && navConf.topbarBitDownNav)
            || (navConf.topbarAtTopNavLine2 ||
                  navConf.topbarAtTopNav2Rows && navConf.topbarAtTopNav));

    const custNavRow2 = !!custNavRow2Html &&
        r.div({
            className: 's_Tb_CuNv s_Tb_CuNav s_Cu',
            dangerouslySetInnerHTML: { __html: custNavRow2Html }});


    // ------- Search field and own buttons

    const use2Rows = !skipCustomCode && !justOneRow && (
            custNavRow2 || navConf.topbarBitDownTitleRow2);
            //  && (justOneRow || topbarAlw2Rows)  ?

    const searchAndMyButtonsRow1 =
        r.div({ className: 's_Tb_MyBs' },
          searchButton,  // later:  show input field so can just start typing
          SignupButton(),
          LoginButton(),
          // We don't know when CSS hides or shows the 2nd row, so better to
          // include always.
          toolsButton,
          avatarNameDropdown,
          aliasInfo && r.span({ className: 'c_Tb_AliAw' }, "→ "),
          aliasInfo);
          // No:
          //(!use2Rows || justOneRow) && toolsButton,
          //(!use2Rows || justOneRow) && avatarNameDropdown);

    const topbarRow2 = use2Rows &&
        rFragment({},
          navConf.topbarBitDownTitleRow2 && CatsAndTitle(),
          custNavRow2,
          r.div({ className: 's_Tb_MyBs' },
            // Signup and login buttons needed here, or Reactjs hydration fails.
            // Include in both row 1 and 2.
            SignupButton(),
            LoginButton(),
            // These buttons won't mess up hydration — they are not rendered server side.
            // Include in only one of row 1 and 2.
            toolsButton,
            avatarNameDropdown));
            // No:
            //!justOneRow && toolsButton,
            //!justOneRow && avatarNameDropdown));


    // ------- Open Contextbar button

    // If server side, don't render any "X online" because that'd make the server side html
    // different from the html React generates client side to verify that the server's
    // html is up-to-date.
    const usersHere = store.userSpecificDataAdded ? store_getUsersHere(store) : null;

    // We'll show "X users online", to encourage people to open and learn about the contextbar.
    // They'll more likely to do that, if they see a message that means "other people here too,
    // check them out".
    let contextbarTipsDetailed: St | U;
    let contextbarTipsBrief: RElm | U;

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
      // Old: '0' — why did I include '0' (zero)? It was a placeholder for the
      // number-of-comments? Let's skip, the icon can be enough for now.
      contextbarTipsBrief = r.span({}, r.span({ className: 'icon-comment-empty' }));
    }
    else if (!store.userIdsOnline) {
      // Presence disabled, we don't know how many are online. Just for now:
      contextbarTipsBrief = r.span({}, r.span({ className: 'icon-comment-empty' }));
    }
    else {
      /* don't:
      var numOthers = usersHere.numOnline - (usersHere.iAmHere ? 1 : 0);
      because then people get confused when inside the contextbar they see: sth like '1 user, you'
      although when collapsed, says '0 users'. So for now: */
      const numOthers: Nr = usersHere.numOnline;
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

    const openWatchbarButton = hideSidebarBtns ? null : OpenWatchbarButton();


    // ------- Admin tips

    // HACK? CLEAN_UP MOVE to ...   forum.ts of course   === PageRole.Forum on next line.
    const showAdminTips = page.pageRole === PageRole.Forum && me.isAdmin &&
        store.settings.enableForum !== false;

    const adminGettingStartedTips = !showAdminTips ? null :
        r.div({ className: 's_AdmTps container' },
          help.HelpMessageBox({ message: <HelpMessage> {
            id: '94ktj',
            version: 1,
            content: rFr({},
              r.i({}, "Admin to do: "),
              "Configure ", LinkUnstyled({ to: linkToAdminPage() }, "settings")),
          }}),
          help.HelpMessageBox({ message: <HelpMessage> {
            id: '40ehw',
            version: 1,
            content: rFr({},
              "Create ",
              LinkUnstyled({ to: linkToGroups(),
                      // Can't create groups from inside an iframe, so open in new tab
                      // if is in iframe, by making the link "external".
                      ext: eds.isInEmbeddedCommentsIframe || eds.isInEmbForum },
                  "groups"), '?'),
          }}),
          help.HelpMessageBox({ message: <HelpMessage> {
            id: '25fwk6',
            version: 1,
            content: rFr({},
              LinkUnstyled({ to: linkToStaffInvitePage() }, "Invite people")),
          }}));


    // ------- Under Maintenance message

    // There's [another_maint_msg] in a server announcement box at the top of the pages,
    // where more details can be shown. This topbar maint work message becomes visible
    // only if you scroll down, and it should be brief, to fit in the topbar.
    const anyMaintWorkMessage = debiki2.help.anyMaintMsg({ brief: true });

    // ------- The result

    const extraMarginClass = extraMargin ? ' esTopbar-extraMargin' : '';

    const topbarRow1 =
      r.div({ className: 'esTopbar' + extraMarginClass },  // REMOVE esTopbar divs
        siteLogoTitle,
        r.div({ className: 'esTopbar_custom' },
          customTitle,
          // UX REFACTOR break out to its own widget, incl a retry-timeout countdown?
          // And place in the middle, *after* CatsAndTitle? [maint_msg_in_middle]
          // ----------------------
          r.div({ className: 's_NoInetM' }, t.ni.NoInet), //  [NOINETMSG]
          // "Will retry in X seconds"  I18N  seconds for live notfs retry, not reading progr
          // No, it's better if instead the server sends a msg when maint work done?
          anyMaintWorkMessage,
          // ----------------------
          backToGroups,
          backToTags,
          backToSiteButton),
        // Incl also if custNavRow2 defined — otherwise React's hydration won't work.
        custNavRow1,
        CatsAndTitle(),
        searchAndMyButtonsRow1);

    let fixItClass = ' s_Tb-Stc';  // static
    let placeholderIfFixed;
    if (state.fixed) {
      fixItClass = ' dw-fixed-topbar-wrap s_Tb-Fxd';  // RENAME to s_Tb-Fxd
      // (This placeholder is actually totally needed, otherwise in some cases it'd be
      // impossible to scroll down — because when the topbar gets removed from the flow
      // via position:fixed, the page gets shorter, and then sometimes this results in the
      // scrollbars disappearing and scroll-top becoming 0. Then onScroll() above
      // gets called, it changes the topbar to position:static again, the topbar gets reinserted
      // and the bottom of the page gets pushed down again — the effect is that, in this
      // rare case, it's impossible to scroll down (without this placeholder). )
      placeholderIfFixed =
          r.div({ style: { height: state.placeholderHeightPx, width: '10px' } });
      // No, use position: fixed instead. CLEAN_UP 2016-10: remove `styles` + this.state.top & left
      //styles = { top: this.state.top, left: this.state.left }
    }

    // Just so can style via `s_TbW + .other-class ...`
    const topbarWrapClases = 's_TbW ' + (state.fixed ? 's_TbW-Fxd' : 's_TbW-Stc');

    const topbarClases =
            fixItClass +
            (showTitle ? ' s_Tb-Ttl' : '') +
            (noCatsMaybeTitle ? ' s_Tb-NoCs' : '') +
            (!noCatsMaybeTitle ? ' s_Tb-Cs' : '') +
            (use2Rows ? ' s_Tb-2Rws s_Tb-2Rows' : ' s_Tb-1Rw') +  // CLEAN_UP RENAME 2Rows to 2Rws
            (navConf.topbarBitDownTitleRow2 ? ' s_Tb-TlRw2' : '') +
            (custNavRow2 ? ' s_Tb-CuNvRw2 s_Tb-CuNavRow2' : '') +
            // s_Tb-LtSm means "less than small", -LtLg means "less than large".
            // s_Tb-Sm means "width greater or equal to small screens",
            // a mobile-first breakpoints mindset, like Tailwind CSS.
            (navConf.tbSm && availableWidth < navConf.tbSm  ? ' s_Tb-LtSm' : '') +
            (navConf.tbSm && navConf.tbSm <= availableWidth ? ' s_Tb-Sm'   : '') +
            (navConf.tbMd && availableWidth < navConf.tbMd  ? ' s_Tb-LtMd' : '') +
            (navConf.tbMd && navConf.tbMd <= availableWidth ? ' s_Tb-Md'   : '') +
            (navConf.tbLg && availableWidth < navConf.tbLg  ? ' s_Tb-LtLg' : '') +
            (navConf.tbLg && navConf.tbLg <= availableWidth ? ' s_Tb-Lg'   : '') +
            (navConf.tbXl && availableWidth < navConf.tbXl  ? ' s_Tb-LtXl' : '') +
            (navConf.tbXl && navConf.tbXl <= availableWidth ? ' s_Tb-Xl'   : '');

    return rFragment({},
      r.div({ className: topbarWrapClases },
        placeholderIfFixed,
        r.div({ className: 'esTopbarWrap s_Tb' + topbarClases },  // RENAME to s_Tb, no Wrap
          r.div({ className: 's_Tb_Rw1 s_Tb_Row1' },
            openWatchbarButton,
            openContextbarButton,
            r.div({ className: 'container' },
              topbarRow1)),
          // Sometimes nice with a 2nd row, for nav links, if on mobile.
          // Instead of hamburger menu (which "hides" the nav links).
          use2Rows &&
            r.div({ className: 's_Tb_Rw2 s_Tb_Row2' },
              r.div({ className: 'container' },
                r.div({ className: 'esTopbar' + extraMarginClass },  // REMOVE esTopbar divs
                      // However!  >= 1 site  use it for styling colors.
                      // So, first add basic theming functionality. Then, have people
                      // change colors via themes.  *Then* remove .esTopbar. [themes]
                  topbarRow2))))),
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
  // Dupl code [M396ARTD]
  if (!number) return null;
  const numMax99 = Math.min(99, number);
  const wideClass = number >= 10 ? ' esNotfIcon-wide' : '';
  return r.div({ className: 'esNotfIcon esNotfIcon-' + type + wideClass}, numMax99);
}


// COULD move SearchForm to more-bundle, so won't need to access via ['search']
// (needs to do that currently, because not available server side)
//
// MOVE to widgets.s?
export const SearchForm = createComponent({
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
    // Oops! But forces the browser to recalculate styles and layout, takes 6ms. [FORCED_REFLOW]
    // this.refs.input.focus();
    // So let's do only from setTimeout:
    // (also good to try later anyway, in case doing directly didn't work when fading in)
    setTimeout(() => {
      if (this.isGone) return;
      this.refs.input.focus();
    }, 150);
  },

  onQueryChange: function(event) {
    this.setState({ queryInputText: event.target.value });
  },

  render: function() {
    const urlEncodedQuery   = urlEncodeSearchQuery(this.state.queryInputText);
    const searchEndpoint    = '/-/search';
    const searchUrl         = '/-/search?q=' + urlEncodedQuery;
    const searchUrlAdvanced = '/-/search?advanced=true&q=' + urlEncodedQuery;
    const afterClick = this.props.closeDropdown;
    return (
        r.form({ className: 'c_SchD', ref: 'form',
            // [emb_forum_nav_bug]  Enter submits the <form>, which triggers a page
            // reload — tiny bit slower, and annoying, if embedded forum.
            method: 'get', acceptCharset: 'UTF-8', action: searchEndpoint },
          r.div({ className: 'c_SchD_QnB' },  // QnB = query field and button
            r.input({ type: 'text', tabIndex: '1',
                placeholder: t.s.SearchForHelp || t.s.TxtToFind,  // I18N
                ref: 'input', name: 'q',
                value: this.state.queryInputText, onChange: this.onQueryChange }),
            PrimaryLinkButton({ href: searchUrl, tabIndex: '2',
                className: 'e_SchB', afterClick },
              t.Search)),
          r.div({ className: 'c_SchD_X' },
            // UX: These should activate on Space, not just Enter? [sch_b_space]
            LinkUnstyled({ className: 'c_SchD_X_B', href: searchUrl, target: '_blank',
                  tabIndex: '3', ext: true, rel: 'noopener noreferrer' }, "Search in new tab"),  // I18N
            LinkUnstyled({ className: 'c_SchD_X_B', href: searchUrlAdvanced,
                  tabIndex: '4' }, t.AdvSearch))));
  }
});


export function OpenWatchbarButton() {
  return Button({ className: 'esOpenWatchbarBtn', onClick: ReactActions.openWatchbar,
      title: t.tb.WatchbToolt },
    r.span({ className: 'icon-right-open' }),

    // Button title:
    // 1) An eye icon makes sense? because the first list is "Recently *viewed*".
    // And one kind of uses that whole sidebar to *watch* / get-updated-about topics
    // one is interested in.
    // — no, hmm, someone remembers it from Photoshop and view-layers.
    // Don't:  r.span({ className: 'icon-eye' }));
    // 2) Let's call it "Activity"? since highlights topics with new posts.
    // (Better give it a label, then easier for people to remember what it does.)
    // r.span({ className: 'esOpenWatchbarBtn_text' }, "Activity"));
    // No, most topics listed won't have any recent activity.
    // 3) "Your topics"? Since shows topics one has viewed, or created, or chats
    // one has joined. But, "Your topics" is too long, on tablets, mobile.
    // Then, just: "Topics".
    // 4) Maybe always ues just "Topics" instead. Looks better, and, the topics
    // usually aren't "owned" by oneself anyway.  [open_wb_btn_ttl]
    //
    r.span({ className: 'esOpenWatchbarBtn_text' },
      t.Topics));  // could:  justOneRow ? t.tb.WatchbBtn : t.Topics
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
