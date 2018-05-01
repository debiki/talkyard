/*
 * Copyright (c) 2016, 2017 Kaj Magnus Lindberg
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
   namespace debiki2.page {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;

const EditorBecomeFixedDist = 5;
const DefaultEditorRows = 2;


export const ChatMessages = createComponent({
  displayName: 'ChatMessages',

  componentDidUpdate: function() {
    // We should call onScroll() if a new message gets inserted below the current scroll pos.
    // Simply call it always, instead.
    this.refs.fixedAtBottom.onScroll();
  },

  scrollDown: function() {
    this.refs.titleAndMessages.scrollDown();
  },

  render: function() {
    const store: Store = this.props.store;
    const isChatMember = _.some(store.currentPage.pageMemberIds, id => id === store.me.id);
    const editorOrJoinButton = isChatMember
        ? ChatMessageEditor({ store: store, scrollDownToViewNewMessage: this.scrollDown })
        : JoinChatButton({});
    return (
      r.div({ className: 'esChatPage dw-page', id: 't_PageContent' },
        TitleAndLastChatMessages({ store: store, ref: 'titleAndMessages' }),
        FixedAtBottom({ ref: 'fixedAtBottom' },
          editorOrJoinButton)));
  }
});



const TitleAndLastChatMessages = createComponent({
  displayName: 'TitleAndLastChatMessages',

  getInitialState: function() {
    return {};
  },

  componentDidMount: function() {
    this.scrollDown();
    this.setState({ hasScrolledDown: true });
  },

  componentWillUpdate: function() {
    // Scroll down, if comment added, & we're at the bottom already.
    const pageColumnRect = getPageRect();
    // Add +2 because sometimes .bottom is 0.1 more than the-win-height, for some weird reason.
    this.shallScrollDown = pageColumnRect.bottom <= window.innerHeight + 2;
  },

  componentDidUpdate: function() {
    if (this.shallScrollDown) {
      this.scrollDown();
    }
  },

  scrollDown: function() {
    const pageColumn = document.getElementById('esPageColumn');
    pageColumn.scrollTop = pageColumn.scrollHeight;
  },

  render: function () {
    const store: Store = this.props.store;
    const page: Page = store.currentPage;
    const title = Title({ store }); // later: only if not scrolled down too far

    const originalPost = page.postsByNr[store.rootPostId];
    const origPostAuthor = store.usersByIdBrief[originalPost.authorId];
    const origPostHeader = PostHeader({ store, post: originalPost });
    const origPostBody = PostBody({ store, post: originalPost });
    let canScrollUpToFetchOlder = true;

    const messages = [];
    _.each(page.postsByNr, (post: Post) => {
      if (post.nr === TitleNr || post.nr === BodyNr) {
        // We show the title & body elsewhere.
        return;
      }
      if (post.isPostDeleted) {
        messages.push(DeletedChatMessage({ key: post.uniqueId, store: store, post: post }));
        return;
      }
      if (post.nr === FirstReplyNr) {
        // (COULD make this work also if post nr FirstReplyNr has been moved to another page
        // and hence will never be found. Fix by scrolling up, noticing that nothing was found,
        // and remove the you-can-scroll-up indicator?)
        canScrollUpToFetchOlder = false;
      }
      const postProps = { key: post.uniqueId, store, post };
      const postElem =
          post.postType === PostType.MetaMessage ? MetaPost(postProps) : ChatMessage(postProps);
      messages.push(postElem);
    });

    if (!messages.length) {
      canScrollUpToFetchOlder = false;
    }

    const thisIsTheWhat =
        r.p({},
          t.c.About_1 + ReactStore.getPageTitle() + t.c.About_2,
          avatar.AvatarAndName({ user: origPostAuthor, hideAvatar: true }),
          ", ", timeExact(originalPost.createdAtMs));

    let perhapsHidden;
    if (!this.state.hasScrolledDown) {
      // Avoid flash of earlier messages before scrolling to end.
      perhapsHidden = { display: 'none' };
    }

    const scrollUpTips = !canScrollUpToFetchOlder ? null :
      r.div({ className: 'esChat_scrollUpTips' },
        t.c.ScrollUpViewComments, r.br(), t.NotImplemented);

    return (
      r.div({ className: 'esLastChatMsgs', style: perhapsHidden },
        title,
        r.div({ className: 'esChatChnl_about'},
          thisIsTheWhat,
          r.div({}, t.c.Purpose),
          origPostBody),
        scrollUpTips,
        messages));
  }
});



const ChatMessage = createComponent({
  displayName: 'ChatMessage',

  getInitialState: function() {
    return { isEditing: false };
  },

  edit: function() {
    this.setState({ isEditing: true });
    const post: Post = this.props.post;
    editor.openEditorToEditPost(post.nr, (wasSaved, text) => {
      this.setState({ isEditing: false });
    });
  },

  delete_: function(event) {
    morebundle.openDeletePostDialog(this.props.post, cloneEventTargetRect(event));
  },

  render: function () {
    const state = this.state;
    const store: Store = this.props.store;
    const me: Myself = store.me;
    const post: Post = this.props.post;
    const author: BriefUser = store.usersByIdBrief[post.authorId];
    const headerProps: any = { store, post };
    headerProps.isFlat = true;
    headerProps.exactTime = true;

    const isMine = me.id === author.id;
    const isMineClass = isMine ? ' s_My' : '';
    const mayEditDelete = post.postType === PostType.ChatMessage && !state.isEditing && (
        isMine || isStaff(me));
    headerProps.stuffToAppend = !mayEditDelete ? [] : [
        r.button({ className: 'esC_M_EdB icon-edit' + isMineClass, key: 'e', onClick: this.edit },
          t.c.edit),
        // (Don't show a trash icon, makes the page look too cluttered.)
        r.button({className: 'esC_M_EdB' + isMineClass, key: 'd', onClick: this.delete_ }, t.c.delete)];

    //headerProps.stuffToAppend.push(
    //  r.button({ className: 'esC_M_MoreB icon-ellipsis', key: 'm' }, "more"));
    return (
      r.div({ className: 'esC_M', id: 'post-' + post.nr },
        avatar.Avatar({ user: author, size: AvatarSize.Small }),
        PostHeader(headerProps),
        PostBody({ store: store, post: post })));
  }
});



function DeletedChatMessage(props) {
  const post: Post = props.post;
  return (
    r.div({ className: 'esC_M', id: 'post-' + post.nr, key: props.key },
      r.div({ className: 'dw-p-bd' },
        r.div({ className: 'dw-p-bd-blk' },
          t.c.MessageDeleted))));
}



const FixedAtBottom = createComponent({
  displayName: 'FixedAtBottom',
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
    const pageBottom = getPageRect().bottom;
    const scrollableBottom = window.innerHeight;
    const myNewBottom = pageBottom - scrollableBottom;
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
    let offsetBottomStyle;
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



const JoinChatButton = createComponent({
  displayName: 'JoinChatButton',

  componentWillUnmount: function() {
    this.isGone = true;
  },

  joinChannel: function() {
    login.loginIfNeededReturnToAnchor(LoginReason.LoginToChat, '#theJoinChatB', () => {
      if (this.isGone) {
        // Now after having logged in, this join chat button got removed (unmounted) — that's
        // because we've joined the chat already (some time long ago). So, need do nothing, now.
        return;
      }
      Server.joinPage();
    });
  },

  render: function() {
    return (
      r.div({ className: 'esJoinChat' },
        PrimaryButton({ id: 'theJoinChatB', className: 'esJoinChat_btn',
            onClick: this.joinChannel },
          t.c.JoinThisChat)));
  }
});



const ChatMessageEditor = createComponent({
  displayName: 'ChatMessageEditor',

  getInitialState: function() {
    return {
      text: '',
      rows: DefaultEditorRows,
      advancedEditorInstead: false,
    };
  },

  componentDidMount: function() {
    Server.loadEditorAndMoreBundles(() => {
      if (this.isGone) return;
      this.setState({ scriptsLoaded: true });
    });
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  onTextEdited: function(event) {
    this.updateText(event.target.value);
  },

  updateText: function(text) {
    // numLines won't work with wrapped lines, oh well, fix some other day.
    // COULD use https://github.com/andreypopp/react-textarea-autosize instead.
    const numLines = text.split(/\r\n|\r|\n/).length;
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
        if (this.isGone) return;
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
      const isNotEmpty = /\S/.test(this.state.text);
      if (isNotEmpty) {
        this.saveChatMessage();
        event.preventDefault();
      }
    }
  },

  saveChatMessage: function() {
    this.setState({ isSaving: true });
    Server.insertChatMessage(this.state.text, () => {
      if (this.isGone) return;
      this.setState({ text: '', isSaving: false, rows: DefaultEditorRows });
      this.props.scrollDownToViewNewMessage();
      // no such fn: this.refs.textarea.focus();
      // instead, for now:
      $first('.rta textarea').focus();
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
    if (this.state.advancedEditorInstead || !this.state.scriptsLoaded)
      return null;

    const disabled = this.state.isLoading || this.state.isSaving;
    const buttons =
        r.div({ className: 'esC_Edtr_Bs' },
          r.button({ className: 'esC_Edtr_SaveB btn btn-primary', onClick: this.saveChatMessage,
              disabled: disabled },
            '↵ ' + t.c.PostMessage),
          r.button({ className: 'esC_Edtr_AdvB btn btn-default', onClick: this.useAdvancedEditor,
              disabled: disabled },
            t.c.AdvancedEditor));

    // In the editor scripts bundle, lazy loaded.
    const ReactTextareaAutocomplete = editor['ReactTextareaAutocomplete'];
    const listUsernamesTrigger = editor['listUsernamesTrigger'];

    return (
      r.div({ className: 'esC_Edtr' },
        // The @mentions username autocomplete might overflow the textarea. [J7UKFBW]
        ReactTextareaAutocomplete({ className: 'esC_Edtr_textarea', ref: 'textarea',
          value: this.state.text, onChange: this.onTextEdited,
          onKeyPress: this.onKeyPress,
          onKeyDown: this.onKeyDown,
          closeOnClickOutside: true,
          placeholder: t.c.TypeHere,
          disabled: disabled,
          rows: this.state.rows,
          loadingComponent: () => r.span({}, t.Loading),
          trigger: listUsernamesTrigger }),
        buttons));
  }
});

// Staying at the bottom: http://blog.vjeux.com/2013/javascript/scroll-position-with-react.html

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
