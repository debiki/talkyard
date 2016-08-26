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
/// <reference path="react-utils.ts" />

//------------------------------------------------------------------------------
   module debiki2.utils {
//------------------------------------------------------------------------------

var r = React.DOM;
var ReactCSSTransitionGroup = reactCreateFactory(React.addons.CSSTransitionGroup);


/**
 * Use e.g. in a dialog to hide complicated settings, and have them fade in
 * if the user clicks "Show advanced stuff".
 */
export var FadeInOnClick = createClassAndFactory({
  getInitialState: function() {
    return { show: false };
  },

  show: function() {
    this.setState({ show: true });
  },

  render: function() {
    var contents = this.state.show ? this.props.children : null;
    var clickToShowButton = this.state.show ? null :
        r.a({ className: 'dw-click-to-show', onClick: this.show, id: this.props.clickToShowId },
          this.props.clickToShowText);

    return (
      r.div({ id: this.props.id, className: this.props.className },
        ReactCSSTransitionGroup({ transitionName: 'compl-stuff', transitionAppear: true,
            // Is 600 correct? Haven't checked, could do later
            transitionAppearTimeout: 600, transitionEnterTimeout: 600,
            transitionLeaveTimeout: 500 },
          contents),
        clickToShowButton));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
