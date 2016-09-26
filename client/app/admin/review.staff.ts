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
/// <reference path="../slim-bundle.d.ts" />
/// <reference path="review-all.staff.ts" />
/// <reference path="review-posts.staff.ts" />

//------------------------------------------------------------------------------
   module debiki2.admin {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var Nav = reactCreateFactory(ReactBootstrap.Nav);
var NavItem = reactCreateFactory(ReactBootstrap.NavItem);


export var ReviewPanelComponent = React.createClass(<any> {
  contextTypes: {
    router: React.PropTypes.object.isRequired
  },

  /* Old: (remove later, when I've decided I'll remove review-posts.ts — right now it's
          only commented out here)
  getInitialState: function() {
    return {
      activeRoute: this.props.routes[2].path,
    };
  },

  handleSelect: function(newPath) {
    this.setState({ activeRoute: newPath });
    this.transitionTo(newPath);
    this.context.router.push('/-/admin/review/' + newPath);
  }, */

  render: function() {
    return (
      this.props.children);

    /* old:
    return (
        r.div({},
            Nav({ bsStyle: 'pills', activeKey: this.state.activeRoute, onSelect: this.handleSelect,
                className: 'dw-sub-nav' },
              NavItem({ eventKey: 'review-posts' }, 'Posts')),
            r.div({ className: 'dw-admin-panel' },
              this.props.children)));
    */
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
