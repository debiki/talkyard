/*
 * Copyright (C) 2015 Kaj Magnus Lindberg (born 1979)
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
/// <reference path="../../typedefs/modernizr/modernizr.d.ts" />
/// <reference path="../plain-old-javascript.d.ts" />
/// <reference path="../utils/react-utils.ts" />
/// <reference path="../model.ts" />
/// <reference path="../Server.ts" />

//------------------------------------------------------------------------------
   module debiki2.editor {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var Button = reactCreateFactory(ReactBootstrap.Button);
var theEditor: any;
var $: any = window['jQuery'];
var NoPostId = -1; // also in reply.js


function ensureEditorCreated(success) {
  if (theEditor) {
    success();
  }
  else {
    d.i.loadEditorEtceteraScripts().done(() => {
      theEditor = React.render(Editor({}), utils.makeMountNode());
      success();
    });
  }
}


export function toggleWriteReplyToPost(postId: number, anyPostType?: number) {
  ensureEditorCreated(() => {
    theEditor.toggleWriteReplyToPost(postId, anyPostType);
  });
}


export function openEditorToEditPost(postId: number) {
  ensureEditorCreated(() => {
    theEditor.editPost(postId);
  });
}


export function editNewForumPage(categoryId: number, role: PageRole) {
  ensureEditorCreated(() => {
    theEditor.editNewForumPage(categoryId, role);
  });
}


export var Editor = createComponent({
  getInitialState: function() {
    return {
      visible: false,
      text: '',
      draft: '',
      safePreviewHtml: '',
      replyToPostIds: [],
      newForumTopicCategoryId: null,
      newForumPageRole: null,
      guidelines: null,
      isUploadingFile: false,
      fileUploadProgress: 0,
      uploadFileXhr: null,
    };
  },

  componentWillMount: function() {
     this.updatePreview = _.debounce(this.updatePreview, 333);
  },

  componentDidMount: function() {
    this.startMentionsParser();
    this.makeEditorResizable();
    this.createDropFileTarget();
  },

  startMentionsParser: function() {
    $(this.refs.textarea.getDOMNode()).atwho({
      at: "@",
      search_key: 'username',
      tpl: "<li data-value='${atwho-at}${username}'>${username} (${fullName})</li>",
      callbacks: {
        remote_filter: (prefix, callback) => {
          Server.listUsernames(prefix, callback);
        }
      }
    });
  },

  makeEditorResizable: function() {
    if (d.i.isInEmbeddedEditor) {
      // The iframe is resizable instead.
      return;
    }
    var placeholder = $(this.refs.placeholder.getDOMNode());
    var editor = $(this.refs.editor.getDOMNode());
    editor.css('border-top', '8px solid hsl(0, 0%, 74%)');
    editor.resizable({
      direction: ['top'],
      resize: function() {
        placeholder.height(editor.height());
      }
    });
  },

  createDropFileTarget: function() {
    var thisComponent = this;
    this.setState({
      dropzone: new window['Dropzone'](this.refs.textarea.getDOMNode(), {
        url: '/-/upload-public-file',
        uploadMultiple: false, // only one at a time, so we know which checksum is for which file
        maxFilesize: ReactStore.allData().maxUploadSizeBytes * 1.0 / 1000 / 1000, // megabytes
        clickable: false, // a click instead positions the cursor in the textarea
        init: function() {
          this.on('sending', (file, xhr, formData) => {
            xhr.setRequestHeader('X-XSRF-TOKEN', $.cookie('XSRF-TOKEN'));
            thisComponent.showUploadProgress(0);
            thisComponent.setState({ uploadFileXhr: xhr });
          });
          this.on('error', (file, errorMessage, xhr) => {
            thisComponent.setState({ uploadFileXhr: null });
            if (xhr) {
              pagedialogs.getServerErrorDialog().open("Error uploading file: ", xhr);
            }
            else {
              die("Error uploading file: " + errorMessage + " [DwE5JKW2]");
            }
          });
          this.on('uploadprogress', (file, percent, bytesSent) => {
            thisComponent.showUploadProgress(percent);
          });
          this.on('complete', thisComponent.hideUploadProgress);
          this.on('canceled', thisComponent.hideUploadProgress);
          this.on('success', (file, relativePath) => {
            dieIf(!_.isString(relativePath), 'DwE06MF22');
            var linkHtml = thisComponent.makeUploadLink(file, relativePath);
            thisComponent.setState({
              text: thisComponent.state.text + '\n' + linkHtml,
            });
            // Scroll down so people will see the new line we just appended.
            scrollToBottom(thisComponent.refs.textarea.getDOMNode());
            thisComponent.updatePreview(function() {
              // This happens to early, not sure why. So wait for a while.
              setTimeout(function() {
                scrollToBottom(thisComponent.refs.preview.getDOMNode());
              }, 800);
            });
          });
        }
      })
    });
  },

  cancelUpload: function() {
    if (this.state.uploadFileXhr) {
      this.state.uploadFileXhr.abort();
    }
    else {
      console.warn("Cannot cancel upload: No this.state.uploadFileXhr [DwE8UMW2]");
    }
  },

  showUploadProgress: function(percent) {
    if (percent === 0) {
      pagedialogs.getProgressBarDialog().open("Uploading...", this.cancelUpload);
    }
    else {
      pagedialogs.getProgressBarDialog().setDonePercent(percent);
    }
    this.setState({
      isUploadingFile: true,
      fileUploadProgress: percent,
    });
  },

  hideUploadProgress: function() {
    pagedialogs.getProgressBarDialog().close();
    this.setState({
      uploadFileXhr: null,
      isUploadingFile: false,
      fileUploadProgress: 0,
    });
  },

  makeUploadLink: function(file, relativePath) {
    // The relative path is like 'a/b/c...zwq.suffix' = safe, and we got it from the server.
    dieIf(!relativePath.match(/^[0-9a-z/\.]+$/),
        "Bad image relative path: " + relativePath + " [DwE8PUMW2]");

    var parts = relativePath.split('.');
    var suffix = parts.length > 1 ? _.last(parts) : '';

    // (SVG doesn't work in old browsers, fine. tif doesn't work for me.)
    var isImage = suffix === 'png' || suffix === 'jpg' || suffix === 'gif' ||
        suffix === 'mpo' || suffix === 'bmp' || suffix === 'svg';

    // Only .mp4 is supported by all browsers.
    var isVideo = suffix === 'mp4' || suffix === 'ogg' || suffix === 'webm';

    var url = '/-/uploads/public/' + relativePath;

    var link;
    if (isImage) {
      link = '<img src="' + url + '"></img>';
    }
    else if (isVideo) {
      link = '<video width="490" height="400" controls src="' + url + '"></video>';
    }
    else {
      link = '<a href="' + url + '">' + file.name + '</a> (' + prettyBytes(file.size) + ')';
    }
    return link;
  },

  toggleWriteReplyToPost: function(postId: number, anyPostType?: number) {
    if (this.alertBadState('WriteReply'))
      return;
    var postIds = this.state.replyToPostIds;
    var index = postIds.indexOf(postId);
    if (index === -1) {
      postIds.push(postId);
      this.showEditor();
    }
    else {
      postIds.splice(index, 1);
    }
    // Don't change post type from flat to something else.
    var postType = anyPostType;
    if (postIds.length >= 2 && this.state.anyPostType === PostType.Flat) {
      postType = PostType.Flat;
    }
    this.setState({
      anyPostType: postType,
      replyToPostIds: postIds,
      text: this.state.text ? this.state.text : this.state.draft
    });
    if (!postIds.length) {
      this.closeEditor();
    }
    var writingWhat = WritingWhat.ReplyToNotOriginalPost;
    if (_.isEqual([BodyId], postIds)) writingWhat = WritingWhat.ReplyToOriginalPost;
    else if (_.isEqual([NoPostId], postIds)) writingWhat = WritingWhat.ChatComment;
    this.loadGuidelines(writingWhat);
  },

  editPost: function(postId: number) {
    if (this.alertBadState())
      return;
    Server.loadCurrentPostText(postId, (text: string) => {
      this.showEditor();
      this.setState({
        anyPostType: null,
        editingPostId: postId,
        text: text
      });
      this.updatePreview();
    });
  },

  editNewForumPage: function(categoryId: number, role: PageRole) {
    if (this.alertBadState())
      return;
    this.showEditor();
    var text = this.state.text || this.state.draft;
    this.setState({
      anyPostType: null,
      newForumTopicCategoryId: categoryId,
      newForumPageRole: role,
      text: text
    });
    this.loadGuidelines(WritingWhat.NewPage, categoryId, role);
    this.updatePreview();
  },

  alertBadState: function(wantsToDoWhat = null) {
    if (wantsToDoWhat !== 'WriteReply' && this.state.replyToPostIds.length > 0) {
      alert('Please first finish writing your post');
      return true;
    }
    if (_.isNumber(this.state.editingPostId)) {
      alert('Please first save your current edits');
      // If this is an embedded editor, for an embedded comments page, that page
      // will now have highlighted some reply button to indicate a reply is
      // being written. But that's wrong, clear those marks.
      if (d.i.isInEmbeddedEditor) {
        window.parent.postMessage(
          JSON.stringify(['clearIsReplyingMarks', {}]), '*');
      }
      else {
        d.i.clearIsReplyingMarks();
      }
      return true;
    }
    if (this.state.newForumPageRole) {
      alert("Please first either save or cancel your new forum topic");
      d.i.clearIsReplyingMarks();
      return true;
    }
    return false;
  },

  loadGuidelines: function(writingWhat: WritingWhat, categoryId?: number, pageRole?: PageRole) {
    var theCategoryId = categoryId || ReactStore.allData().categoryId;
    var thePageRole = pageRole || ReactStore.allData().pageRole;
    var currentGuidelines = this.state.guidelines;
    if (currentGuidelines &&
        currentGuidelines.categoryId === theCategoryId &&
        currentGuidelines.pageRole === thePageRole &&
        currentGuidelines.writingWhat === writingWhat)
      return;

    // Currently there are no drafts, only guidelines.
    Server.loadDraftAndGuidelines(writingWhat, theCategoryId, thePageRole, guidelinesSafeHtml => {
      if (!guidelinesSafeHtml) {
        this.setState({ guidelines: null });
        return;
      }
      var guidelinesHash = hashStringToNumber(guidelinesSafeHtml);
      var hiddenGuidelinesHashes = getFromLocalStorage('dwHiddenGuidelinesHashes') || {};
      var isHidden = hiddenGuidelinesHashes[guidelinesHash];
      this.setState({
        guidelines: {
          writingWhat: writingWhat,
          categoryId: theCategoryId,
          pageRole: thePageRole,
          safeHtml: guidelinesSafeHtml,
          hidden: isHidden,
        }
      });
    });
  },

  // Remembers that these guidelines have been hidden, by storing a hash of the text in localStorage.
  // So, if the guidelines get changed, they'll be shown again (good). COULD delete old hashes if
  // we end up storing > 100? hashes?
  hideGuideline: function() {
    var guidelines = this.state.guidelines;
    guidelines.hidden = true;
    this.setState(guidelines);
    var hash = hashStringToNumber(guidelines.safeHtml);
    var hiddenGuidelinesHashes = getFromLocalStorage('dwHiddenGuidelinesHashes') || {};
    hiddenGuidelinesHashes[hash] = true;
    putInLocalStorage('dwHiddenGuidelinesHashes', hiddenGuidelinesHashes);
  },

  showGuideline: function() {
    var guidelines = this.state.guidelines;
    guidelines.hidden = false;
    this.setState(guidelines);
    // Leave hidden on page reload? I.e. don't update localStorage.
  },

  onTextEdited: function(event) {
    this.setState({
      text: event.target.value
    });
    this.updatePreview();
  },

  updatePreview: function(anyCallback) {
    if (!this.isMounted())
      return;

    // (COULD verify still edits same post/thing, or not needed?)
    var isEditingBody = this.state.editingPostId === d.i.BodyId;
    var sanitizerOpts = {
      allowClassAndIdAttr: isEditingBody,
      allowDataAttr: isEditingBody
    };
    var htmlText = d.i.markdownToSafeHtml(this.state.text, window.location.host, sanitizerOpts);
    this.setState({
      safePreviewHtml: htmlText
    }, anyCallback);
  },

  onCancelClick: function() {
    this.closeEditor();
  },

  onSaveClick: function() {
    if (this.state.newForumPageRole) {
      this.saveNewForumPage();
    }
    else if (_.isNumber(this.state.editingPostId)) {
      this.saveEdits();
    }
    else {
      this.saveNewPost();
    }
  },

  saveEdits: function() {
    Server.saveEdits(this.state.editingPostId, this.state.text, () => {
      this.clearText();
      this.closeEditor();
    });
  },

  saveNewPost: function() {
    Server.saveReply(this.state.replyToPostIds, this.state.text, this.state.anyPostType, () => {
      this.clearText();
      this.closeEditor();
    });
  },

  saveNewForumPage: function() {
    var title = $(this.refs.titleInput.getDOMNode()).val();
    var data = {
      categoryId: this.state.newForumTopicCategoryId,
      pageRole: this.state.newForumPageRole,
      pageStatus: 'Published',
      pageTitle: title,
      pageBody: this.state.text
    };
    Server.createPage(data, (newPageId: string) => {
      this.clearText();
      window.location.assign('/-' + newPageId);
    });
  },

  showEditor: function() {
    this.setState({ visible: true });
    if (d.i.isInEmbeddedEditor) {
      window.parent.postMessage(JSON.stringify(['showEditor', {}]), '*');
    }
  },

  closeEditor: function() {
    this.setState({
      visible: false,
      replyToPostIds: [],
      editingPostId: null,
      newForumTopicCategoryId: null,
      newForumPageRole: null,
      text: '',
      draft: _.isNumber(this.state.editingPostId) ? '' : this.state.text,
      safePreviewHtml: '',
      guidelines: null,
    });
    // Remove any is-replying highlights.
    if (d.i.isInEmbeddedEditor) {
      window.parent.postMessage(JSON.stringify(['hideEditor', {}]), '*');
    }
    else {
      // (Old jQuery code.)
      $('.dw-replying').removeClass('dw-replying');
    }
  },

  clearText: function() {
    this.setState({ text: null, draft: null });
  },

  render: function() {
    var titleInput;
    var state = this.state;

    var guidelines = state.guidelines;
    var guidelinesElem;
    var showGuidelinesBtn;
    if (guidelines && guidelines.safeHtml) {
      if (guidelines.hidden) {
        showGuidelinesBtn =
          r.a({ className: 'icon-info-circled', onClick: this.showGuideline });
      }
      else {
        guidelinesElem =
          r.div({ className: 'dw-editor-guidelines-wrap' },
            r.div({ className: 'dw-editor-guidelines clearfix' },
              r.div({ className: 'dw-editor-guidelines-text',
                dangerouslySetInnerHTML: { __html: this.state.guidelines.safeHtml }}),
              r.a({ className: 'icon-cancel dw-hide', onClick: this.hideGuideline }, "Hide")));
      }
    }

    var titlePlaceholder;
    var youCanUse = "You can use Markdown and HTML.";
    var textareaPlaceholder = "Type here. " + youCanUse;
    if (this.state.newForumPageRole) {
      titleInput =
          r.input({ className: 'title-input form-control', type: 'text', ref: 'titleInput',
              key: this.state.newForumPageRole,
              placeholder: "What is this about, in one brief sentence?" });
    }

    var doingWhatInfo;
    var editingPostId = this.state.editingPostId;
    var replyToPostIds = this.state.replyToPostIds;
    var isChatComment = replyToPostIds.length === 1 && replyToPostIds[0] === NoPostId;
    var isChatReply = replyToPostIds.indexOf(NoPostId) !== -1 && !isChatComment;
    if (_.isNumber(editingPostId)) {
      doingWhatInfo =
        r.span({},
          'Edit ', r.a({ href: '#post-' + editingPostId }, 'post ' + editingPostId + ':'));
    }
    else if (this.state.newForumPageRole) {
      var what = "Create new topic";
      switch (this.state.newForumPageRole) {
        case PageRole.HomePage: what = "Create a custom HTML page (add your own <h1> title)"; break;
        case PageRole.WebPage: what = "Create an info page"; break;
        case PageRole.Code: what = "Create a source code page"; break;
        case PageRole.SpecialContent: die('DwE5KPVW2'); break;
        case PageRole.EmbeddedComments: die('DwE2WCCP8'); break;
        case PageRole.Blog: die('DwE2WQB9'); break;
        case PageRole.Forum: die('DwE5JKF9'); break;
        case PageRole.About: die('DwE1WTFW8'); break;
        case PageRole.Question: what = "Ask a question"; break;
        case PageRole.Problem: what = "Report a problem"; break;
        case PageRole.Idea: what = "Suggest an idea"; break;
        case PageRole.ToDo: what = "Create a todo"; break;
        case PageRole.MindMap: what = "Create a mind map page"; break;
        case PageRole.Discussion: break; // use default
        case PageRole.Critique: // [plugin]
          what = "Ask for critique";
          textareaPlaceholder = "Here, enter a link to your work, and tell people " +
              "what you want feedback about. \n" + youCanUse;
          break;
      }
      doingWhatInfo = what + ":";
    }
    else if (replyToPostIds.length === 0) {
      doingWhatInfo = 'Please select one or more posts to reply to.';
    }
    else if (isChatComment) {
      doingWhatInfo = "New chat comment:";
    }
    else if (_.isEqual([BodyId], replyToPostIds) && isCritiquePage()) { // [plugin]
      doingWhatInfo = "Your critique:";
    }
    else if (replyToPostIds.length > 0) {
      doingWhatInfo =
        r.span({},
          isChatReply ? 'Chat reply to ' : 'Reply to ',
          _.filter(replyToPostIds, (id) => id !== NoPostId).map((postId, index) => {
            var anyAnd = index > 0 ? ' and ' : '';
            var whichPost = postId === 1 ? 'the Original Post' : 'post ' + postId;
            return (
              r.span({ key: postId },
                anyAnd,
                r.a({ href: '#post-' + postId }, whichPost)));
          }),
          ':');
    }

    var saveButtonTitle = 'Save';
    if (_.isNumber(this.state.editingPostId)) {
      saveButtonTitle = 'Save edits';
    }
    else if (replyToPostIds.length) {
      if (isChatComment) {
        saveButtonTitle = "Post comment";
      }
      else {
        saveButtonTitle = "Post reply";
      }
    }
    else if (this.state.newForumPageRole) {
      saveButtonTitle = 'Create topic';
    }

    // If not visible, don't remove the editor, just hide it, so we won't have
    // to unrigister the mentions parser (that would be boring).
    var styles = {
      display: this.state.visible ? 'block' : 'none'
    };

    // Make space for the soft keyboard on touch devices.
    var maxHeightCss = !Modernizr.touch || debiki2.utils.isMouseDetected ? undefined : {
      maxHeight: screen.height / 2.5
    };

    var textarea =
        r.textarea({ className: 'editor form-control', ref: 'textarea', value: this.state.text,
            onChange: this.onTextEdited, placeholder: textareaPlaceholder });

    return (
      r.div({ style: styles },
        r.div({ id: 'debiki-editor-placeholder', ref: 'placeholder' }),
        r.div({ id: 'debiki-editor-controller', ref: 'editor', style: maxHeightCss },
          guidelinesElem,
          r.div({ id: 'editor-after-borders' },
            r.div({ className: 'editor-area' },
              r.div({ className: 'editor-area-after-borders' },
                r.div({ className: 'dw-doing-what' },
                  doingWhatInfo, showGuidelinesBtn),
                titleInput,
                r.div({ className: 'editor-wrapper' },
                  textarea))),
            r.div({ className: 'preview-area' },
              r.div({}, titleInput ? 'Preview: (title excluded)' : 'Preview:'),
              r.div({ className: 'preview', ref: 'preview',
                  dangerouslySetInnerHTML: { __html: this.state.safePreviewHtml }})),
            r.div({ className: 'submit-cancel-btns' },
              Button({ onClick: this.onSaveClick }, saveButtonTitle),
              Button({ onClick: this.onCancelClick }, 'Cancel'))))));
  }
});


function isCritiquePage(): boolean {  // [plugin]
  return ReactStore.allData().pageRole === PageRole.Critique;
}


var newCategoryPlaceholderText =
    "Replace this first paragraph with a short description of this category.\n" +
    "Please keep it short — the text will appear on the category list page.]\n" +
    "\n" +
    "Here, after the first paragraph, you can add a longer description, with\n" +
    "for example category guidelines or rules.\n" +
    "\n" +
    "Below in the comments section, you can discuss this category. For example,\n" +
    "should it be merged with another category? Or should it be split\n" +
    "into many categories?\n";


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
