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
/// <reference path="../../typedefs/keymaster/keymaster.d.ts" />
/// <reference path="../plain-old-javascript.d.ts" />
/// <reference path="../prelude.ts" />
/// <reference path="../model.ts" />
/// <reference path="../rules.ts" />
/// <reference path="../widgets.ts" />
/// <reference path="../utils/react-utils.ts" />

//------------------------------------------------------------------------------
   module debiki2.utils {
//------------------------------------------------------------------------------

var r = React.DOM;
var $: JQueryStatic = debiki.internal.$;
var keymaster: Keymaster = window['keymaster'];
declare var ReactBootstrap: any;  // lazy loaded
declare var Modal;                // lazy loaded


export var ModalDropdownButton = createComponent({
  getInitialState: function () {
    return {
      isOpen: false,
      buttonX: -1,
      buttonY: -1,
      modalCreated: false,
    };
  },

  componentDidMount: function() {
    keymaster('escape', this.props.onClose);
    $(this.refs.input).focus();
  },

  componentWillUnmount: function() {
    keymaster.unbind('escape', 'all');
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

  hideBackdrop: function() {
    if (this.refs.dropdownModal)
      this.refs.dropdownModal.hideBackdrop();
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
            allowFullWidth: props.allowFullWidth, ref: 'dropdownModal',
            showCloseButton: props.showCloseButton,
            onContentClick: props.closeOnClick === false ? null : this.closeDropdown },
          props.children);
    }

    return (
      Button({ onClick: this.openDropdown, className: props.className, id: props.id,
          ref: 'openButton' },
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

  componentDidMount: function() {
    Server.loadMoreScriptsBundle(() => {
      ReactBootstrap = window['ReactBootstrap'];
      Modal = reactCreateFactory(ReactBootstrap.Modal);
      this.setState({ moreBundleLoaded: true });
    })
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

  hideBackdrop: function() {
    this.setState({ hideBackdrop: true });
  },

  render: function() {
    if (!this.state.moreBundleLoaded)
      return null;

    var content;
    if (this.props.show) {
      var closeButton = !this.props.showCloseButton ? null :
        r.div({ className: 'esDropModal_CloseB esCloseCross', onClick: this.props.onHide });

      // Try to remove props.atX & .pullLeft, use betweenX everywhere instead. CLEAN_UP
      var atX = this.props.atX;
      var atY = this.props.atY;
      var pullLeft = this.props.pullLeft;

      var rect: ClientRect = this.props.atRect;
      if (rect) {
        var windowMiddle = this.props.windowWidth / 2;
        var spaceLeft = windowMiddle - rect.left;
        var spaceRight = rect.right - windowMiddle;
        pullLeft = spaceLeft > spaceRight;
        atX = pullLeft ? rect.left : rect.right;
        atY = rect.bottom;
      }

      var left = pullLeft ? atX : undefined;
      var right = pullLeft ? undefined : 'calc(100% - ' + atX + 'px)';
      var styles = {
        left: left,
        right: right,
        top: atY,
      };
      content =
        r.div({ className: 'esDropModal_content ' + (this.props.className || ''), style: styles,
            ref: 'content', onClick: this.props.onContentClick }, closeButton, this.props.children);
    }

    var backdropStyle: any = { opacity: 0.08 };
    if (this.state.hideBackdrop) backdropStyle.display = 'none';

    var notTooWideClass = this.props.allowFullWidth ? '' : ' esDropModal-NotTooWide';
    return (
      Modal({ show: this.props.show, onHide: this.props.onHide,
          onShow: () => this.setState({ hideBackdrop: false }),
          dialogClassName: 'esDropModal' + notTooWideClass, backdropStyle: backdropStyle },
        content));
  }
});

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
