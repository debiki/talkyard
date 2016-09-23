/*
 * Copyright (c) 2016 Kaj Magnus Lindberg
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
/// <reference path="../plain-old-javascript.d.ts" />

/*
 * In this file: A dropdown modal with entries to select, each one has a title and
 * an explanation text.
 *
 * Hmm but I haven't yet moved all code to here. Fairly much code is still somewhere
 * inside ../forum/forum.ts instead.
 */

// (Could move to more-bundle.js — but it's nice to be able to create the menu
// items inline, directly in slim-bundle.js.)

//------------------------------------------------------------------------------
   module debiki2.util {
//------------------------------------------------------------------------------

var r = React.DOM;


export interface ExplainingTitleText {
  onClick?: any;
  eventKey?: any;
  iconUrl?: string;
  title: string;
  text: any;
}


export var ExplainingListItem = createComponent({
  onClick: function(event) {
    event.preventDefault();
    if (this.props.onClick) {
      this.props.onClick(event);
    }
    if (this.props.onSelect) {
      this.props.onSelect(this.props);  // = calls onSelect(props: ExplainingTitleText)
    }
  },

  render: function() {
    var entry: ExplainingTitleText = this.props;
    var activeClass =
        this.props.active || _.isUndefined(this.props.active) && (
          this.props.onSelect && this.props.activeEventKey === this.props.eventKey) ?
        ' active' : '';
    return (
      r.li({ className: 'esExplDrp_entry' + activeClass },
        r.a({ onClick: this.onClick, id: this.props.id, className: this.props.className },
          r.div({ className: 'esExplDrp_entry_title' }, entry.title),
          r.div({ className: 'esExplDrp_entry_expl' }, entry.text))));
  },
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
