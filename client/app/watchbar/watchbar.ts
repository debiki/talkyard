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

/// <reference path="../../typedefs/react/react.d.ts" />
/// <reference path="../../typedefs/keymaster/keymaster.d.ts" />
/// <reference path="../plain-old-javascript.d.ts" />
/// <reference path="../ReactStore.ts" />
/// <reference path="../help/help.ts" />
/// <reference path="../store-getters.ts" />
/// <reference path="../utils/DropdownModal.ts" />
/// <reference path="../sidebar/sidebar.ts" />
/// <reference path="../editor-bundle-not-yet-loaded.ts" />

//------------------------------------------------------------------------------
   module debiki2.watchbar {
//------------------------------------------------------------------------------

var keymaster: Keymaster = window['keymaster'];
var r = React.DOM;
var ModalDropdownButton = utils.ModalDropdownButton;

var watchbar;

export function createWatchbar() {
  var elem = document.getElementById('esWatchbarColumn');
  if (watchbar || !elem) return;
  watchbar = ReactDOM.render(Watchbar(), elem);
}


export var Watchbar = createComponent({
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
    var store: Store = this.state.store;

    var recentTopicsAndNotfs = RecentTopicsAndNotfs({ store: store });
    var chatChannels = ChatChannels({ store: store });
    var directMessages = DirectMessages({ store: store });

    return (
        r.div({ className: 'esWB', ref: 'watchbar' },
          r.button({ className: 'esWB_CloseB esCloseCross',
              onClick: ReactActions.closeWatchbar }),
        recentTopicsAndNotfs,
        chatChannels,
        directMessages));
  }
});


var RecentTopicsAndNotfs = createComponent({
  render: function() {
    var store: Store = this.props.store;
    var watchbar: Watchbar = store.me.watchbar;
    var recentTopics: WatchbarTopic[] = watchbar[WatchbarSection.RecentTopics];
    var chatChannels: WatchbarTopic[] = watchbar[WatchbarSection.ChatChannels];
    var directMessages: WatchbarTopic[] = watchbar[WatchbarSection.DirectMessages];
    var topicElems = [];
    _.each(recentTopics, (topic: WatchbarTopic) => {
      // If the topic is listed in the Chat Channels or Direct Messages section, skip it
      // here in the recent-topics list.
      if (_.some(chatChannels, c => c.pageId === topic.pageId)) return;
      if (_.some(directMessages, m => m.pageId === topic.pageId)) return;
      topicElems.push(
        SingleTopic({ key: topic.pageId, store: store, topic: topic, flavor: 'recent',
            isCurrent: topic.pageId === store.pageId }));
    });
    return (
        r.div({ className: 'esWB_Ts' },
          // Not "recent topics", because contains non-topics too, e.g. forum itself.
          r.h3({ style: { wordSpacing: '2px' }}, "Recently viewed"),
          r.ul({},
            topicElems)));
  }
});


var ChatChannels = createComponent({
  componentWillUnmount: function() {
    this.isUnmounted = true;
  },

  componentWillMount: function() {
    delete this.isUnmounted;
  },

  createChatChannel: function() {
    login.loginIfNeeded(LoginReason.LoginToChat, location.toString(), () => {
      if (this.isUnmounted) return;
      var store: Store = this.props.store;
      var category = store_getCurrOrDefaultCat(store);
      dieIf(!category, 'EsE4KPE02');
      editor.editNewForumPage(category.id, PageRole.OpenChat);
    });
  },

  render: function() {
    var store: Store = this.props.store;
    var topics: WatchbarTopic[] = store.me.watchbar[WatchbarSection.ChatChannels];
    var topicElems;
    if (_.isEmpty(topics)) {
      topicElems = NoTopics();
    }
    else {
      topicElems = topics.map((topic: WatchbarTopic) =>
          SingleTopic({ key: topic.pageId, store: store, topic: topic, flavor: 'chat',
              isCurrent: topic.pageId === store.pageId }));
    }
    return (
      r.div({ className: 'esWB_Ts' },
        r.button({ className: 'esWB_CreateB', id: 'e2eCreateChatB',
            onClick: this.createChatChannel, title: "Create chat channel" }, '+'),
        r.h3({}, "Joined Chats"),
        r.ul({},
          topicElems)));
  }
});


var DirectMessages = createComponent({
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
            isCurrent: topic.pageId === store.pageId }));
    }
    return (
      r.div({ className: 'esWB_Ts' },
        r.h3({}, "Direct Messages"),
        r.ul({},
          topicElems)));
  }
});


var SingleTopic = createComponent({
  // If this topic is clicked, when it's the current topic already, then open the dropdown.
  onClick: function(event) {
    if (!this.props.isCurrent)
      return;
    event.preventDefault();
    this.refs.actionsDropdown.openDropdown();
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
    var url = topic.url || linkToPageId(topic.pageId);
    var title = topic.title || url;
    // Roughly 30 chars fits. For now, to usually avoid unneeded tooltips: (dupl width [4YK0F2])
    var tooltip = title.length > 21 ? title : undefined;
    var moreClasses = isCurrentTopicClass + unreadClass;

    // COULD add a WatchbarTopic.createdByMe field? or .mayAddMembers and .mayRemoveMembers?
    // (Or load lazily, when opening the dropdown?)
    var isAuthorOrStaff = isStaff(me);

    var viewMembersButtonTitle = !isChat ? "View people here" : (
        isAuthorOrStaff ? "View / add / remove members" : "View chat members");

    // Would want to know if the *page* is of type chat, so can edit title etc, without
    // having to join. [4KW0Y2]
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
        r.li({ className: 'esWB_LI esWB_T-' + flavor + moreClasses, onClick: this.onClick },
          r.a({ className: 'esWB_T_Link', href: url, title: tooltip },
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
