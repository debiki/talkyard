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

/// <reference path="../more-prelude.more.ts" />

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


interface AboutUserDialogState {
  store?: Store;
  isOpen?: boolean;
  user?: UserDetailsStatsGroups;
  groupsMaySee?: Group[];
  post?: Post;
  blocks?: any;
  extraInfo?: string;
  atRect?: Rect;
  windowWidth?: number;
}


const AboutUserDialog = createComponent({
  displayName: 'AboutUserDialog',

  getInitialState: function(): AboutUserDialogState {
    return {
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

  openForUserIdOrUsername: function(idOrUsername: number | string, at, extraInfo?: string) {
    this._openAndLoadUser({ user: null, post: null, extraInfo }, idOrUsername, at);
  },

  openForUser: function(user: BriefUser, at, extraInfo?: string) {
    // Some code below thinks this is a CompleteUser but a BriefUser is all that's needed.
    this._openAndLoadUser({ user: user, post: null, extraInfo }, user.id, at);
  },

  _openAndLoadUser: function(newState: AboutUserDialogState, idOrUsername: number | string, at) {
    const atRect = cloneRect(at.getBoundingClientRect());
    atRect.left -= 90; // makes the dialog a bit more centered
    const newState2: AboutUserDialogState = {
      isOpen: true,
      blocks: {},
      atRect: atRect,
      windowWidth: window.innerWidth,
      ...newState,
    };
    this.setState(newState2);
    this.loadUser(idOrUsername);
  },

  close: function() {
    const nextState: AboutUserDialogState = {
      isOpen: false,
      user: null,
      post: null,
      atRect: null,
      extraInfo: null,
    };
    this.setState(nextState);
  },

  reload: function() {
    this.loadUser(this.state.user.id);
    this.setState({ user: null, blocks: {} });
  },

  loadUser: function(idOrUsername: number | string) {
    Server.loadUserAnyDetails(idOrUsername,
          (user: UserDetailsStatsGroups, groupsMaySee: Group[]) => {
      if (this.isGone) return;
      const nextState: AboutUserDialogState = {
        user,
        groupsMaySee,
      };
      if (!this.state.post) {
        this.setState(nextState);
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
        nextState.blocks = {
          isBlocked: blocks.isBlocked,
          ipBlock: ipBlock,
          browserBlock: browserBlock,
          blockedForever: blocks.blockedForever,
          blockedTillMs: blocks.blockedTillMs
        };
        this.setState(nextState);
      });
    });
  },

  render: function () {
    const state: AboutUserDialogState = this.state;
    let content;

    if (state.isOpen) {
      const user: UserInclDetails = state.user;
      const childProps = _.assign({
        store: state.store,
        reload: this.reload,
        post: state.post,
        user: user,
        groupsMaySee: state.groupsMaySee,
        extraInfo: state.extraInfo,
        blocks: state.blocks,
        close: this.close,
      }, this.props);

      if (!user) {
        content = r.p({}, t.Loading);
      }
      else if (isGuest(user)) {
        content = AboutGuest(childProps);
      }
      else {
        content = AboutUser(childProps);
      }

      content = r.div({}, ModalBody({}, content),
        ModalFooter({}, Button({ className: 'e_CloseB', onClick: this.close }, t.Close)));
    }

    return (
      DropdownModal({ show: state.isOpen, onHide: this.close,
        dialogClassName2: 's_UD',
        atRect: state.atRect, windowWidth: state.windowWidth,
        className: 'esUsrDlg', showCloseButton: false }, content));
  }
});


const AboutUser = createComponent({
  displayName: 'AboutUser',

  componentWillUnmount: function() {
    this.isGone = true;
  },

  removeFromPage: function() {
    const user: UserInclDetails = this.props.user;
    Server.removeUsersFromPage([user.id], () => {

      // [redux] send a page-members patch [5FKE0WY2]
      util.openDefaultStupidDialog({ body: "Now I've removed him/her from this topic. " +
          "Currently you need to refresh the page (hit F5) now, to see this change." })

      if (this.isGone) return;
      this.props.close();
    });
  },

  render: function() {
    const store: Store = this.props.store;
    const page: Page = store.currentPage;
    const user: UserDetailsStatsGroups = this.props.user;
    const groupsMaySee: Group[] = this.props.groupsMaySee;
    const me: Myself = store.me;
    const userIsMe = user.id === me.id;

    let isStaffInfo = null;
    if (user.isModerator) {
      isStaffInfo = t.aud.IsMod;
    }
    if (user.isAdmin) {
      isStaffInfo = t.aud.IsAdm;
    }

    const isGoneInfo = !user_isGone(user) ? null :
      r.p({}, t.aud.IsDeld);

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
        t.aud.ViewInAdm);

    const viewProfileButton =
        LinkButton({ href: linkToUserProfilePage(user), id: 'e2eUD_ProfileB', afterClick,
              target: '_blank' },
          t.aud.ViewProfl);

    const userIsPageMember = page_isGroupTalk(page.pageRole) &&
        _.includes(page.pageMemberIds, user.id);
    const removeFromPageButton = userIsPageMember &&
        (isStaff(me) || store_thisIsMyPage(store)) && !userIsMe
      ? Button({ onClick: this.removeFromPage, id: 'e2eUD_RemoveB' }, t.aud.RmFromTpc)
      : null;

    const extraInfoNewline =
        this.props.extraInfo ? r.div({ className: 's_UD_ExtrInf' }, this.props.extraInfo) : null;

    const groupList = GroupList(
        user, groupsMaySee, 's_UP_Ab_Stats_Stat_Groups_Group',  // COULD rename css class
        // `false`: Use r.a() not a Link() because we're not inside a React Router.
        // UX COULD place all dialog roots inside the router elem, so Link() will work?
        false);

    return (
      r.div({ 'data-username': user.username },
        r.div({ className: 'dw-about-user-actions' },
          sendMessageButton,
          viewInAdminAreaButton,
          viewProfileButton,
          removeFromPageButton),
        avatar.Avatar({ user: user, origins: store,
            size: AvatarSize.Medium, clickOpensUserProfilePage: true }),
        r.div({},
          extraInfoNewline,
          r.b({ className: 's_UD_Un' }, user.username), r.br(),
          r.span({ className: 's_UD_FN' }, user.fullName), r.br(),
          isStaffInfo,
          isGoneInfo),
        r.div({ className: 's_UD_BelwAv' },  // "below avatar"
          AnyUserEmail(user, me),
          r.div({ className: 's_UP_Gs' },
            t.GroupsC, groupList))
        ));
  }
});


const AboutGuest = createComponent({
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
    const store: Store = this.props.store;
    const me: Myself = store.me;
    const guest: Guest = this.props.user;
    const blocks: Blocks = this.props.blocks;
    const post: Post = this.props.post;
    const postId = post ? post.uniqueId : null;

    let blockButton;
    let blockModal;
    // SECURITY (minor) SHOULD show the below Block button also in the forum topic list. (Might need
    // to lookup posts, to find ip number(s) to block?)  [5JKURQ0]
    if (isStaff(me) && postId) {
      if (blocks.isBlocked) {
        blockButton =  // (skip i18n, is for staff)
          Button({ title: "Let this guest post comments again", onClick: this.unblockGuest },
            "Unblock");
      }
      else {
        blockButton =  // (skip i18n, is for staff)
            Button({ title: "Prevent this guest from posting more comments",
                onClick: this.openBlockGuestModal }, "Block or surveil");
      }
      blockModal = BlockGuestDialog({ postId: postId, reload: this.props.reload,
          show: this.state.isBlockGuestModalOpen, close: this.closeBlockGuestModal });
    }

    // Skip i18n; this is for staff.
    let blockedInfo;
    if (blocks.isBlocked) {
      let text = "This guest is blocked ";
      if (blocks.blockedForever) {
        text += "forever";
      }
      else {
        text += "until " + moment(blocks.blockedTillMs).format('YYYY-MM-DD HH:mm');
      }
      blockedInfo =
        r.p({ className: 'dw-guest-blocked' },
          text, r.br(),
          "IP block level: " + threatLevel_toString(blocks.ipBlock.threatLevel), r.br(),
          "Guest id cookie block level: " +
              threatLevel_toString(blocks.browserBlock.threatLevel), r.br());
    }

    const anyCannotBeContactedMessage = guest.isEmailUnknown
        ? r.p({}, t.aud.EmAdrUnkn)
        : null;

    return (
      r.div({ className: 'clearfix' },
        blockModal,
        r.div({ className: 'dw-about-user-actions' },
          LinkButton({ href: linkToUserProfilePage(guest) }, t.aud.ViewComments),
          blockButton),
        r.p({},
          t.NameC + ' ' + guest.fullName, r.br(),
          t.aud.ThisIsGuest,
          AnyUserEmail(guest, me)),
        anyCannotBeContactedMessage,
        blockedInfo));
  }
});


const BlockGuestDialog = createComponent({
  displayName: 'BlockGuestDialog',

  setThreatLevel: function(threatLevel: ThreatLevel) {
    // Too many conf values = just bad.
    const numDays = 0; // hardcoded server side instead
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
    // Skip i18n; this is for staff.

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
          Button({ onClick: this.props.close }, "Cancel"))));
  }
});


function AnyUserEmail(user: { email?: string }, me: Myself) {
  return !me.isAdmin || !user.email ? null : (
      r.div({ className: 's_UD_Em' },
        t.EmailC || (t.cud.EmailC + ' '),
        // Don't use an <a href="mailto:..."> — it's better to encourage people
        // to use the built-in messaging system? And also annoying when some
        // email program starts, if clicking the email just to copy it.
        r.samp({}, user.email),
        OnlyAdminsSee));
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
