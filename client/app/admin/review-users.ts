/*
 * Copyright (C) 2015 Kaj Magnus Lindberg
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
/// <reference path="../../typedefs/moment/moment.d.ts" />
/// <reference path="../../shared/plain-old-javascript.d.ts" />
/// <reference path="../ReactStore.ts" />
/// <reference path="../Server.ts" />

//------------------------------------------------------------------------------
   module debiki2.admin {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var Button = reactCreateFactory(ReactBootstrap.Button);


export var ReviewUsersPanel = createComponent({
  mixins: [SaveSettingMixin],

  componentDidMount: function() {
    Server.loadRecentPosts(posts => {
      this.setState({ posts: posts });
    });
  },

  render: function() {
    if (!this.state)
      return r.p({}, 'Loading...');

    var postsElems = this.state.posts.map(post => {
      return Post({ post: post });
    });

    return (
      r.div({ id: 'details' },
        'xxx'));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
