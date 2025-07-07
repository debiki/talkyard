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

/// <reference path="../../../node_modules/@types/keymaster/index.d.ts" />
/// <reference path="../prelude.ts" />
/// <reference path="../rules.ts" />
/// <reference path="../widgets.ts" />
/// <reference path="../utils/react-utils.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.utils {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const keymaster: Keymaster = window['keymaster'];
declare const rb; // ReactBootstrap components, lazy loaded


export const ModalDropdownButton = createComponent({
  displayName: 'ModalDropdownButton',

  getInitialState: function () {
    return {
      isOpen: false,
      buttonX: -1,
      buttonY: -1,
      modalCreated: false,
    };
  },

  componentDidMount: function() {
    if (this.props.onClose) {
      keymaster('escape', this.props.onClose);  // but what about this.closeDropdown() ?
    }
  },

  componentWillUnmount: function() {
    if (this.props.onClose) {
      keymaster.unbind('escape', 'all');
    }
  },

  openDropdown: function() {
    let pullLeft = this.props.pullLeft;
    if (eds.isRtl) pullLeft = !pullLeft;
    var rect = (<HTMLElement> ReactDOM.findDOMNode(this.refs.openButton)).getBoundingClientRect();
    this.setState({ modalCreated: true, isOpen: true,
      buttonX: pullLeft ? rect.left : rect.right, buttonY: rect.bottom });
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
    const props = this.props;
    const state = this.state;

    // Don't create immediately, because creating all dropdowns and dialogs directly on
    // page load makes the page load slower (a few millis per dialog I think, adding up to
    // 30ms? 70ms? which is a lot).
    let dropdownModal;
    if (state.modalCreated) {
      dropdownModal =
        // Prevent clicks from propagating outside the modal, and e.g. triggering an onClick outside.
        r.span({ onClick: (event) => event.stopPropagation(), key: 'MDM' },
         DropdownModal({ show: state.isOpen, pullLeft: props.pullLeft,
            onHide: this.closeDropdown, atX: state.buttonX, atY: state.buttonY,
            dialogClassName2: props.dialogClassName2, // <— should be this? CLEAN_UP: remove '2'
            className: props.dialogClassName,  // <— CLEAN_UP REMOVE/RENAME to contentClassName?
            id: props.dialogId,
            allowFullWidth: props.allowFullWidth, ref: 'dropdownModal',
            showCloseButton: props.showCloseButton,
            bottomCloseButton: props.bottomCloseButton,
            onContentClick: props.closeOnClick === false ? null : (event) => {
              if (!props.stayOpenOnCmdShiftClick || !event_isCmdShiftClick(event)) {
                this.closeDropdown();
              }
            } },
          props.render ? props.render({ closeDropdown: this.closeDropdown }) : props.children));
    }

    // Don't nest the dropdownModal inside the Button — then, all clicks inside the modal dialog,
    // would propagate to the button, which does event.preventDefault(), making links inside the
    // modal dialog stop working.
    return [
      Button({ onClick: this.openDropdown, className: props.className, id: props.id,
          ref: 'openButton', key: 'MDB' }, this.props.title),
      dropdownModal];
  }
});


/**
 * Places a dropdown at (this.props.atX, this.props.atY) and tries to fit it inside the
 * current viewport. Dims everything outside the dropdown just a little bit.
 */
// [refactor] Rename to ModalDropdownDialog
export const DropdownModal = createComponent({
  displayName: 'DropdownModal',

  getInitialState: function () {
    return {};
  },

  componentDidMount: function() {
    Server.loadMoreScriptsBundle(() => {
      if (this.isGone) return;
      this.setState({ moreBundleLoaded: true });
    })
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  componentDidUpdate: function() {
    // Wait until all stuff inside has gotten its proper size. Apparently componentDidUpdate()
    // fires before the browser has done that — because without setTimeout(_, 0), the dialog
    // can become too small.
    setTimeout(() => {
    const props: DropdownProps = this.props;
      if (!props.show || !this.refs.content || this.isGone)
        return;

      const content = this.refs.content;
      const rect = cloneRect(content.getBoundingClientRect());

      // top = distance from real win top to the top of the iframe, if in embedded comments iframe.
      // height = real window height (not the iframe's height).
      // (Skip any iframe left offset, for now — most websites don't have horizontal scrolling.)
      let winOfsSize = debiki2.iframeOffsetWinSize || { top: 0, height: window.innerHeight };

      rect.top -= winOfsSize.top;
      rect.bottom -= winOfsSize.top;

      const rectHeight = rect.bottom - rect.top;
      const winVisibleHeight = winOfsSize.iframeVisibleHeight || winOfsSize.height;
      if (rectHeight >= winVisibleHeight) {
        // The dialog is larger than the window. Place it at the top, so if resizing the window
        // (it'll expand downwards), the hidden part of the dialog becomes visible.
        // Important for blog comments, if one opens the notf prefs dialog before there're
        // any comments — then, the iframe is shorter than the notfs prefs dialog. [IFRRESIZE]
        this.refs.content.style.top = winOfsSize.top;
      }
      else if (rect.bottom > winOfsSize.height) {
        this.fitInWindowVertically(winOfsSize);
      }

      // (This right-&-left stuff works also in iframes.)
      if (rect.right > window.innerWidth) {
        this.moveLeftwardsSoFitsInWindow();
      }
      else if (rect.left < 6) {
        // max-width is 89% [4YK8ST2] so we have some pixels to spare, and looks better with
        // to the left, so 6px not 0px here:
        content.style.left = '6px';
      }

      // This calls componentDidUpdate() and could create a "loop", so do only if needed.
      if (!this.state.fitsInDisplay) {
        this.setState({ fitsInDisplay: true });
      }
    }, 0);
  },

  fitInWindowVertically: function(winOfsSize: { top: number, height: number }) {
    const content = this.refs.content;
    const contentHeight = content.clientHeight;
    if (contentHeight > winOfsSize.height - 5) {
      // Full window height, + scrollbar.
      Bliss.style(content, {
          top: winOfsSize.top, height: winOfsSize.height + 'px', 'overflow-y': 'auto' });
    }
    else {
      // Place at the bottom of the window, a little bit up, so the box-shadow can be seen.
      content.style.top = (winOfsSize.top + winOfsSize.height - contentHeight - 5) + 'px';
    }
  },

  moveLeftwardsSoFitsInWindow: function() {
    const winWidth = window.innerWidth;
    const content = this.refs.content;
    const contentWidth = content.clientWidth;
    if (content.clientWidth > winWidth) {
      // Better show the left side, that's where any titles and texts start.
      // However, this should never happen, because max-width always leaves some
      // space outside to click to close. [4YK8ST2]
      content.style.left = '0px';
    }
    else {
      content.style.left = (winWidth - contentWidth - 4) + 'px';
    }
  },

  hideBackdrop: function() {
    this.setState({ hideBackdrop: true });
  },

  render: function() {
    if (!this.state.moreBundleLoaded)
      return null;

    const props: DropdownProps = this.props;
    let content;
    if (props.show) {
      // Need one more <div> to be able to use float: right for the close [x]? [close_cross_css]
      const closeButton = !props.showCloseButton ? null :
        r.div({ className: 'esDropModal_CloseB esCloseCross', onClick: props.onHide });

      const bottomCloseButton = undefined;
      // COULD LATER UX  show extra close button, if small screen, so won't need to scroll up to
      // the menu top, to find the close button
      //const bottomCloseButton = !props.bottomCloseButton ? null :
      //  r.div({ className: 'esDropModal_CloseB esCloseCross', onClick: props.onHide });

      // Try to remove props.atX & .pullLeft, use betweenX everywhere instead. CLEAN_UP
      let atX = props.atX;
      let atY = props.atY;
      let pullLeft = props.pullLeft;
      if (eds.isRtl) pullLeft = !pullLeft;

      const rect: Rect = props.atRect;
      if (rect) {
        const windowMiddle = props.windowWidth / 2;
        const spaceLeft = windowMiddle - rect.left;
        const spaceRight = rect.right - windowMiddle;
        pullLeft = spaceLeft > spaceRight;
        atX = pullLeft ? rect.left : rect.right;
        atY = rect.bottom;
      }

      // Place at atX, atY.
      const left = pullLeft ? atX : undefined;
      // If atX is too close to the left edge. set it to at least the below, so the dialog
      // won't get too narrow.  UX, COULD set atX more to the left, if the open-dialog-
      // button is far to the left, and the dialog is really narrow — so the dialog
      // won't pop up far to the right of the button. Would need to remember
      // getBoundingClientRect() in the did-update fn? But store in this.state just once,
      // so won't cause some eternal update-setState-update... loop.
      const atXMin = Math.max(atX, 470);
      const right = pullLeft ? undefined : `calc(100% - min(100% - 10px, ${atXMin}px))`;
      const styles = {
        left: left,
        right: right,
        top: atY,
        // Avoid flashing it at the wrong position, before it's been moved to fit on screen.
        visibility: this.state.fitsInDisplay ? 'visible' : 'hidden',
      };

      content =
        r.div({ className: 'esDropModal_content ' + (props.className || ''), style: styles,
            ref: 'content', onClick: props.onContentClick },
          closeButton,
          (props as any).children,
          bottomCloseButton);
    }

    const backdropStyle: any = { opacity: 0.14 };
    if (this.state.hideBackdrop) backdropStyle.display = 'none';

    const dialogClassName = props.dialogClassName2 ? ' ' + props.dialogClassName2 : '';
    const notTooWideClass = props.allowFullWidth ? '' : (props.allowWide ?
                              ' esDropModal-NotSuperWide' : ' esDropModal-NotTooWide');
    const onHide = props.closeOnClickOutside !== false ? props.onHide : undefined;
    return (
      rb.Modal({ show: props.show, onHide,
          onShow: () => this.setState({ hideBackdrop: false }),
          dialogClassName: 'esDropModal' + notTooWideClass + dialogClassName,
          backdropStyle: backdropStyle,
          //
          // Leave this as is, default true? Maybe annoying if anything else gets focused.
          // restoreFocus: true,
          //
          // However, if in an iframe, when restoring the focus, the embedding window jumps
          // down/up so the iframe as much as possible fits in the window  [iframe_jump_bug]
          // — annoying.  Let's try this:
          // https://react-bootstrap.github.io/react-overlays/api/Modal#restoreFocusOptions
          // But doesn't work! Let's comment out for now.
          // restoreFocusOptions: {  preventScroll: true },
        },
        content));
  }
});

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
