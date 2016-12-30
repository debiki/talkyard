/**
 * Copyright (C) 2016 Kaj Magnus Lindberg
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
/// <reference path="../slim-bundle.d.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.users {
//------------------------------------------------------------------------------

var r = React.DOM;
var Nav = rb.Nav;
var NavItem = rb.NavItem;


export let UsersActivityComponent = React.createClass(<any> {
  contextTypes: {
    router: React.PropTypes.object.isRequired
  },

  transitionTo: function(what) {
    this.props.transitionTo('activity/' + what);
  },

  render: function() {
    var childProps = {
      me: this.props.me,
      user: this.props.user,
      reloadUser: this.props.loadCompleteUser,
    };
    let activeRouteName = this.props.routes[3].path;

    return (
     r.div({ style: { display: 'table', width: '100%' }},
       r.div({ style: { display: 'table-row' }},
         r.div({ className: 'dw-user-nav' },
           Nav({ bsStyle: 'pills', activeKey: activeRouteName,
               onSelect: this.transitionTo, className: 'dw-sub-nav nav-stacked' },
             NavItem({ eventKey: 'all' }, "All"),
             NavItem({ eventKey: 'topics' }, "Topics"),
             NavItem({ eventKey: 'posts' }, "Posts"))),
             //NavItem({ eventKey: 'likes-given' }, "Likes Given"),
             //NavItem({ eventKey: 'likes-received' }, "Likes Received"))),
         r.div({ className: 'dw-user-content' },
           React.cloneElement(this.props.children, childProps)))));
  }
});



export let AllActivityComponent = React.createClass(<any> {
  render: function() {
    return (
      r.p({}, "Not yet implemented 1"));
  }
});



export let TopicsComponent = React.createClass(<any> {
  render: function() {
    return (
      r.p({}, "Not yet implemented 2"));
  }
});



export let RepliesAndChatComponent = React.createClass(<any> {
  render: function() {
    return (
      r.p({}, "Not yet implemented 3"));
  }
});



export let LikesGivenComponent = React.createClass(<any> {
  render: function() {
    return (
      r.p({}, "Not yet implemented 4"));
  }
});



export let LikesReceivedComponent = React.createClass(<any> {
  render: function() {
    return (
      r.p({}, "Not yet implemented 5"));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
