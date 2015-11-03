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

/// <reference path="../../typedefs/react/react.d.ts" />
/// <reference path="../plain-old-javascript.d.ts" />
/// <reference path="../utils/react-utils.ts" />
/// <reference path="../ReactStore.ts" />
/// <reference path="../Server.ts" />

//------------------------------------------------------------------------------
   module debiki2.pagedialogs {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var Button = reactCreateFactory(ReactBootstrap.Button);
var Input = reactCreateFactory(ReactBootstrap.Input);
var Modal = reactCreateFactory(ReactBootstrap.Modal);
var ModalHeader = reactCreateFactory(ReactBootstrap.ModalHeader);
var ModalTitle = reactCreateFactory(ReactBootstrap.ModalTitle);
var ModalBody = reactCreateFactory(ReactBootstrap.ModalBody);
var ModalFooter = reactCreateFactory(ReactBootstrap.ModalFooter);


var aboutUserDialog;


export function getAboutUserDialog() {
  if (!aboutUserDialog) {
    aboutUserDialog = React.render(AboutUserDialog(), utils.makeMountNode());
  }
  return aboutUserDialog;
}


var AboutUserDialog = createComponent({
  getInitialState: function () {
    return {
      isOpen: false,
      user: null,
      post: null,
      loggedInUser: debiki2.ReactStore.getUser()
    };
  },

  open: function(post: Post) {
    this.setState({ isOpen: true, user: null, post: post, blocks: {} });
    this.loadUser(post.authorId);
  },

  openForUser: function(user: BriefUser) {
    // Some code below thinks this is a CompleteUser but a BriefUser is all that's needed.
    this.setState({ isOpen: true, user: user, post: null, blocks: {} });
  },

  close: function() {
    this.setState({ isOpen: false, user: null, post: null });
  },

  reload: function() {
    this.loadUser(this.state.user.id);
    this.setState({ user: null, blocks: {} });
  },

  loadUser: function(userId: number) {
    Server.loadCompleteUser(userId, (user: CompleteUser) => {
      if (!this.isMounted()) return;
      if (!this.state.post) {
        this.setState({ user: user });
        return;
      }
      Server.loadAuthorBlockedInfo(this.state.post.uniqueId, (blocks: Blocks) => {
        if (!this.isMounted()) return;
        // These two are only included in the response for staff.
        var ipBlock;
        var browserBlock;
        _.each(blocks.blocks, (block: Block) => {
          if (block.ip) {
            ipBlock = block;
          }
          if (block.browserIdCookie) {
            browserBlock = block;
          }
        })
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

  viewUserProfile: function() {
    window.location.assign('/-/users/#/id/' + this.state.user.id);
  },

  render: function () {
    var title;
    var content;

    if (this.state.isOpen) {
      var user: CompleteUser = this.state.user;
      var childProps = $.extend({
        reload: this.reload,
        loggedInUser: this.state.loggedInUser,
        post: this.state.post,
        user: user,
        viewUserProfile: this.viewUserProfile,
        blocks: this.state.blocks
      }, this.props);

      if (!user) {
        content = r.p({}, 'Loading...');
      }
      else if (isGuest(user)) {
        content = AboutGuest(childProps);
        title = 'About Guest';
      }
      else {
        content = AboutUser(childProps);
        title = 'About User';
      }
    }

    return (
      Modal({ show: this.state.isOpen, onHide: this.close },
        ModalHeader({}, ModalTitle({}, title)),
        ModalBody({}, content,
        ModalFooter({}, Button({ onClick: this.close }, 'Close')))));
  }
});


var AboutUser = createComponent({
  render: function() {
    var user: CompleteUser = this.props.user;

    var isStaffInfo = null;
    if (user.isModerator) {
      isStaffInfo = 'Is moderator.';
    }
    if (user.isAdmin) {
      isStaffInfo = 'Is administrator.';
    }

    return (
      r.div({},
        r.div({ className: 'dw-about-user-actions' },
          Button({ onClick: this.props.viewUserProfile }, 'View Profile')),
        r.p({},
          'Username: ' + user.username, r.br(),
          'Name: ' + user.fullName, r.br(),
          isStaffInfo)));
  }
});


var AboutGuest = createComponent({
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
    var guest: Guest = this.props.user;
    var loggedInUser: User = this.props.loggedInUser;
    var blocks: Blocks = this.props.blocks;
    var postId = this.props.post ? this.props.post.uniqueId : null;

    var blockButton;
    var blockModal;
    if (loggedInUser.isAdmin && postId) {
      if (blocks.isBlocked) {
        blockButton =
          Button({ title: 'Let this guest post comments again', onClick: this.unblockGuest },
            'Unblock');
      }
      else {
        blockButton =
            Button({ title: "Prevent this guest from posting more comments",
                onClick: this.openBlockGuestModal }, 'Block This Guest');
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
      var reason = blocks.reason ? blocks.reason : '(unspecified)';
      blockedInfo =
        r.p({ className: 'dw-guest-blocked' },
          text, r.br());
          // 'Reason: ' + reason);
    }

    var anyCannotBeContactedMessage = guest.isEmailUnknown
        ? r.p({}, "Email address unknown — this guest won't be notified about replies.")
        : null;

    return (
      r.div({ className: 'clearfix' },
        blockModal,
        r.div({ className: 'dw-about-user-actions' },
          Button({ onClick: this.props.viewUserProfile }, 'View Other Comments'),
          blockButton),
        r.p({},
          'Name: ' + guest.fullName, r.br(),
          'This is a guest user. He or she could in fact be just anyone.'),
        anyCannotBeContactedMessage,
        blockedInfo));
  }
});


var BlockGuestDialog = createComponent({
  doBlock: function() {
    var numDays = parseInt(this.refs.daysInput.getValue());
    if (isNaN(numDays)) {
      alert('Please enter a number');
      return;
    }
    var reason = ''; // this.refs.reasonInput.getValue();
    if (reason.length > 255) {
      alert("At most 255 characters please");
      return;
    }
    Server.blockGuest(this.props.postId, numDays, () => {
      this.props.close();
      this.props.reload();
    });
  },

  render: function() {
    return (
      Modal({ show: this.props.show, onHide: this.props.close },
        ModalHeader({}, ModalTitle({}, "Block Guest")),
        ModalBody({},
          r.p({}, "Once blocked, this guest cannot post any comments or like any posts. " +
            "He or she can, however, still authenticate himself / herself " +
            "and sign up as a real user."),
          Input({ type: 'number', label: 'Block for how many days?', ref: 'daysInput' })
          /*
          Input({ type: 'text', label: 'Why block this guest? (Optional)',
              help: "This will be visible to everyone. Keep it short.", ref: 'reasonInput' })),
             */ ),
      ModalFooter({},
          Button({ onClick: this.doBlock }, 'Block'),
          Button({ onClick: this.props.close }, 'Cancel'))));
  }
});

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
