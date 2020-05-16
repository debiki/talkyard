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

/// <reference path="react-utils.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.utils {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;


export function FadeGrowIn(props: {}, content, c2?, c3?) {
  return rFragment({}, content, c2 || null, c3 || null);
  // Doesn't work, results in:
  //  """Element type is invalid: expected a string (for built-in components)
  //   or a class/function (for composite components) but got: undefined."""
  /*
  return r_CssTransition({   [REACTANIMS]  — no, instead use pure CSS animations. Faster,
          key: 1,                             simpler, less code. (Just *skip* fade-out anims.)
          className: 's_FadeGrowIn',
          timeout: { enter: 600, exit: 500 }},
      content); //, c2 || null, c3 || null);   */
}


/**
 * Use e.g. in a dialog to hide complicated settings, and have them fade in
 * if the user clicks "Show advanced stuff".
 */
export const FadeInOnClick = createClassAndFactory({
  getInitialState: function() {
    return { show: false };
  },

  show: function() {
    this.setState({ show: true });
  },

  render: function() {
    const contents = this.state.show ? this.props.children : null;
    const clickToShowButton = this.state.show ? null :
        r.a({ className: 'dw-click-to-show', onClick: this.show, id: this.props.clickToShowId },
          this.props.clickToShowText);

    return (
      r.div({ id: this.props.id, className: this.props.className },
        FadeGrowIn({}, contents),
        clickToShowButton));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
