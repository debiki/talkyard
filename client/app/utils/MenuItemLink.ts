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

//------------------------------------------------------------------------------
   module debiki2.utils {
//------------------------------------------------------------------------------

var r = React.DOM;


// COULD change to a pure function instead.
export var MenuItemLink = createComponent({
  render: function() {
    // Based on react-bootstrap's MenuItem html.
    return (
        r.li({ role: 'presentation', className: this.props.className },
          r.a({ role: 'button', href: this.props.href, tabIndex: this.props.tabindex || -1,
              target: this.props.target },
            this.props.children)));
  }
});

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
