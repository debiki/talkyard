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
var ReactCSSTransitionGroup = reactCreateFactory(React.addons.CSSTransitionGroup);
var ReactBootstrap: any = window['ReactBootstrap'];
var Button = reactCreateFactory(ReactBootstrap.Button);

var watchbar;

export function createWatchbar() {
  var elem = document.getElementById('esWatchbarColumn');
  if (watchbar || !elem) return;
  watchbar = React.render(Watchbar(), elem);
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
    if (isPageWithWatchbar(this.state.store.pageRole)) {
      keymaster('w', this.toggleWatchbarOpen);
    }
  },

  componentWillUnmount: function() {
    if (isPageWithWatchbar(this.state.store.pageRole)) {
      keymaster.unbind('w', 'all');
    }
  },

  toggleWatchbarOpen: function() {
    ReactActions.toggleWatchbarOpen();
  },

  render: function() {
    var store: Store = this.state.store;

    if (!isPageWithWatchbar(store.pageRole))
      return null;

    function makeMakeTopicElemFn(className: string) {
      return function(topic: WatchbarTopic) {
        var isCurrentTopicClass = topic.pageId === store.pageId ? ' esWatchbar_topic-current' : '';
        return (
            r.li({ key: topic.pageId, className: className + isCurrentTopicClass,
                onClick: () => ReactActions.openPage(topic.pageId) },
              r.span({}, topic.title)));
      }
    }

    var watchbarTopics = store.me.watchbarTopics;
    var recentTopics = [];
    if (watchbarTopics) {
      recentTopics = watchbarTopics.recentTopics.map(makeMakeTopicElemFn('esWatchbar_topic-forum'));
    }

    // For now, hardcoded stuff:
    return (
      r.div({ className: 'esWatchbar', ref: 'watchbar' },
        Button({ className: 'esCloseWatchbarBtn', onClick: ReactActions.closeWatchbar },
            r.span({ className: 'icon-left-open' })),
        r.div({ className: 'esWatchbar_topics' },
          r.h3({}, 'Recent topics'),
          r.ul({},
            recentTopics)),
        r.div({ className: 'esWatchbar_topics' },
          r.h3({}, 'Watched topics'),
          r.ul({},
            r.li({ className: 'esWatchbar_topic-forum' }, r.span({}, "User rank should be a little more forgiving and give more insight")),
            r.li({ className: 'esWatchbar_topic-forum' }, r.span({}, "What are Discourse’s main competitors and what are their relative pros and cons?")),
            r.li({ className: 'esWatchbar_topic-forum' }, r.span({}, "Ability to block or mute another user")))),
        r.div({ className: 'esWatchbar_chatChannels' },
          r.h3({}, 'Chat channels'),
          r.ul({},
            r.li({ className: 'esWatchbar_topic-channel' }, r.span({}, "usability-testing")),
            r.li({ className: 'esWatchbar_topic-channel' }, r.span({}, "whatever-is-this")),
            r.li({ className: 'esWatchbar_topic-channel' }, r.span({}, "alerts")),
            r.li({ className: 'esWatchbar_topic-channel' }, r.span({}, "devops")),
            r.li({ className: 'esWatchbar_topic-channel' }, r.span({}, "the-weird-bad-problem")),
            r.li({ className: 'esWatchbar_topic-channel' }, r.span({}, "px-dev")))),
        r.div({ className: 'esWatchbar_messages' },
          r.h3({}, 'Direct messages'),
          r.ul({},
            r.li({ className: 'esWatchbar_topic-message' }, r.span({}, "Luke Skywalker")),
            r.li({ className: 'esWatchbar_topic-message' }, r.span({}, "Erik, Mario, Brynolf")),
            r.li({ className: 'esWatchbar_topic-message' }, r.span({}, "Erik Whatevername"))))));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
