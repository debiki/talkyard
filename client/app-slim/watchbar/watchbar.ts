/*
 * Copyright (c) 2015-2018 Kaj Magnus Lindberg
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
/// <reference path="../help/help.ts" />
/// <reference path="../store-getters.ts" />
/// <reference path="../utils/DropdownModal.ts" />
/// <reference path="../sidebar/sidebar.ts" />
/// <reference path="../login/login-if-needed.ts" />
/// <reference path="../editor-bundle-not-yet-loaded.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.watchbar {
//------------------------------------------------------------------------------

const keymaster: Keymaster = window['keymaster'];
const r = ReactDOMFactories;
const ModalDropdownButton = utils.ModalDropdownButton;

let watchbar;

export function createWatchbar() {
  const elem = document.getElementById('esWatchbarColumn');
  if (watchbar || !elem) return;
  watchbar = ReactDOM.render(Watchbar(), elem);
}


export const Watchbar = createComponent({
  displayName: 'Watchbar',

  mixins: [debiki2.StoreListenerMixin],

  getInitialState: function() {
    const store = debiki2.ReactStore.allData();
    return {
      store: store,
    };
  },

  onChange: function() {
    this.setState({ store: debiki2.ReactStore.allData(), });
  },

  componentDidMount: function() {
    keymaster('w', this.toggleWatchbarOpen);
  },

  componentWillUnmount: function() {
    keymaster.unbind('w', 'all');
  },

  toggleWatchbarOpen: function() {
    ReactActions.toggleWatchbarOpen();
  },

  render: function() {
    const store: Store = this.state.store;
    const settings: SettingsVisibleClientSide = store.settings;
    const me = store.me;

    const communities = SubCommunities({ store });
    const recentTopicsAndNotfs = RecentTopicsAndNotfs({ store });
    const chatChannels = settings.enableChat !== false ? ChatChannels({ store }) : null;
    const directMessages =
        me.isLoggedIn && settings.enableDirectMessages !== false ?
          DirectMessages({ store }) : null;

    return (
      r.div({ className: 'esWB', ref: 'watchbar' },
        r.button({ className: 'esWB_CloseB esCloseCross', onClick: ReactActions.closeWatchbar }),
        communities,
        recentTopicsAndNotfs,
        chatChannels,
        directMessages));
  }
});


const SubCommunities = createComponent({
  displayName: 'SubCommunities',

  render: function() {
    const store: Store = this.props.store;
    const watchbar: Watchbar = store.me.watchbar;
    const settings: SettingsVisibleClientSide = store.settings;
    const showSubCommunities = settings.showSubCommunities;

    // If sub communities disabled, there's just one single main community.
    // Show a "Home" link, to it.
    if (!showSubCommunities) {
      const forumWrongTitle: WatchbarTopic = watchbar[WatchbarSection.SubCommunities][0];
      if (!forumWrongTitle)
        return null;
      const forum = { ...forumWrongTitle, title: t.Home };
      return (
          r.ul({},
            SingleTopic({ store, topic: forum, flavor: 'Home',
              isCurrent: forum.pageId === store.currentPageId, homeIcon: true })));
    }

    const subCommunities: WatchbarTopic[] = watchbar[WatchbarSection.SubCommunities];
    const subCommunitiesElems = [];

    const subCommunitiesSorted = cloneAndSort(subCommunities);

    _.each(subCommunitiesSorted, (topic: WatchbarTopic) => {
      subCommunitiesElems.push(
        SingleTopic({ key: topic.pageId, store: store, topic: topic, flavor: 'SubCom',
            isCurrent: topic.pageId === store.currentPageId }));
    });

    const header = r.h3({}, "Communities");  // skip "sub" here

    // Show add-more-communities button, if hasn't joined all communities yet — or if is
    // admin, because can then create more communities.
    const numCommunitiesJoined = subCommunitiesSorted.length;
    const numCommunitiesTotal = store_numSubCommunities(store);
    const me: Myself = store.me;
    const newCommunityButton = !me.isAdmin && numCommunitiesJoined >= numCommunitiesTotal ? null :
      r.li({ className: 'esWB_LI esWB_T-SubCommunities' },
        r.a({ className: 'esWB_T_Link', onClick: () => morebundle.joinOrCreateSubCommunity(store) },
          r.span({ className: 's_WB_AddSubComB_Plus' }, '+'),
          r.span({ className: 's_WB_AddSubComB_Title esWB_T_Title' }, t.wb.AddCommunity)));

    return (
      r.div({ className: 'esWB_Ts' },
        header,
        r.ul({},
          subCommunitiesElems,
          newCommunityButton)));
  }
});


const RecentTopicsAndNotfs = createComponent({
  displayName: 'RecentTopicsAndNotfs',

  render: function() {
    const store: Store = this.props.store;
    const watchbar: Watchbar = store.me.watchbar;
    const recentTopics: WatchbarTopic[] = watchbar[WatchbarSection.RecentTopics];
    const chatChannels: WatchbarTopic[] = watchbar[WatchbarSection.ChatChannels];
    const directMessages: WatchbarTopic[] = watchbar[WatchbarSection.DirectMessages];
    const topicElems = [];
    const recentTopicsSorted = cloneAndSort(recentTopics);

    _.each(recentTopicsSorted, (topic: WatchbarTopic) => {
      // If the topic is listed in the Chat Channels or Direct Messages section, skip it
      // here in the recent-topics list.
      if (_.some(chatChannels, c => c.pageId === topic.pageId)) return;
      if (_.some(directMessages, m => m.pageId === topic.pageId)) return;
      topicElems.push(
        SingleTopic({ key: topic.pageId, store: store, topic: topic, flavor: 'recent',
            isCurrent: topic.pageId === store.currentPageId }));
    });

    return (
        r.div({ className: 'esWB_Ts' },
          r.h3({ style: { wordSpacing: '2px' }}, t.wb.RecentlyViewed),
          r.ul({},
            topicElems)));
  }
});


const ChatChannels = createComponent({
  displayName: 'ChatChannels',

  componentWillUnmount: function() {
    this.isGone = true;
  },

  createChatChannel: function() {
    login.loginIfNeeded(LoginReason.LoginToChat, location.toString(), () => {
      if (this.isGone) return;
      Server.listCategoriesAllSections((categories: Category[]) => {
        if (this.isGone) return;
        const store: Store = this.props.store;
        // Maybe we're not in any site section, so could show a pick-category dialog first. [4GWRQA28]
        // HACK works fine now, don't want to rerender anything so updating in place = doesn't matter.
        store.allCategoriesHacky = categories;
        const category = store_getCurrOrDefaultCat(store);
        dieIf(!category, 'EsE4KPE02');
        // COULD let pat choose between joinless, and join-first, chat types? [JoinlessChat]
        editor.editNewForumPage(category.id, PageRole.OpenChat);
      });
    });
  },

  render: function() {
    const store: Store = this.props.store;
    const topics: WatchbarTopic[] = store.me.watchbar[WatchbarSection.ChatChannels];
    let topicElems;
    if (_.isEmpty(topics)) {
      topicElems = NoTopics({}, t.wb.NoChats);
    }
    else {
      topicElems = topics.map((topic: WatchbarTopic) =>
          SingleTopic({ key: topic.pageId, store: store, topic: topic, flavor: 'chat',
              isCurrent: topic.pageId === store.currentPageId }));
    }
    const title = store.me.isLoggedIn ? t.wb.JoinedChats : t.wb.ChatChannels;
    return (
      r.div({ className: 'esWB_Ts' },
        r.button({ className: 'esWB_CreateB', id: 'e2eCreateChatB',
            onClick: this.createChatChannel, title: t.wb.CreateChat }, '+'),
        r.h3({}, title),
        r.ul({},
          topicElems)));
  }
});


const DirectMessages = createComponent({
  displayName: 'DirectMessages',

  render: function() {
    const store: Store = this.props.store;
    const topics: WatchbarTopic[] = store.me.watchbar[WatchbarSection.DirectMessages];
    let topicElems;
    if (_.isEmpty(topics)) {
      topicElems = NoTopics({}, t.wb.NoDirMsgs);
    }
    else {
      topicElems = topics.map((topic: WatchbarTopic) =>
          SingleTopic({ key: topic.pageId, store: store, topic: topic, flavor: 'direct',
            isCurrent: topic.pageId === store.currentPageId }));
    }
    return (
      r.div({ className: 'esWB_Ts' },
        r.h3({}, t.wb.DirectMsgs),
        r.ul({},
          topicElems)));
  }
});


const SingleTopic = createComponent({
  displayName: 'SingleTopic',

  UNSAFE_componentWillMount: function() {
    const topic: WatchbarTopic = this.props.topic;
    this._url = linkToPageId(topic.pageId);
  },

  // If this topic is clicked, when it's the current topic already, then open the dropdown.
  onListItemClick: function(event) {
    if (!this.props.isCurrent)
      return;
    event.preventDefault();
    this.refs.actionsDropdown.openDropdown();
  },

  editChatTitleAndPurpose: function() {   // RENAME to editChatPurpose only
    editor.openToEditChatTitleAndPurpose();
  },

  viewChatMembers: function() {
    // This is a bit weird: interacting with the contextbar in two different ways. Oh well.
    // Which approach is best? Perhaps wait until after [redux] rewrite.
    ReactActions.setPagebarOpen(true);  // way 1
    sidebar.contextBar.showUsers();     // way 2
    this.refs.actionsDropdown.hideBackdrop();
    sidebar.contextBar.highligtDuringMillis(700);
  },

  openLeavePageDialog: function() {
    // For now: (Later, ask: Really? Why? No.)
    // If the current page is a forum = sub community, then this'll move the forum from the
    // sub communities section, to the recent section, and if clicking & viewing it again,
    // it won't be auto-joined just because of that. [5JKW20Z]
    Server.leavePage();
  },

  openJoinPageDialog: function() {
    Server.joinPage();
  },

  render: function() {
    const store: Store = this.props.store;
    const settings: SettingsVisibleClientSide = store.settings;
    const showSubCommunities = settings.showSubCommunities;
    const me: Myself = store.me;
    const topic: WatchbarTopic = this.props.topic;
    const flavor: string = this.props.flavor;
    const isSubCommunity = flavor === 'SubCom';
    const isChat = flavor === 'chat';
    const isRecent = flavor === 'recent';
    const isCurrent = this.props.isCurrent;
    const isCurrentTopicClass = isCurrent ? ' esWB_T-Current' : '';
    const unreadClass = topic.unread ? ' esWB_T-Unread' : '';
    let title = topic.title || this._url;

    // Roughly 30 chars fits. For now, to usually avoid unneeded tooltips: (dupl width [4YK0F2])
    const tooltip = title.length > 21 ? title : undefined;
    const moreClasses = isCurrentTopicClass + unreadClass;

    // COULD add a WatchbarTopic.createdByMe field? or .mayAddMembers and .mayRemoveMembers?
    // (Or load lazily, when opening the dropdown?)
    const isAuthorOrStaff = isStaff(me);

    const viewMembersButtonTitle = !isChat ? t.wb.ViewPeopleHere : (
        isAuthorOrStaff ? t.wb.ViewAddRemoveMembers : t.wb.ViewChatMembers);

    const removeThisItemBtn = !isCurrent || !isRecent ? null :
        MenuItem({ className: 'e_WbRm', onSelect: () =>
              ReactActions.configWatchbar({ removePageIdFromRecent: topic.pageId }) },
          t.Remove);

    // UX COULD check role? and make it possible to edit title etc, without having to join.
    const editChatInfoButton = !isChat || !isAuthorOrStaff || !isCurrent ? null :
        MenuItem({ onSelect: this.editChatTitleAndPurpose, id: 'e2eWB_EditTitlePurposeB' },
          t.wb.EditChat);

    const leaveButton = !isChat && !isSubCommunity || !isCurrent ? null :
        MenuItem({ onSelect: this.openLeavePageDialog, id: 'e2eWB_LeaveB' },
          isChat? t.wb.LeaveThisChat : t.wb.LeaveThisCommunity);

    // If a community is listed in the Recent section, then one hasn't joined it.
    const joinButton = !showSubCommunities || !isRecent ||
              topic.type !== PageRole.Forum || !isCurrent ? null  :
        MenuItem({ onSelect: this.openJoinPageDialog, id: 'e_JoinB' },
          t.wb.JoinThisCommunity);

    const topicActionsButton = !isCurrent ? null :
      ModalDropdownButton({ title: r.span({ className: 'icon-settings', title: t.wb.TopicActions }),
          className: 'esWB_T_B', id: 'e2eTopicActionsB', ref: 'actionsDropdown', pullLeft: true,
          dialogClassName: 'esWB_T_D' },
        r.ul({ className: 'dropdown-menu' },
          MenuItem({ onSelect: this.viewChatMembers, id: 'e2eWB_ViewPeopleB' },
            viewMembersButtonTitle),
          editChatInfoButton,
          leaveButton,
          joinButton,
          removeThisItemBtn,
        ));

    if (this.props.homeIcon) {
      // No, don't use icon-menu: people think it's a dropdown menu. Use a house instead?
      // title = r.span({ className: 'icon-menu' }, title);
    }

    // Un-linkify, if is current page, so can click and open the current-page-menu, without
    // navigating to the page itself again and in that way accidentally clearing
    // any query string.
    const href = isCurrent ? null : this._url;

    // Could show num unread posts / chat messages. But would be rather complicated:
    // need to track num unread, + last visit date too, in the watchbar data.
    return (
        r.li({ className: 'esWB_LI esWB_T-' + flavor + moreClasses, onClick: this.onListItemClick },
          LinkUnstyled({ className: 'esWB_T_Link', href, title: tooltip },
            r.span({ className: 'esWB_T_Title' }, title)),
          topicActionsButton));
  }
});


const NoTopics = function(noProps, text) {
  return (
    r.li({ className: 'esWB_LI esWB_T-None' },
      r.span({ className: 'esWB_T_Link' },
        r.i({ className: 'esWB_T_None' }, text ))));
};


// The database remembers watchbar topics recent-first, but let's present them
// alphabetically; it's so confusing otherwise when all topics shift position whenever
// one views a page.
function cloneAndSort(topics: WatchbarTopic[]) {
  const topicsSorted = _.clone(topics);
  topicsSorted.sort((ta, tb) => {
    const titleA = ta.title.toLowerCase();
    const titleB = tb.title.toLowerCase();
    return titleA < titleB ? -1 : (titleA > titleB ? +1 : (
      ta.pageId < tb.pageId ? -1 : (ta.pageId > tb.pageId ? +1 : 0)));
  });
  return topicsSorted;
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
