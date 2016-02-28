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

//------------------------------------------------------------------------------
   module debiki2.watchbar {
//------------------------------------------------------------------------------

var keymaster: Keymaster = window['keymaster'];
var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var Button = reactCreateFactory(ReactBootstrap.Button);

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
        r.div({ className: 'esWatchbar', ref: 'watchbar' },
          Button({ className: 'esCloseWatchbarBtn', onClick: ReactActions.closeWatchbar },
            r.span({ className: 'icon-left-open' })),
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
        SingleTopic({ key: topic.pageId, topic: topic, flavor: 'recent',
            isCurrent: topic.pageId === store.pageId }));
    });
    return (
        r.div({ className: 'esWatchbar_topics' },
          r.h3({}, "Recent Topics"),
          r.ul({},
            topicElems)));
  }
});


var ChatChannels = createComponent({
  render: function() {
    var store: Store = this.props.store;
    var topics: WatchbarTopic[] = store.me.watchbar[WatchbarSection.ChatChannels];
    var topicElems;
    if (_.isEmpty(topics)) {
      topicElems = NoTopics();
    }
    else {
      topicElems = topics.map((topic: WatchbarTopic) =>
          SingleTopic({ key: topic.pageId, topic: topic, flavor: 'chat',
              isCurrent: topic.pageId === store.pageId }));
    }
    return (
      r.div({ className: 'esWatchbar_topics' },
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
          SingleTopic({ key: topic.pageId, topic: topic, flavor: 'direct',
            isCurrent: topic.pageId === store.pageId }));
    }
    return (
      r.div({ className: 'esWatchbar_topics' },
        r.h3({}, "Direct Messages"),
        r.ul({},
          topicElems)));
  }
});


var SingleTopic = createComponent({
  render: function() {
    var topic: WatchbarTopic = this.props.topic;
    var flavor: string = this.props.flavor;
    var isCurrentTopicClass = this.props.isCurrent ? ' esWatchbar_topic-current' : '';
    var unreadClass = topic.unread ? ' esWatchbar_topic-unread' : '';
    var url = topic.url || linkToPageId(topic.pageId);
    var moreClasses = isCurrentTopicClass + unreadClass;
    return (
        r.li({ className: 'esWatchbar_li esWatchbar_topic-' + flavor + moreClasses },
          r.a({ className: 'esWatchbar_topic_link', href: url },
            r.span({ className: 'esWatchbar_topic_title' }, topic.title || url))));
  }
});


var NoTopics = function() {
  return (
    r.li({ className: 'esWatchbar_li esWatchbar_topic-none' },
      r.span({ className: 'esWatchbar_topic_link' },
        r.i({ className: 'esWatchbar_topic_title' }, "None" ))));
};


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
