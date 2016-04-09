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
/// <reference path="../prelude.ts" />
/// <reference path="../model.ts" />

//------------------------------------------------------------------------------
   module debiki2.utils {
//------------------------------------------------------------------------------

var r = React.DOM;
var $: JQueryStatic = debiki.internal.$;
var ReactBootstrap: any = window['ReactBootstrap'];
var Modal = reactCreateFactory(ReactBootstrap.Modal);

/**
 * Places a dropdown at (this.props.atX, this.props.atY) and tries to fit it inside the
 * current viewport. Dims everything outside the dropdown just a little bit.
 */
export var DropdownModal = createComponent({
  getInitialState: function () {
    return {};
  },

  componentDidUpdate: function() {
    if (!this.props.show) return;
    var rect = this.refs.content.getBoundingClientRect();
    if (rect.bottom > $(window).height()) {
      this.fitInWindowVertically();
    }
    if (rect.right > $(window).width()) {
      this.moveLeftwardsSoFitsInWindow();
    }
    else if (rect.left < 0) {
      $(this.refs.content).css('left', 0);
    }
  },

  fitInWindowVertically: function() {
    var winHeight = $(window).height();
    var $content = $(this.refs.content);
    if ($content.outerHeight() > winHeight - 5) {
      $content.css('top', 0).css('height', winHeight).css('overflow-y', 'auto');
    }
    else {
      $content.css('top', winHeight - $content.outerHeight() - 5);
    }
  },

  moveLeftwardsSoFitsInWindow: function() {
    var winWidth = $(window).width();
    var $content = $(this.refs.content);
    if ($content.outerWidth() > winWidth) {
      // Better show the left side, that's where any titles and texts start.
      $content.css('left', 0);
    }
    else {
      $content.css('left', winWidth - $content.outerWidth());
    }
  },

  render: function() {
    var content;
    if (this.props.show) {
      var left = this.props.pullLeft ? this.props.atX : undefined;
      var right = this.props.pullLeft ? undefined : 'calc(100% - ' + this.props.atX + 'px)';
      var styles = {
        left: left,
        right: right,
        top: this.props.atY,
      };
      content =
        r.div({ className: 'esDropModal_content', style: styles, ref: 'content' },
          this.props.children);
    }

    return (
      Modal({ show: this.props.show, onHide: this.props.onHide, dialogClassName: 'esDropModal',
          backdropStyle: { opacity: 0.08 } },
        content));
  }
});

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
