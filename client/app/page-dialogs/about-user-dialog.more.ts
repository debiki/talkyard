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

/// <reference path="../slim-bundle.d.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.pagedialogs {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const DropdownModal = utils.DropdownModal;
const Modal = rb.Modal;
const ModalHeader = rb.ModalHeader;
const ModalTitle = rb.ModalTitle;
const ModalBody = rb.ModalBody;
const ModalFooter = rb.ModalFooter;


let aboutUserDialog;


export function getAboutUserDialog() {
  if (!aboutUserDialog) {
    aboutUserDialog = ReactDOM.render(AboutUserDialog(), utils.makeMountNode());
  }
  return aboutUserDialog;
}


const AboutUserDialog = createComponent({
  displayName: 'AboutUserDialog',

  getInitialState: function () {
    return {
      isOpen: false,
      user: null,
      post: null,
      store: ReactStore.allData(),
    };
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  // SECURITY (minor) SHOULD make openForPostAt and openForUser(IdOrUsername) work in the same
  // way, so can block a guest regardless of how one clicks hen's name.  [5JKURQ0]
  openForPostAt: function(post: Post, at) {
    this._openAndLoadUser({ user: null, post: post }, post.authorId, at);
  },

  openForUserIdOrUsername: function(idOrUsername: number | string, at) {
    this._openAndLoadUser({ user: null, post: null }, idOrUsername, at);
  },

  openForUser: function(user: BriefUser, at) {
    // Some code below thinks this is a CompleteUser but a BriefUser is all that's needed.
    this._openAndLoadUser({ user: user, post: null }, user.id, at);
  },

  _openAndLoadUser: function(newState, idOrUsername: number | string, at) {
    const atRect = cloneRect(at.getBoundingClientRect());
    atRect.left -= 90; // makes the dialog a bit more centered
    this.setState({
      isOpen: true,
      blocks: {},
      atRect: atRect,
      windowWidth: window.innerWidth,
      ...newState,
    });
    this.loadUser(idOrUsername);
  },

  close: function() {
    this.setState({ isOpen: false, user: null, post: null, atRect: null, });
  },

  reload: function() {
    this.loadUser(this.state.user.id);
    this.setState({ user: null, blocks: {} });
  },

  loadUser: function(idOrUsername: number | string) {
    Server.loadUserAnyDetails(idOrUsername, (user: MemberInclDetails) => {
      if (this.isGone) return;
      if (!this.state.post) {
        this.setState({ user: user });
        return;
      }
      Server.loadAuthorBlockedInfo(this.state.post.uniqueId, (blocks: Blocks) => {
        if (this.isGone) return;
        // These two are only included in the response for staff.
        let ipBlock;
        let browserBlock;
        _.each(blocks.blocks, (block: Block) => {
          if (block.ip) {
            ipBlock = block;
          }
          if (block.browserIdCookie) {
            browserBlock = block;
          }
        });
        this.setState({
          user: user,
          blocks: {
            isBlocked: blocks.isBlocked,
            ipBlock: ipBlock,
            browserBlock: browserBlock,
            blockedForever: blocks.blockedForever,
            blockedTillMs: blocks.blockedTillMs
          }
        });
      });
    });
  },

  render: function () {
    let content;

    if (this.state.isOpen) {
      const user: MemberInclDetails = this.state.user;
      const childProps = _.assign({
        store: this.state.store,
        reload: this.reload,
        post: this.state.post,
        user: user,
        blocks: this.state.blocks,
        close: this.close,
      }, this.props);

      if (!user) {
        content = r.p({}, 'Loading...');
      }
      else if (isGuest(user)) {
        content = AboutGuest(childProps);
      }
      else {
        content = AboutUser(childProps);
      }

      content = r.div({}, ModalBody({}, content),
        ModalFooter({}, Button({ onClick: this.close }, 'Close')));
    }

    return (
      DropdownModal({ show: this.state.isOpen, onHide: this.close,
        atRect: this.state.atRect, windowWidth: this.state.windowWidth,
        className: 'esUsrDlg', showCloseButton: false }, content));
  }
});


const AboutUser = createComponent({
  displayName: 'AboutUser',

  componentWillMount: function() {
    this.isUnmounted = false;
  },

  componentWillUnmount: function() {
    this.isUnmounted = true;
  },

  removeFromPage: function() {
    const user: MemberInclDetails = this.props.user;
    Server.removeUsersFromPage([user.id], () => {
      if (!this.isUnmounted) this.props.close();
      // [redux] send a page-members patch [5FKE0WY2]
      util.openDefaultStupidDialog({ body: "Now I've removed him/her from this topic. " +
          "Currently you need to refresh the page (hit F5) now, to see this change." })
    });
  },

  render: function() {
    const store: Store = this.props.store;
    const page: Page = store.currentPage;
    const user: MemberInclDetails = this.props.user;
    const me: Myself = store.me;
    const userIsMe = user.id === me.id;

    let isStaffInfo = null;
    if (user.isModerator) {
      isStaffInfo = "Is moderator.";
    }
    if (user.isAdmin) {
      isStaffInfo = "Is administrator.";
    }

    const isGoneInfo = !user_isGone(user) ? null :
      r.p({}, "Is deactivated or deleted.");

    const afterClick = this.props.close;

    const sendMessageButton = !store_maySendDirectMessageTo(store, user) ? null :
        PrimaryLinkButton({ href: linkToSendMessage(user.id), id: 'e2eUD_MessageB', afterClick,
            target: '_blank' },
          t.SendMsg);

    // If in the admin area, typically wants to view the user in the admin area.
    // When not in the admin area, rarely wants to jump directly to the admin area, so skip button?
    const viewInAdminAreaButton = !eds.isInAdminArea ? null :
      LinkButton({ href: linkToUserInAdminArea(user), afterClick,
          target: '_blank' },
        "View in Admin Area");

    const viewProfileButton =
        LinkButton({ href: linkToUserProfilePage(user), id: 'e2eUD_ProfileB', afterClick,
              target: '_blank' },
          "View Profile");

    const userIsPageMember = page_isGroupTalk(page.pageRole) &&
        _.includes(page.pageMemberIds, user.id);
    const removeFromPageButton = userIsPageMember &&
        (isStaff(me) || store_thisIsMyPage(store)) && !userIsMe
      ? Button({ onClick: this.removeFromPage, id: 'e2eUD_RemoveB' }, "Remove from topic")
      : null;

    return (
      r.div({},
        r.div({ className: 'dw-about-user-actions' },
          sendMessageButton,
          viewInAdminAreaButton,
          viewProfileButton,
          removeFromPageButton),
        avatar.Avatar({ user: user, origins: store,
            size: AvatarSize.Medium, clickOpensUserProfilePage: true }),
        r.div({},
          r.b({}, user.username), r.br(),
          user.fullName, r.br(),
          isStaffInfo,
          isGoneInfo)));
  }
});


var AboutGuest = createComponent({
  displayName: 'AboutGuest',

  getInitialState: function() {
    return { isBlockGuestModalOpen: false };
  },

  unblockGuest: function() {
    Server.unblockGuest(this.props.post.uniqueId, () => {
      this.props.reload();
    });
  },

  openBlockGuestModal: function() {
    this.setState({ isBlockGuestModalOpen: true });
  },

  closeBlockGuestModal: function() {
    this.setState({ isBlockGuestModalOpen: false });
  },

  render: function() {
    var store: Store = this.props.store;
    var me: Myself = store.me;
    var guest: Guest = this.props.user;
    var blocks: Blocks = this.props.blocks;
    let post: Post = this.props.post;
    var postId = post ? post.uniqueId : null;

    var blockButton;
    var blockModal;
    // SECURITY (minor) SHOULD show the below Block button also in the forum topic list. (Might need
    // to lookup posts, to find ip number(s) to block?)  [5JKURQ0]
    if (isStaff(me) && postId) {
      if (blocks.isBlocked) {
        blockButton =
          Button({ title: 'Let this guest post comments again', onClick: this.unblockGuest },
            'Unblock');
      }
      else {
        blockButton =
            Button({ title: "Prevent this guest from posting more comments",
                onClick: this.openBlockGuestModal }, "Block or surveil");
      }
      blockModal = BlockGuestDialog({ postId: postId, reload: this.props.reload,
          show: this.state.isBlockGuestModalOpen, close: this.closeBlockGuestModal });
    }

    var blockedInfo;
    if (blocks.isBlocked) {
      var text = 'This guest is blocked ';
      if (blocks.blockedForever) {
        text += 'forever';
      }
      else {
        text += 'until ' + moment(blocks.blockedTillMs).format('YYYY-MM-DD HH:mm');
      }
      blockedInfo =
        r.p({ className: 'dw-guest-blocked' },
          text, r.br(),
          "IP block level: " + threatLevel_toString(blocks.ipBlock.threatLevel), r.br(),
          "Guest id cookie block level: " +
              threatLevel_toString(blocks.browserBlock.threatLevel), r.br());
    }

    var anyCannotBeContactedMessage = guest.isEmailUnknown
        ? r.p({}, "Email address unknown — this guest won't be notified about replies.")
        : null;

    return (
      r.div({ className: 'clearfix' },
        blockModal,
        r.div({ className: 'dw-about-user-actions' },
          LinkButton({ href: linkToUserProfilePage(guest) }, t.aud.ViewComments),
          blockButton),
        r.p({},
          t.NameC + ' ' + guest.fullName, r.br(),
          t.aud.ThisIsGuest),
        anyCannotBeContactedMessage,
        blockedInfo));
  }
});


const BlockGuestDialog = createComponent({
  displayName: 'BlockGuestDialog',

  setThreatLevel: function(threatLevel: ThreatLevel) {
    // Too many conf values = just bad.
    var numDays = 0; // hardcoded server side instead
    /*
    var numDays = parseInt(this.refs.daysInput.getValue());
    if (isNaN(numDays)) {
      alert('Please enter a number');
      return;
    }
    var reason = ''; // this.refs.reasonInput.getValue();
    if (reason.length > 255) {
      alert("At most 255 characters please");
      return;
    }*/
    Server.blockGuest(this.props.postId, numDays, threatLevel, () => {
      this.props.close();
      this.props.reload();
    });
  },

  render: function() {
    return (
      Modal({ show: this.props.show, onHide: this.props.close },
        ModalHeader({}, ModalTitle({}, "Block or surveil guest")),
        ModalBody({},
          r.div({ className: 'form-group' },
            Button({ onClick: () => this.setThreatLevel(ThreatLevel.MildThreat) },
              "Review comments after"),
            r.div({ className: 'help-block' }, "Replies and topics by this guest will be shown " +
              "directly — and they will be added to the moderation queue for review afterwards.")),

          r.div({ className: 'form-group' },
            Button({ onClick: () => this.setThreatLevel(ThreatLevel.ModerateThreat) },
              "Review comments before"),
            r.div({ className: 'help-block' }, "Replies and topics by this guest won't " +
              "be shown until they've been approved by staff. Choose this, if the guest " +
              "has post rather unpolite things that you want to edit or delete before " +
              "anyone else sees it.")),

          r.div({ className: 'form-group' },
            Button({ onClick: () => this.setThreatLevel(ThreatLevel.SevereThreat) },
              "Block completely"),
            r.div({ className: 'help-block' }, "Prevents this guest from posting any comments, " +
              "or casting any votes. But the guest can, however, still sign up and become " +
              "a real member."))
          /*
          Input({ type: 'number', label: 'Block for how many days?', ref: 'daysInput' })
          Input({ type: 'text', label: 'Why block this guest? (Optional)',
              help: "This will be visible to everyone. Keep it short.", ref: 'reasonInput' })),
             */ ),
      ModalFooter({},
          Button({ onClick: this.props.close }, 'Cancel'))));
  }
});

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
