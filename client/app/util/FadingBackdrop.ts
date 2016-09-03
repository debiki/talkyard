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
   module debiki2.util {
//------------------------------------------------------------------------------

var r = React.DOM;


/**
 * Makes everything dark for a while — except *something* that you want people to notice.
 * That something you place *above* this backdrop, and then, because everything else
 * has been made dark by the backdrop, people will look at that *something*.
 */
export var FadingBackdrop = createComponent({
  getInitialState: function() {
    return { backdropOpacity: 0 };
  },

  // dupl code, also in editor.ts, remove that, and start using this instead [4KEF0YUU2]
  showForMillis: function(millis: number) {
    this.setState({ backdropOpacity: 0.83 });
    var fadeBackdrop = () => {
       var opacity = this.state.backdropOpacity;
       var nextOpacity = opacity < 0.01 ? 0 : opacity - 0.009;
       this.setState({ backdropOpacity: nextOpacity });
       if (nextOpacity) {
          setTimeout(fadeBackdrop, 16);
       }
    };
    setTimeout(fadeBackdrop, millis);
  },

  hide: function() {
    this.setState({ backdropOpacity: 0 });
  },

  render: function() {
    if (this.state.backdropOpacity < 0.01)
      return null;

    return (
      r.div({ className: 'esFadingBackdrop', style: { opacity: this.state.backdropOpacity }}));
  }
});


//------------------------------------------------------------------------------
   }
//--------------------$      ----------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
