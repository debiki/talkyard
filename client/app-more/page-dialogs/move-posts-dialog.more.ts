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

/// <reference path="../utils/PatternInput.more.ts" />
/// <reference path="../util/stupid-dialog.more.ts" />
/// <reference path="../more-prelude.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.pagedialogs {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const ModalHeader = rb.ModalHeader;
const ModalTitle = rb.ModalTitle;
const ModalBody = rb.ModalBody;
const ModalFooter = rb.ModalFooter;
const PatternInput = utils.PatternInput;

let movePostsDialog;


export function openMovePostsDialog(store: Store, post: Post, closeCaller, at: Rect) {
  if (!movePostsDialog) {
    movePostsDialog = ReactDOM.render(MovePostsDialog(), utils.makeMountNode());
  }
  movePostsDialog.open(store, post, closeCaller, at);
}


const MovePostsDialog = createComponent({
  getInitialState: function () {
    return {};
  },

  open: function(store: Store, post: Post, closeCaller, at) {
    this.setState({
      isOpen: true,
      store: store,
      post: post,
      newParentUrl: '',
      closeCaller: closeCaller,
      atRect: at,
      windowWidth: window.innerWidth,
    });
  },

  close: function() {
    this.setState({ isOpen: false, store: null, post: null });
  },

  moveToOtherSection: function() {
    const store: Store = this.state.store;
    const post: Post = this.state.post;
    const otherSectionType =
        post.postType === PostType.BottomComment ? PostType.Normal : PostType.BottomComment;
    Server.changePostType(post.nr, otherSectionType, () => {
      util.openDefaultStupidDialog({
        body: r.div({},
          "Moved. ",
          r.a({ href: `/-${store.currentPageId}#post-${post.nr}` }, "Click here to view"))
      });
    });
  },

  doMove: function() {
    const store: Store = this.state.store;
    const post: Post = this.state.post;
    Server.movePost(post.uniqueId, this.state.newHost, this.state.newPageId,
        this.state.newParentNr, (postAfter: Post) => {
      if (store.currentPageId === this.state.newPageId) {
        // Within the same page, then scroll to the new location.
        // COULD add Back entry, which navigates back to the former parent or any
        // sibling just above.
        ReactActions.scrollAndShowPost(postAfter);
      }
      else {
        // Let the user decide him/herself if s/he wants to open a new page.
        const newPostUrl = '/-' + this.state.newPageId + '#post-' + postAfter.nr;
        util.openDefaultStupidDialog({
          body: r.div({},
            "Moved. ", r.a({ href: newPostUrl }, "Click here to view it."))
        });
      }
      if (this.state.closeCaller) this.state.closeCaller();
      this.close();
    });
  },

  previewNewParent: function() {
    window.open(this.state.newParentUrl);
  },

  render: function () {
    let content;

    if (this.state.isOpen) {
      const store: Store = this.state.store;
      const post: Post = this.state.post;
      const isTopLevelReply = post.parentNr === BodyNr;
      const showMoveToOtherSection = isTopLevelReply;
      const otherSection = post.postType === PostType.BottomComment ? "discussion" : "progress";
      const orSpecify = showMoveToOtherSection ? "Or specify" : "Specify";

      const postPathRegex =
          //  scheme       host        page id           any slug         post nr
          /^((https?:\/\/)?([^/]+))?\/-([a-zA-Z0-9_]+)(\/[a-zA-Z0-9-_]+)?(#post-([0-9]+))?$/;

      content = r.div({},
          !showMoveToOtherSection ? null : r.div({ className: 's_MPD_OtrSct' },
            PrimaryButton({ onClick: (event) => this.moveToOtherSection() },
              `Move to ${otherSection} section`),
            r.span({}, " on this page"),
            r.p({}, "This moves any replies to that other section, too.")),
          // Skip i18n, this is for staff only, right?
          r.p({}, orSpecify + " a new parent post, can be on a different page:"),

          PatternInput({ type: 'text', label: "URL to new parent post:", id: 'te_MvPI',
            help: r.span({}, "Tips: Click the ", r.span({ className: 'icon-link' }), " link " +
              "below the destination post, to copy its URL"),
            onChangeValueOk: (value, ok) => {
              const matches = value.match(postPathRegex);
              if (!matches) {
                this.setState({ ok: false });
                return;
              }
              this.setState({
                newParentUrl: value,
                newHost: matches[3],
                newPageId: matches[4],
                newParentNr: parseInt(matches[7]), // might be null —> the orig post, BodyNr
                ok: ok
              });
            },
            regex: postPathRegex,
            message: "Invalid new parent post link, should be like: " + location.hostname +
                "/-[page_id]#post-[post_nr]" }),
          PrimaryButton({ onClick: this.doMove, disabled: !this.state.ok, className: 'e_MvPB' },
            "Move"),
          Button({ onClick: this.previewNewParent }, "Preview"));
    }

    return (
      utils.DropdownModal({ show: this.state.isOpen, onHide: this.close, showCloseButton: true,
          atRect: this.state.atRect, windowWidth: this.state.windowWidth,
          dialogClassName2: 's_MvPD'   },
        ModalHeader({}, ModalTitle({}, "Move post to where?")),
        ModalBody({}, content),
        ModalFooter({}, Button({ onClick: this.close }, "Cancel"))));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
