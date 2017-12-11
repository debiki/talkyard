/*
 * Copyright (c) 2015 Kaj Magnus Lindberg
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

/// <reference path="../../typedefs/keymaster/keymaster.d.ts" />
/// <reference path="../ReactStore.ts" />
/// <reference path="../help/help.ts" />
/// <reference path="../store-getters.ts" />
/// <reference path="../utils/DropdownModal.ts" />
/// <reference path="../sidebar/sidebar.ts" />
/// <reference path="../more-bundle-not-yet-loaded.ts" />
/// <reference path="../editor-bundle-not-yet-loaded.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.watchbar {
//------------------------------------------------------------------------------

const keymaster: Keymaster = window['keymaster'];
const r = ReactDOMFactories;
const ModalDropdownButton = utils.ModalDropdownButton;

let watchbar;

export function createWatchbar() {
  var elem = document.getElementById('esWatchbarColumn');
  if (watchbar || !elem) return;
  watchbar = ReactDOM.render(Router({}, Watchbar()), elem);
}


export var Watchbar = createComponent({
  displayName: 'Watchbar',

  mixins: [debiki2.StoreListenerMixin],

  getInitialState: function() {
    var store = debiki2.ReactStore.allData();
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
    const me = store.me;

    const recentTopicsAndNotfs = RecentTopicsAndNotfs({ store: store });
    const chatChannels = ChatChannels({ store: store });
    const directMessages = me.isLoggedIn ? DirectMessages({ store: store }) : null;

    return (
      r.div({ className: 'esWB', ref: 'watchbar' },
        r.button({ className: 'esWB_CloseB esCloseCross', onClick: ReactActions.closeWatchbar }),
        recentTopicsAndNotfs,
        chatChannels,
        directMessages));
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
    _.each(recentTopics, (topic: WatchbarTopic) => {
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
          // Not "recent topics", because contains non-topics too, e.g. forum itself.
          r.h3({ style: { wordSpacing: '2px' }}, "Recently viewed"),
          r.ul({},
            topicElems)));
  }
});


const ChatChannels = createComponent({
  displayName: 'ChatChannels',

  componentWillUnmount: function() {
    this.isUnmounted = true;
  },

  componentWillMount: function() {
    delete this.isUnmounted;
  },

  createChatChannel: function() {
    morebundle.loginIfNeeded(LoginReason.LoginToChat, location.toString(), () => {
      if (this.isUnmounted) return;
      const store: Store = this.props.store;
      const category = store_getCurrOrDefaultCat(store);
      dieIf(!category, 'EsE4KPE02');
      editor.editNewForumPage(category.id, PageRole.OpenChat);
    });
  },

  render: function() {
    const store: Store = this.props.store;
    const topics: WatchbarTopic[] = store.me.watchbar[WatchbarSection.ChatChannels];
    let topicElems;
    if (_.isEmpty(topics)) {
      topicElems = NoTopics();
    }
    else {
      topicElems = topics.map((topic: WatchbarTopic) =>
          SingleTopic({ key: topic.pageId, store: store, topic: topic, flavor: 'chat',
              isCurrent: topic.pageId === store.currentPageId }));
    }
    const title = store.me.isLoggedIn ? "Joined Chats" : "Chat Channels";
    return (
      r.div({ className: 'esWB_Ts' },
        r.button({ className: 'esWB_CreateB', id: 'e2eCreateChatB',
            onClick: this.createChatChannel, title: "Create chat channel" }, '+'),
        r.h3({}, title),
        r.ul({},
          topicElems)));
  }
});


var DirectMessages = createComponent({
  displayName: 'DirectMessages',

  render: function() {
    var store: Store = this.props.store;
    var topics: WatchbarTopic[] = store.me.watchbar[WatchbarSection.DirectMessages];
    var topicElems;
    if (_.isEmpty(topics)) {
      topicElems = NoTopics();
    }
    else {
      topicElems = topics.map((topic: WatchbarTopic) =>
          SingleTopic({ key: topic.pageId, store: store, topic: topic, flavor: 'direct',
            isCurrent: topic.pageId === store.currentPageId }));
    }
    return (
      r.div({ className: 'esWB_Ts' },
        r.h3({}, "Direct Messages"),
        r.ul({},
          topicElems)));
  }
});


const SingleTopic = createComponent({
  displayName: 'SingleTopic',

  componentWillMount: function() {
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

  onLinkClick: function(event) {
    if (this.props.isCurrent) return;
    const didNavigate = page.Hacks.navigateTo(this._url);
    if (didNavigate) {
      event.stopPropagation();
      event.preventDefault();
    }
  },

  editChatTitleAndPurpose: function() {
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

  openLeaveChatDialog: function() {
    // For now: (Later, ask: Really? Why? No.)
    Server.leaveChatChannel();
  },

  render: function() {
    var store: Store = this.props.store;
    var me: Myself = store.me;
    var topic: WatchbarTopic = this.props.topic;
    var flavor: string = this.props.flavor;
    var isChat = flavor === 'chat';
    var isCurrentTopicClass = this.props.isCurrent ? ' esWB_T-Current' : '';
    var unreadClass = topic.unread ? ' esWB_T-Unread' : '';
    var title = topic.title || this._url;

    if (topic.type === PageRole.Forum) {  // [5KWQB42]
      title = r.span({ className: 'icon-menu' }, title);
    }

    // Roughly 30 chars fits. For now, to usually avoid unneeded tooltips: (dupl width [4YK0F2])
    var tooltip = title.length > 21 ? title : undefined;
    var moreClasses = isCurrentTopicClass + unreadClass;

    // COULD add a WatchbarTopic.createdByMe field? or .mayAddMembers and .mayRemoveMembers?
    // (Or load lazily, when opening the dropdown?)
    var isAuthorOrStaff = isStaff(me);

    var viewMembersButtonTitle = !isChat ? "View people here" : (
        isAuthorOrStaff ? "View / add / remove members" : "View chat members");

    // UX COULD check role? and make it possible to edit title etc, without having to join.
    var editChatInfoButton = !isChat || !isAuthorOrStaff || !this.props.isCurrent ? null :
        MenuItem({ onSelect: this.editChatTitleAndPurpose, id: 'e2eWB_EditTitlePurposeB' },
            r.span({ className: 'icon-help' }, "Edit chat title and purpose"));

    var leaveChatButton = !isChat ? null :
        MenuItem({ onSelect: this.openLeaveChatDialog, id: 'e2eWB_LeaveB' },
            r.span({ className: 'icon-help' }, "Leave this chat"));

    var topicActionsButton = !this.props.isCurrent ? null :
      ModalDropdownButton({ title: r.span({ className: 'icon-settings', title: "Topic actions" }),
          className: 'esWB_T_B', id: 'e2eTopicActionsB', ref: 'actionsDropdown', pullLeft: true,
          dialogClassName: 'esWB_T_D' },
        r.ul({ className: 'dropdown-menu' },
          MenuItem({ onSelect: this.viewChatMembers, id: 'e2eWB_ViewPeopleB' },
            r.span({ className: 'icon-help' }, viewMembersButtonTitle)),
          editChatInfoButton,
          leaveChatButton
        ));

    // Could show num unread posts / chat messages. But would be rather complicated:
    // need to track num unread, + last visit date too, in the watchbar data.
    return (
        r.li({ className: 'esWB_LI esWB_T-' + flavor + moreClasses, onClick: this.onListItemClick },
          r.a({ className: 'esWB_T_Link', href: this._url, title: tooltip, onClick: this.onLinkClick },
            r.span({ className: 'esWB_T_Title' }, title)),
          topicActionsButton));
  }
});


var NoTopics = function() {
  return (
    r.li({ className: 'esWB_LI esWB_T-None' },
      r.span({ className: 'esWB_T_Link' },
        r.i({ className: 'esWB_T_None' }, "None" ))));
};


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
