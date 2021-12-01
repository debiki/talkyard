/*
 * Copyright (c) 2016, 2017, 2021 Kaj Magnus Lindberg
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

/// <reference path="../more-prelude.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.tags {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;

const TagsRoot = '/-/tags/';


export function routes() {
  return Switch({},
    RedirAppend({ path: TagsRoot, append: 'all' }),
    Route({ path: TagsRoot, component: TagsAppComponent }));
}



const TagsAppComponent = createReactClass(<any> {
  displayName:  'TagsAppComponent',
  mixins: [debiki2.StoreListenerMixin],

  getInitialState: function() {
    return {
      store: debiki2.ReactStore.allData(),
    };
  },

  onChange: function() {
    this.setState({
      store: debiki2.ReactStore.allData(),
    });
  },

  render: function() {
    const store: Store = this.state.store;
    return (
      r.div({ className: 'container esSA' },
        // [React_Router_v51] skip render(), use hooks and useParams instead.
        Route({ path: TagsRoot + 'all', render: () => AllTagsPanel({ store }) })));
  }
});


interface TagsPanelState {
  flashTagTypeId?: TagTypeId;
  doneLoading?: Bo;
}


const AllTagsPanel = createFactory({
  displayName:  'AllTagsPanel',

  getInitialState: function() {
    return {};
  },

  componentDidMount: function() {
    // Or maybe:
    // Server.listTagTypes({ forThings: ThingType.Pats + ThingType.Posts, inclStats: true });
    Server.loadTagsAndStats(() => this.setState({ doneLoading: true }));
    // Later: (no longer works, tags just got reimplemented)
    //Server.loadMyTagNotfLevels();
  },

  render: function() {
    const state: TagsPanelState = this.state;
    const store: Store = this.props.store;
    const me: Myself = store.me;

    if (!state.doneLoading)
      return r.p({}, "Loading ...");

    const tagTypes: TagType[] = _.values(store.tagTypesById) || [];
    /*
    var tagsStuff: TagsStuff = store.tagsStuff || {};
    var tagsAndStats = tagsStuff.tagsAndStats;
    */
    var myTagNotfLevels = []; // !tagsStuff.myTagNotfLevels;

    var subscribersColumn = isStaff(me) ? r.th({}, "Subscribers") : null;
    var mutedColumn = isStaff(me) ? r.th({}, "Muted") : null;

    const tagTableRows = tagTypes.map(tagType =>
        TagTableRow({ store: store, tagType,
            myTagNotfLevels: myTagNotfLevels,
            flashTagTypeId: state.flashTagTypeId }));

    const onTagTypeCreated = (newTagType: TagType) => {
      const newState = { flashTagTypeId: newTagType.id };
      this.setState(newState);
      logD(`Created tag type: ` + JSON.stringify(newTagType, undefined, 4));
    }

    return (
      r.div({},
        Button({ onClick: () => openCreateTagDialog(onTagTypeCreated) }, "Create Tag"),
        r.h2({}, "All tags"),
        // @ifdef DEBUG
        r.p({}, "Debug build JSON:"),
        r.pre({}, JSON.stringify(tagTypes, undefined, 4)),
        // @endif
        r.table({ className: "table c_TagT" },
          r.thead({},
            r.tr({},
              r.th({}, "Tag or Badge"),
              r.th({}, "Total usages"),
              r.th({}, "Tagged posts"),
              r.th({}, "User badges"),
              /*
              subscribersColumn,
              mutedColumn,
              r.th({}, "Notifications to you") */)),
          r.tbody({},
            tagTableRows))));
  }
});



const noStats: TagTypeStats = {
  tagTypeId: No.TagTypeId as TagTypeId,
  numTotal: 0,
  numPostTags: 0,
  numPatBadges: 0,
}


function TagTableRow(props: { store: Store, tagType: TagType, myTagNotfLevels,
          flashTagTypeId?: TagTypeId }) {
    const store: Store = props.store;
    //var me: Myself = store.me;
    const tagType: TagType = props.tagType;
    const stats: TagTypeStats = store.tagTypeStatsById[tagType.id] || noStats;
    //var myTagNotfLevels = props.myTagNotfLevels;
    //var tagNotfLevel = (myTagNotfLevels || {})[tagType.id] || PageNotfLevel.Normal;
    //var subscribersColumn = isStaff(me) ? r.td({}, tagAndStats.numSubscribers) : null;
    //var mutedColumn = isStaff(me) ? r.td({}, tagAndStats.numMuted) : null;
    const flashClass = props.flashTagTypeId === tagType.id ? 'n_Flash' : '';
    return (
      r.tr({ className: flashClass },
        r.td({},
          r.a({ className: 'c_TagT_Tag' }, tagType.dispName)),
        r.td({},
          stats.numTotal),
        r.td({},
          stats.numPostTags),
        r.td({},
          stats.numPatBadges),
      ));
        /*
        subscribersColumn,
        mutedColumn,
        r.td({},
          "Unimplemented [2ABRP05F]")));
          /*notfs.PageNotfPrefButton({ pref, me: Myself }),
          notification.NotfLe  velButton_oldForTags({ subject: { tagLabel: tagAndStats.label },
              notfLevel: tagNotfLevel }))));
              */
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
