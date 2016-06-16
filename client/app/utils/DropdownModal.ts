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
var Button = reactCreateFactory(ReactBootstrap.Button);
var Modal = reactCreateFactory(ReactBootstrap.Modal);


export var ModalDropdownButton = createComponent({
  getInitialState: function () {
    return {
      isOpen: false,
      buttonX: -1,
      buttonY: -1,
      modalCreated: false,
    };
  },

  openDropdown: function() {
    var rect = ReactDOM.findDOMNode(this.refs.openButton).getBoundingClientRect();
    this.setState({ modalCreated: true, isOpen: true,
      buttonX: this.props.pullLeft ? rect.left : rect.right, buttonY: rect.bottom });
  },

  closeDropdown: function() {
    // Don't set created: false though, because then React breaks.
    this.setState({ isOpen: false });
  },

  render: function() {
    var props = this.props;
    var state = this.state;

    // Don't create immediately, because creating all dropdowns and dialogs directly on
    // page load makes the page load slower (a few millis per dialog I think, adding up to
    // 30ms? 70ms? which is a lot).
    var dropdownModal;
    if (state.modalCreated) {
      dropdownModal =
          DropdownModal({ show: state.isOpen, pullLeft: props.pullLeft,
            onHide: this.closeDropdown, atX: state.buttonX, atY: state.buttonY,
            className: props.dialogClassName, id: props.dialogId,
            allowFullWidth: props.allowFullWidth, onContentClick: this.closeDropdown },
          props.children);
    }

    return (
      Button({ onClick: this.openDropdown, className: props.className, id: props.id,
          key: props.key, ref: 'openButton' },
        this.props.title, dropdownModal));
  }
});


/**
 * Places a dropdown at (this.props.atX, this.props.atY) and tries to fit it inside the
 * current viewport. Dims everything outside the dropdown just a little bit.
 */
// [refactor] Rename to ModalDropdownDialog
export var DropdownModal = createComponent({
  getInitialState: function () {
    return {};
  },

  componentDidUpdate: function() {
    if (!this.props.show || !this.refs.content)
      return;
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
      // However, this should never happen, because max-width always leaves some
      // space outside to click to close. [4YK8ST2]
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
        r.div({ className: 'esDropModal_content ' + (this.props.className || ''), style: styles,
            ref: 'content', onClick: this.props.onContentClick }, this.props.children);
    }

    var notTooWideClass = this.props.allowFullWidth ? '' : ' esDropModal-NotTooWide';
    return (
      Modal({ show: this.props.show, onHide: this.props.onHide,
          dialogClassName: 'esDropModal' + notTooWideClass, backdropStyle: { opacity: 0.08 } },
        content));
  }
});

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
