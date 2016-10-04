/*
 * Copyright (C) 2016 Kaj Magnus Lindberg
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
/// <reference path="../ReactStore.ts" />
/// <reference path="../react-elements/name-login-btns.ts" />
/// <reference path="../Server.ts" />
/// <reference path="../utils/utils.ts" />
/// <reference path="../utils/window-zoom-resize-mixin.ts" />
/// <reference path="../avatar/avatar.ts" />
/// <reference path="../avatar/AvatarAndName.ts" />
/// <reference path="discussion.ts" />
/// <reference path="../more-bundle-not-yet-loaded.ts" />
/// <reference path="../editor-bundle-not-yet-loaded.ts" />

//------------------------------------------------------------------------------
   module debiki2.page {
//------------------------------------------------------------------------------

var r = React.DOM;

var EditorBecomeFixedDist = 5;
var DefaultEditorRows = 2;


export var ChatMessages = createComponent({
  componentDidUpdate: function() {
    // We should call onScroll() if a new message gets inserted below the current scroll pos.
    // Simply call it always, instead.
    this.refs.fixedAtBottom.onScroll();
  },

  scrollDown: function() {
    this.refs.titleAndMessages.scrollDown();
  },

  render: function() {
    var store: Store = this.props.store;
    var isChatMember = _.some(store.pageMemberIds, id => id === store.me.id);
    var editorOrJoinButton = isChatMember
        ? ChatMessageEditor({ store: store, scrollDownToViewNewMessage: this.scrollDown })
        : JoinChatButton({});
    return (
      r.div({ className: 'esChatPage dw-page' },
        TitleAndLastChatMessages({ store: store, ref: 'titleAndMessages' }),
        FixedAtBottom({ ref: 'fixedAtBottom' },
          editorOrJoinButton)));
  }
});



var TitleAndLastChatMessages = createComponent({
  getInitialState: function() {
    return {};
  },

  componentDidMount: function() {
    this.scrollDown();
    this.setState({ hasScrolledDown: true });
  },

  componentWillUpdate: function() {
    // Scroll down, if comment added, & we're at the bottom already.
    var pageColumnRect = getPageRect();
    // Add +2 because sometimes .bottom is 0.1 more than the-win-height, for some weird reason.
    this.shallScrollDown = pageColumnRect.bottom <= $(window).height() + 2;
  },

  componentDidUpdate: function() {
    if (this.shallScrollDown) {
      this.scrollDown();
    }
  },

  scrollDown: function() {
    var pageColumn = document.getElementById('esPageColumn');
    pageColumn.scrollTop = pageColumn.scrollHeight;
  },

  render: function () {
    var store: Store = this.props.store;
    var title = Title(store); // later: only if not scrolled down too far

    var originalPost = store.allPosts[store.rootPostId];
    var origPostAuthor = store.usersByIdBrief[originalPost.authorIdInt];
    var headerProps: any = _.clone(store);
    headerProps.post = originalPost;
    var origPostHeader = PostHeader(headerProps); // { store: _, post: _ } would be better?
    var origPostBody = PostBody({ store: store, post: originalPost });
    var canScrollUpToFetchOlder = true;

    var messages = [];
    _.each(store.allPosts, (post: Post) => {
      if (post.postId === TitleId || post.postId === BodyId) {
        // We show the title & body elsewhere.
        return;
      }
      if (post.isPostDeleted) {
        messages.push(DeletedChatMessage({ key: post.uniqueId, store: store, post: post }));
        return;
      }
      if (post.postId === FirstReplyNr) {
        // (COULD make this work also if post nr FirstReplyNr has been moved to another page
        // and hence will never be found. Fix by scrolling up, noticing that nothing was found,
        // and remove the you-can-scroll-up indicator?)
        canScrollUpToFetchOlder = false;
      }
      messages.push(
        ChatMessage({ key: post.uniqueId, store: store, post: post }));
    });

    var thisIsTheWhat =
        r.p({},
          "This is the " + ReactStore.getPageTitle() + " chat channel, created by ",
          avatar.AvatarAndName({ user: origPostAuthor, hideAvatar: true }),
          ", ", timeExact(originalPost.createdAtMs));

    var perhapsHidden;
    if (!this.state.hasScrolledDown) {
      // Avoid flash of earlier messages before scrolling to end.
      perhapsHidden = { display: 'none' };
    }

    var scrollUpTips = !canScrollUpToFetchOlder ? false :
      r.div({ className: 'esChat_scrollUpTips' },
        "Scroll up to view older comments", r.br(), "(Not implemented though. So don't)");

    return (
      r.div({ className: 'esLastChatMsgs', style: perhapsHidden },
        title,
        r.div({ className: 'esChatChnl_about'},
          thisIsTheWhat,
          r.div({}, "Purpose:"),
          origPostBody),
        scrollUpTips,
        messages));
  }
});



var ChatMessage = createComponent({
  getInitialState: function() {
    return { isEditing: false };
  },

  edit: function() {
    this.setState({ isEditing: true });
    var post: Post = this.props.post;
    editor.openEditorToEditPost(post.postId, (wasSaved, text) => {
      this.setState({ isEditing: false });
    });
  },

  delete_: function() {
    morebundle.openDeletePostDialog(this.props.post);
  },

  render: function () {
    var state = this.state;
    var store: Store = this.props.store;
    var me: Myself = store.me;
    var post: Post = this.props.post;
    var author: BriefUser = store.usersByIdBrief[post.authorId];
    var headerProps: any = _.clone(store);
    headerProps.post = post;
    headerProps.isFlat = true;
    headerProps.exactTime = true;
    headerProps.stuffToAppend = (me.id !== author.id || state.isEditing) ? [] :
      [r.button({ className: 'esC_M_EdB icon-edit', key: 'e', onClick: this.edit }, "edit"),
        // (Don't show a trash icon, makes the page look too cluttered.)
        r.button({className: 'esC_M_EdB', key: 'd', onClick: this.delete_ }, "delete")];
    //headerProps.stuffToAppend.push(
    //  r.button({ className: 'esC_M_MoreB icon-ellipsis', key: 'm' }, "more"));
    return (
      r.div({ className: 'esC_M', id: 'post-' + post.postId },
        avatar.Avatar({ user: author }),
        PostHeader(headerProps), // { store: _, post: _, ... } would be better?
        PostBody({ store: store, post: post })));
  }
});



function DeletedChatMessage(props) {
  var post: Post = props.post;
  return (
    r.div({ className: 'esC_M', id: 'post-' + post.postId, key: props.key },
      r.div({ className: 'dw-p-bd' },
        r.div({ className: 'dw-p-bd-blk' },
          "(Message deleted)"))));
}



var FixedAtBottom = createComponent({
  mixins: [utils.PageScrollMixin, utils.WindowZoomResizeMixin],

  getInitialState: function() {
    return { fixed: false, bottom: 0 };
  },

  componentDidMount: function() {
    // Currently we always scroll to the bottom, when opening a chat channel.
    // Later: setState fixed: true, if going back to a chat channel when one has scrolled up.
  },

  onWindowZoomOrResize: function() {
    this.onScroll();
  },

  onScroll: function() {
    var pageBottom = getPageRect().bottom;
    var scrollableBottom = $(window).height();
    var myNewBottom = pageBottom - scrollableBottom;
    this.setState({ bottom: myNewBottom });
    if (!this.state.fixed) {
      if (pageBottom > scrollableBottom + EditorBecomeFixedDist) {
        this.setState({ fixed: true });
      }
    }
    else {
      // Add +X otherwise sometimes the fixed state won't vanish although back at top of page.
      if (pageBottom - scrollableBottom <= +2) {
        this.setState({ fixed: false, bottom: 0 });
      }
    }
  },

  render: function () {
    var offsetBottomStyle;
    if (this.state.fixed) {
      offsetBottomStyle = { bottom: this.state.bottom };
    }
    return (
      r.div({ className: 'esFixAtBottom', style: offsetBottomStyle },
        React.cloneElement(this.props.children, {
          refreshFixedAtBottom: this.onScroll,
        })));
  }
});



var JoinChatButton = createComponent({
  componentWillUnmount: function() {
    this.isUnmounted = true;
  },

  joinChannel: function() {
    morebundle.loginIfNeededReturnToAnchor(LoginReason.LoginToChat, '#theJoinChatB', () => {
      if (this.isUnmounted) {
        // Now after having logged in, this join chat button got removed (unmounted) — that's
        // because we've joined the chat already (some time long ago). So, need do nothing, now.
        return;
      }
      Server.joinChatChannel();
    });
  },

  render: function() {
    return (
      r.div({ className: 'esJoinChat' },
        PrimaryButton({ id: 'theJoinChatB', className: 'esJoinChat_btn',
            onClick: this.joinChannel },
          "Join this chat")));
  }
});



var ChatMessageEditor = createComponent({
  getInitialState: function() {
    return {
      text: '',
      rows: DefaultEditorRows,
      advancedEditorInstead: false,
    };
  },

  componentDidMount: function() {
    Server.loadEditorEtcScriptsAndLater(() => {
      if (this.isUnmounted) return;
      editor.startMentionsParser(this.refs.textarea, this.onTextEdited);
    });
  },

  componentWillUnmount: function() {
    this.isUnmounted = true;
  },

  onTextEdited: function(event) {
    this.updateText(event.target.value);
  },

  updateText: function(text) {
    // numLines won't work with wrapped lines, oh well, fix some other day.
    // COULD use https://github.com/andreypopp/react-textarea-autosize instead.
    var numLines = text.split(/\r\n|\r|\n/).length;
    this.setState({
      text: text,
      rows: Math.max(DefaultEditorRows, Math.min(8, numLines)),
    });
    // In case lines were deleted, we need to move the editor a bit downwards, so it
    // remains fixed at the bottom — because now it's smaller.
    if (this.props.refreshFixedAtBottom) {
      // In case the advanced editor is currently shown, use setTimeout() so we'll
      // refresh after the current render phase.
      setTimeout(() => {
        if (!this.isMounted()) return;
        this.props.refreshFixedAtBottom();
      }, 0);
    }
  },

  onKeyDown: function(event) {
    // In my Chrome, Ctrl + Enter won't fire onKeyPress (only onKeyDown) [5KU8W2], and won't append
    // any newline. Why? Append the newline ourselves.
    if (event_isCtrlEnter(event)) {
      this.setState({ text: this.state.text + '\n' });
      // Prevent FF, Edge, Safari from adding yet another newline in onKeyPress().
      event.preventDefault();
    }
  },

  onKeyPress: function(event) {
    if (event_isEnter(event) && !event_isCtrlEnter(event) && !event_isShiftEnter(event)) {
      // Enter or Return without Shift or Ctrl down means "post chat message".
      var isNotEmpty = /\S/.test(this.state.text);
      if (isNotEmpty) {
        this.saveChatMessage();
        event.preventDefault();
      }
    }
  },

  saveChatMessage: function() {
    this.setState({ isSaving: true });
    Server.insertChatMessage(this.state.text, () => {
      if (!this.isMounted()) return;
      this.setState({ text: '', isSaving: false, rows: DefaultEditorRows });
      this.refs.textarea.focus();
      this.props.scrollDownToViewNewMessage();
    });
  },

  useAdvancedEditor: function() {
    this.setState({ advancedEditorInstead: true });
    editor.openToWriteChatMessage(this.state.text, (wasSaved, text) => {
      // Now the advanced editor has been closed.
      this.setState({
        advancedEditorInstead: false,
      });
      this.updateText(wasSaved ? '' : text);
      if (wasSaved) {
        this.props.scrollDownToViewNewMessage();
      }
    });
  },

  render: function () {
    if (this.state.advancedEditorInstead)
      return null;

    var disabled = this.state.isLoading || this.state.isSaving;
    var buttons =
        r.div({ className: 'esC_Edtr_Bs' },
          r.button({ className: 'esC_Edtr_SaveB btn btn-primary', onClick: this.saveChatMessage,
              disabled: disabled },
            "↵ Post message"),
          r.button({ className: 'esC_Edtr_AdvB btn btn-default', onClick: this.useAdvancedEditor,
              disabled: disabled },
            "Advanced editor"));

    return (
      r.div({ className: 'esC_Edtr' },
        r.textarea({ className: 'esC_Edtr_textarea', ref: 'textarea',
          value: this.state.text, onChange: this.onTextEdited,
          onKeyPress: this.onKeyPress,
          onKeyDown: this.onKeyDown,
          placeholder: "Type here. You can use Markdown and HTML.",
          disabled: disabled,
          rows: this.state.rows }),
        buttons));
  }
});

// Staying at the bottom: http://blog.vjeux.com/2013/javascript/scroll-position-with-react.html

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
