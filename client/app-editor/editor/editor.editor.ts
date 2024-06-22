/*
 * Copyright (c) 2015-2021 Kaj Magnus Lindberg
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

/// <reference path="../editor-prelude.editor.ts" />
/// <reference path="./formatting-help.editor.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.editor {
//------------------------------------------------------------------------------

const d = { i: debiki.internal };
const r = ReactDOMFactories;
let FileAPI;

let theEditor: any;


// rta supports multichar triggers (v3.1.1), and can use a custom
// component instead of a <textarea> (v4.2.0).
// Oh it's actually a bit problematic:   [rta_overfl_top_bgfx]  — places the
// username autocomplete off-screen somewhat easily.
//
// Switch to ProseMirror instead + CommmonMark plugin:
//   https://prosemirror.net/examples/markdown/
// and listen for '@...' and then pop up Ty's DropdownModal but not-modal-mode.
// Also, then can [convert_html_to_commonmark].
//
export const ReactTextareaAutocomplete =
        reactCreateFactory(window['ReactTextareaAutocomplete']);


export function getOrCreateEditor(success) {
  if (theEditor) {
    success(theEditor);
  }
  else {
    // These might not be available until now, because scripts loaded in parallel (order = undefined).
    FileAPI = window['FileAPI'];
    theEditor = ReactDOM.render(Editor({}), utils.makeMountNode());
    success(theEditor);
  }
}


// Helps with handling '@username...' responses from the server in the right order.
let listUsernamesCount = 0;

export const listUsernamesTrigger = {

  // Mentions.
  '@': {
    dataProvider: (charsTyped: St) => {
      listUsernamesCount += 1;
      const curCount = listUsernamesCount;
      return new Promise(function (resolve, reject) {
        const pageId = ReactStore.getPageId();
        if (!pageId || pageId === EmptyPageId) {
          // This is an embedded comments discussion, but there are no comments, so the
          // discussion has not yet been lazy-created. So search among users, for now.
          // UX maybe one *always* wants to search among all users? Unless if is chat channel?
          Server.listAllUsernames(charsTyped, handleOrRejectUsernames);
        }
        else {
          // One probably wants to mention someone participating in the current discussion = page?
          // So search among those users only.
          Server.listUsernames(charsTyped, pageId, handleOrRejectUsernames);
        }
        function handleOrRejectUsernames(usernames: BriefUser[]) {
          if (listUsernamesCount > curCount) {
            // This response is stale, from an old request. Wait for the
            // most recent request to get a response instead.
            reject();
          }
          else {
            resolve(usernames);
          }
        }
      })
    },
    component: ({ entity: { id, username, fullName, mayMention }}) => {
      const text = `${username} (${fullName})`;
      return mayMention !== false
          ? r.div({}, text)
          : r.div({ className: 'c_Disabled',
                    onClick: (event) => event.stopPropagation() }, // [mention_disabled]
              // Later: Show any  pats_t.why_may_not_mention_msg_me_html_c  info here.
              text, r.i({}, "  — mentions disabled"));    // I18N
    },
    output: (item, trigger) => {
      // Also see: [mentions_prio]
      if (item.mayMention === false) {
        // Then skip the '@' so this won't becoem a @mention.
        return item.username;
      }
      return '@' + item.username;
    },
  },

  // Emojis. List: https://unicode.org/emoji/charts/full-emoji-list.html
  // but what's the name of each emoji?  Different apps make up their own names?
  // The official names like "Slightly smiling face" are too long, right.
  // Or use those long names, + fuzzy search? Instead of prefix search?
  // Could use for shortcuts too. [fuzzy_select]
  ':': {
    dataProvider: (charsTyped: St) => [
      // Why won't this Unicode char render properly? Not supported in Debian 9?
      //{ name: 'smile', char: '🙂' },  // &#x1F642;  Slightly smiling face
      { name: 'zmile', char: '🙂' },    // just testing — if typing  ':z...'
    ].filter(it => it.name.startsWith(charsTyped)),
    component: ({ entity: { name, char } }) => r.div({}, name + ': ' + char),
    output: (item, trigger) => item.char,
  },
};



interface EditorState {
  inFrame?: DiscWin,
  inFrameStore?: DiscStore;
  store: Store;
  visible: boolean;
  replyToPostNrs: PostNr[];
  anyPostType?: PostType;
  doAsAnon?: MaybeAnon;
  myAliasOpts?: MaybeAnon[]
  discProps?: DiscPropsDerived;
  authorId?: PatId; // remove?
  editorsCategories?: Category[];
  editorsPageId?: PageId;
  editingPostNr?: PostNr;
  editingPostUid?: PostId;  // CLEAN_UP RENAME to ...PostId not ...Uid
  isWritingChatMessage?: boolean;
  messageToUserIds: UserId[],
  newForumTopicCategoryId?: CategoryId;
  newPageRole?: PageType;
  editingPostRevisionNr?: number;
  text: string;
  caretPos: Nr;
  title: string;
  showTitleErrors?: boolean;
  showTextErrors?: boolean;
  draftStatus: DraftStatus;
  draft?: Draft;
  draftErrorStatusCode?: number;
  safePreviewHtml: string;
  // [showPreviewWhere]: Maybe change & reuse UiPrefsIninePreviews somehow?
  onDone?:  EditsDoneHandler;
  guidelines?: Guidelines;
  showGuidelinesInModal?: boolean;
  backdropOpacity: 0,
  isUploadingFile: boolean;
  uploadCancelled?: Bo;
  fileUploadProgress: number;
  uploadFileXhr?: any;
  showSimilarTopics?: boolean;
  searchResults?: any;

  showMinimized?: boolean;
  showOnlyPreview?: boolean;
  canPlaceLeft?: Bo;  // undef means false
  placeLeft?: Bo;
  showMaximized?: boolean;
  splitHorizontally?: boolean;
}


interface Guidelines {
  writingWhat: WritingWhat,
  categoryId: CategoryId;
  pageRole: PageType;
  safeHtml: string;
  hidden: boolean;
}



export const Editor = createFactory<any, EditorState>({
  displayName: 'Editor',
  mixins: [debiki2.StoreListenerMixin],

  getInitialState: function(): EditorState {
    const state: EditorState = {
      store: debiki2.ReactStore.allData(),
      // For now, remember "forever" (until page reload), simpler.
      canPlaceLeft: window.innerWidth >= WinDims.MinEditorLeftWidth && !eds.isInIframe,
      visible: false,
      text: '',
      caretPos: 0,
      title: '',
      draftStatus: DraftStatus.NotLoaded,
      safePreviewHtml: '',
      replyToPostNrs: [],
      messageToUserIds: [],
      backdropOpacity: 0,
      isUploadingFile: false,
      fileUploadProgress: 0,
      uploadFileXhr: null,
    };
    return state;
  },


  getDiscStore(): DiscStore {
    const state: EditorState = this.state;
    return state.inFrameStore || state.store; // [many_embcom_iframes]
  },


  /// This is part of making the embedded editor work with many comment iframes
  /// at the same time. We clone the relevant discussion data, from the
  /// relevant embedded comments iframe. — If we're not in embedded iframes,
  /// we just return the React store of the current window as is (which is then
  /// the top window).
  ///
  getOrCloneDiscStore(inFrame?: DiscWin): DiscStore {
    if (!eds.isInIframe) {
      // @ifdef DEBUG
      dieIf(inFrame, 'TyE507MWEG25');
      dieIf(window.top !== window, 'TyE6WMLE25');
      // Should be in sync because of the debiki2.StoreListenerMixin.
      // (I wonder if some race cond could make them different for a millisec?)
      dieIf(this.state.store !== debiki2.ReactStore.allData(), 'TyE50MREJ35');
      // @endif
      return debiki2.ReactStore.allData();
    }

    // @ifdef DEBUG
    dieIf(!inFrame && !this.state.inFrame, 'TyE604RMJ46');
    // @endif

    // `inFrame` is sometimes available before this.state has been updated, so
    // try to use it first.
    const state: EditorState = this.state;
    const discFrameStore: Partial<DiscStore> =
        inFrame?.theStore || (    // [ONESTORE]  [many_embcom_iframes]
              state.inFrame ? state.inFrame.theStore : (
                  // This'd be weird, would mean the comments iframe was deleted
                  // by external javascript? See below [.72JM6]
                  win_getSessWinStore()));

    // `discFrameStore` is from another iframe — clone it. And if it's from the session
    // iframe [.72JM6], add empty maps and lists for users and pages (this
    // would be weird, but maybe can happen if buggy javascript on the embedd*ing*
    // page deletes a comments iframe. Then it's nice if Talkyard continues
    // working as best it can without showing errors?).
    //
    // Why clone? So as not to 1) hold on to data from another iframe and thereby
    // maybe preventing data in that other iframe from being freed. Maybe not needed,
    // since this isn't html tags, just variables, but let's clone just in case.
    // And 2) so that the data won't get changed at any time by code in the other iframe
    // — React.js wouldn't like that.
    //
    let storeClone: DiscStore;
    try {
      storeClone = _.cloneDeep({
        me: discFrameStore.me,
        embeddedOriginOrEmpty: discFrameStore.embeddedOriginOrEmpty,
        currentPage: discFrameStore.currentPage,
        currentPageId: discFrameStore.currentPageId,
        currentCategories: discFrameStore.currentCategories,
        curCatsById: {}, // updated below (actually not needed? feels better, oh well)
        usersByIdBrief: discFrameStore.usersByIdBrief || {},
        pagesById: {},  // updated below
      });
      storeClone.curCatsById = groupByKeepOne(storeClone.currentCategories, c => c.id);
    }
    catch (ex) {
      // Don't think this can happen, but let's wait and see for a while?
      // DO_AFTER 2022-01-01 unwrap from try-catch (remvoe this catch {}).
      if (!this.loggedCloneError) {
        logW("Couldn't clone store in other iframe [TyECLONSTOR]", ex);
        // @ifdef DEBUG
        debugger;
        // @endif
        this.loggedCloneError = true;
      }
      storeClone = state.store;
    }

    // We show the embedded editor for one discussion at a time, so we need
    // the current page, only.
    if (storeClone.currentPage) {
      // @ifdef DEBUG
      dieIf(storeClone.currentPage.pageId !== storeClone.currentPageId, 'TyE507MWEG27')
      // @endif
      storeClone.pagesById[storeClone.currentPageId] = storeClone.currentPage;
    }

    return storeClone;
  },


  onChange: function() {
    this.setState({ store: debiki2.ReactStore.allData() });
  },


  onManualScroll: function() {
    // Then stop auto scrolling.
    // Start again, if pat clicks the Show Preview button?
    delete this.scrollToPreview;
  },


  UNSAFE_componentWillMount: function() {
    // Sync delay w e2e test. Dupl code. [upd_ed_pv_delay]
    this.updatePreviewSoon = _.debounce(this.updatePreviewNow, 333);

    this.saveDraftSoon = _.debounce(() => {
      if (this.isGone || !this.state.visible) return;
      this.saveDraftNow();  // [7AKBJ42]
    }, 2022);

    this.searchForSimilarTopicsSoon = _.debounce(this.searchForSimilarTopicsNow, 1800);
  },


  componentDidMount: function() {
    // Minor BUG: resizing .dw-comments to adjust for the textarea doesn't work. (5YKQ27)
    this.columns = $all('#esPageColumn, #esWatchbarColumn, #dw-sidebar .dw-comments');
    this.makeEditorResizable();
    this.initUploadFileStuff();
    this.perhapsShowGuidelineModal();
    window.addEventListener('unload', this.saveDraftUseBeacon);

    // Let's process Ctrl+V and paste events to upload file events, regargless of
    // what's in focus? And instead show a tips if pat focuses the obviously wrong
    // thing?  E.g. tries to paste an image in the search field?  See this.onPaste().
    window.addEventListener('paste', this.onPaste, false);

    Bliss.bind(window, {
      'touchmove wheel': this.onManualScroll,
    });

    // Don't scroll the main discussion area, when scrolling inside the editor.
    /* Oops this breaks scrolling in the editor and preview.
    $(this.refs.editor).on('scroll touchmove mousewheel', function(event) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    }); */
  },


  componentDidUpdate: function(prevProps, prevState: EditorState) {
    const state: EditorState = this.state;
    this.perhapsShowGuidelineModal();
    this.reserveSpaceForEditor(prevState);

    // If the preview is show inline (in the page where the reply will appear / in the
    // post we're editing), and we click Maximize, then, there's not yet any preview
    // in the *editor*, and e.g. external link previews would be missing.
    // So, then, need to update any preview in the editor.
    // COULD_OPTIMIZE: Skip if preview already shown in editor (rather than in page).
    //
    // Maybe remember this.[showPreviewWhere] in a field,
    // where: 1 = none, 2 = in editor, 3 = in page?  4 both — could actually be nice
    // on a wide screen, then, one would see the post one is replying to, the editor,
    // and a preview of one's reply — all at the same time. And could scroll own in the page,
    // and see precisely how one's reply will look, once submitted.
    //
    if (!prevState.showMaximized && state.showMaximized && state.visible) {
      this.updatePreviewSoon();
      // Maybe postpone  talkyard.postElemPostProcessor(..) below until aftewards?
    }

    if (talkyard.postElemPostProcessor &&
          prevState.safePreviewHtml !== state.safePreviewHtml) {
      talkyard.postElemPostProcessor('t_E_Preview');
    }
  },


  componentWillUnmount: function() {
    this.isGone = true;
    logD("Editor: componentWillUnmount");
    window.removeEventListener('unload', this.saveDraftUseBeacon);
    window.removeEventListener('paste', this.onPaste);
    Bliss.unbind(window, {
      'touchmove wheel': this.onManualScroll,
    });
    this.saveDraftNow();
  },


  focusInputFields: function() {
    let elemToFocus = this.titleElm || this.textareaElm;
    if (elemToFocus) {
      elemToFocus.focus();
    }
  },


  makeEditorResizable: function() {
    if (eds.isInEmbeddedEditor) {
      // The iframe is resizable instead. [RESEMBEDTR]
      return;
    }
    this.stopResizeUp = util.makeResizableUp(this.refs.editor, this.refs.resizeHandle,
          this.adjustSpaceAtBottomForEditor);
  },


  reserveSpaceForEditor: function(prevState: EditorState) {
    if (this.isGone) return;
    const state: EditorState = this.state;

    // Reserve (or hand back) space to the left, or at the bottom.
    let reserveLeft: Bo | U;
    let returnLeft: Bo | U;
    let reserveBottom: Bo | U;
    let returnBottom: Bo | U;

    const prev = prevState;
    const now = state;

    const becameVisible = !prev.visible && now.visible;
    const becameUnminimized = prev.showMinimized && !now.showMinimized;
    const becameVisOrUnmin = becameVisible || becameUnminimized;
    // Became minimized? — See the `if` just below.

    if (prev.visible && !now.visible ||
        !prev.showMinimized && now.showMinimized) {
      // No longer shown, so make the page and sidebars full size again.
      // (Hmm, maybe should keep some space at the bottom? No, not needed — it's ok
      // if the un-minimize button occludes the bottom of the footer.)
      returnLeft = true;
      returnBottom = true;
    }
    else if (now.placeLeft && (!prev.placeLeft || becameVisOrUnmin)) {
      reserveLeft = true;
      returnBottom = true;
    }
    else {
      if (prev.placeLeft && !now.placeLeft) {
        returnLeft = true;
      }
      if (!now.showMaximized && !now.placeLeft && (prev.showMaximized || becameVisOrUnmin)) {
        // We're 1) cycling back to normal layout, that is, the editor at the bottom.
        // Or we're 2) un-minimizing the editor, when it was previously in normal layout
        // (that is, at the bottom).
        reserveBottom = true;
      }
    }

    // @ifdef DEBUG
    dieIf(reserveLeft && returnLeft, 'TyE4MW28PU51');
    dieIf(reserveBottom && returnBottom, 'TyE4MW28PU52');
    // @endif

    if (returnBottom) {
      this.returnSpaceAtBottomForEditor();
    }

    if (returnLeft) {
      this.returnSpaceToTheLeftForEditor();
    }

    if (reserveLeft) {
      this.makeSpaceToTheLeftForEditor();
    }

    if (reserveBottom) {
      this.makeSpaceAtBottomForEditor();
    }
  },


  makeSpaceToTheLeftForEditor: function() {
    debiki2.$h.addClasses(document.documentElement, 'c_Html-EdLeft');
  },


  returnSpaceToTheLeftForEditor: function() {
    debiki2.$h.removeClasses(document.documentElement, 'c_Html-EdLeft');
  },


  makeSpaceAtBottomForEditor: function() {
    if (this.isGone) return;

    let editorHeightPx = this.savedHeightPx;

    if (editorHeightPx) {
      this.refs.editor.style.height = editorHeightPx;
    }
    else {
      editorHeightPx = this.refs.editor.clientHeight + 'px';
      this.savedHeightPx = editorHeightPx;
    }

    // This works also if unmounted (changes the heights of *other* elements).
    this.setColumnsHeights(editorHeightPx);

    if (this.stopResizeUp) {
      // Re-activate the resize handle. (Stop stopping it :-/)
      // Works also if unmounted — the resize handles changes are in try-catch.
      // Maybe RENAME to something that shows it's ok also if unmounted? But what?
      this.stopResizeUp(false);
    }
  },


  adjustSpaceAtBottomForEditor: function() {
    if (this.isGone) return;
    const editorHeightPx = this.refs.editor.clientHeight + 'px';
    this.savedHeightPx = editorHeightPx;
    this.setColumnsHeights(editorHeightPx);
  },


  returnSpaceAtBottomForEditor: function() {
    // Set the bottom to 0px, that is, 100% height.
    this.setColumnsHeights('0px');
    // In case the editor will now be placed to the left, remove the style="height: ..."
    // so it'll be 100% tall.
    this.refs.editor.style.height = null;   // ([IE11] would have wanted '' not null)
    // When the editor is 100% tall, doesn't make sense to resize it vertically.
    if (this.stopResizeUp) {
      this.stopResizeUp(true);
    }
  },


  setColumnsHeights: function(editorHeightPx: St) {
    _.each(this.columns, (c) => {
      c.style.bottom = editorHeightPx;  // has no effect for the sidebar (5YKQ27)
    });
  },


  selectAndUploadFile: function() {
    this.refs.uploadFileInput.click();
  },


  onPaste: function(event: ClipboardEvent) {
    // Note! This works only (?) if right clicking an image in the browser,
    // and selecting Copy Image, and pasting into the editor, but...
    //
    // Does *not* work, though, if Ctrl+C-copying an image *file* from one's
    // Operating System's file browser (at least not Debian Linux?),
    // and then pasting,
    // or via Bash doing sth like:  `cat image.jpg | xsel -b`
    // to command-line place an image file in the OS clipboard.
    // However, if the OS file browser is open, then one might as well
    // drag-n-drop the file, so this editor's 'drop' handler uploads the image.

    // (Minor note: In addition to event.clipboardData below, there's
    // event.dataTransfer, at least in FF and Chrome 10 years ago,
    // e.g.: https://bugs.chromium.org/p/chromium/issues/detail?id=31037,
    // but I cannot find it mentioned in any more recent resources,
    // and I don't see it in Chrome 86 Dev Tools — only clipboardData.
    // Seems it was the same as the clipboardData field.)

    // (Minor note: There's also Navigator.clipboard,
    // but no reason to use it for anything here?
    // https://www.w3.org/TR/clipboard-apis/#async-clipboard-api )

    const clipb: DataTransfer | Nl = event.clipboardData;
    const files: FileList | Z = clipb && clipb.files;

    // COULD: If event.target is the obviosly wrong thing, e.g. the search
    // box input field, then, ignore this paste event?  Maybe show
    // a tips about clicking in the editor to focus it, before pasting?
    // But for now:
    if (files?.length) {
      // Don't let the browser paste any image into some contenteditable thing.
      event.preventDefault();
      // Save server side and <img src=...> or <a href=...> link to it.
      this.uploadAnyFiles(files);
    }

    // There's also DataTransfer.items — not supported yet though, in Safari,
    // as of Safari 14 and iOS Safari 14, November 2020.
    //
    // If right click copying a file in the browser, apparently `items` then
    // at least sometimes has two entries:
    // - A 'text/html' entry, with the file as base64, like:
    //    <meta http-equiv="content-type" content="text/html; charset=utf-8">
    //    <img src="data:image/jpeg;base64,/9j/4AAQSkZ.........6KOTP/Z"
    //         alt="Red panda sleeping"/>
    // - And a File entry, which can be uploaded to the server.
    //
    // If using items instead:  (but that's more complicated. See e.g.
    // https://developer.mozilla.org/en-US/docs/Web/API/DataTransferItem/getAsString and
    // https://stackoverflow.com/questions/6333814/
    //     how-does-the-paste-image-from-clipboard-functionality-work-in-gmail-and-google-c
    /*
    for (let i = 0; i < clipb.items.length; ++i) {
      const item = clipb.items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        this.uploadAnyFiles([files]);
        // There's a FileReader, can e.g. load the file as a data url:
        const reader = new FileReader();
        reader.onload = (event: ProgressEvent<FileReader>) => {
          console.log(event.target.result);
        }
        reader.readAsDataURL(file);
      }
    } */
  },


  // We never un-initialize this, instead we reuse the same editor instance always once created.
  initUploadFileStuff: function() {
    if (!this.refs.uploadFileInput)
      return;

    // Some browsers open a dropped file in the current browser tab, if one misses the
    // drop target with a few pixels. Prevent that. See: http://stackoverflow.com/questions/9544977/using-jquery-on-for-drop-events-when-uploading-files-from-the-desktop#comment20423424_9545050
    document.addEventListener('dragover', event => {
      event.preventDefault();
      event.stopPropagation();
    });
    document.addEventListener('drop', event => {
      event.preventDefault();
      event.stopPropagation();
    });

    FileAPI.event.on(document, 'drop', (event: Event) => {
      event.preventDefault();
      const state: EditorState = this.state;
      if (this.isGone || !state.visible) return;
      FileAPI.getDropFiles(event, (files: File[]) => {
        this.uploadAnyFiles(files);
      });
    });

    const inputElem = this.refs.uploadFileInput;
    FileAPI.event.on(inputElem, 'change', (event) => {
      const files = FileAPI.getFiles(event);
      this.uploadAnyFiles(files);
    });
  },

  uploadAnyFiles: function(files: File[]) {
    if (!files || !files.length)
      return;

    if (files.length >= 2) {
      // This'll log a warning server side, I think I want that (want to know how
      // often this happens)   [edit: should be info log msg, not warning]
      die(t.e.UploadMaxOneFile + " [TyM5JYW2]");  // INFO_LOG
    }

    for (let file of files) {
      const me: Myself = this.getDiscStore().me;

      // '**' can mean all allowed, for backw compat with old sites
      // that don't expect any upload file type restrictions.
      // ('*' would be files with no suffix (no dot) at all,
      // and '*.*' would be whatever with just one dot?  [tyglobs]
      // and '**.*' would be whatever with >= 1 dot?)
      if (!_.includes(me.effAlwUplExts, '**')) {
        const dotParts = file.name.split('.');
        const ext = dotParts.length >= 2 ? dotParts[dotParts.length - 1] : '';
        const extLowercase = ext.toLowerCase();
        const isOk = _.includes(me.effAlwUplExts, extLowercase);
        if (!isOk) {
          util.openDefaultStupidDialog({
            dialogClassName: 's_UplErrD e_BadUplExt',
            closeButtonTitle: t.Close,
            body: !me.effAlwUplExts.length
              ? r.p({}, `You cannot upload images or files`)  // I18N
              : rFr({},
                  r.p({},
                    r.b({}, `Not an allowed file type: `),
                    r.kbd({ className: 's_UplErrD_UplNm' }, ext)),
                  r.p({},
                    `These are allowed: `, r.kbd({}, me.effAlwUplExts.join(' ')))),
          });
          return;
        }
      }

      const size = file.size;
      const max = me.effMaxUplBytes;
      if (size > max) {
        util.openDefaultStupidDialog({
          dialogClassName: 's_UplErrD',
          closeButtonTitle: t.Close,
          body: rFragment({},
            r.p({},
              r.b({ className: 'e_FlTooLg' }, `File too large: `),   // I18N
              r.kbd({ className: 's_UplErrD_UplNm' }, file.name)),
            r.p({},
              `File size: ${prettyBytes(size)}`, r.br(),
              `Max size: ${prettyBytes(max)}`),
            r.p({},
              `Instead, what if you upload to a file hosting server,`, r.br(),
              `and paste a link? (Unless the file is private)`)),   // I18N
        });
        return;
      }
    }

    // DO_AFTER 2021-01-01: Replace with Fetch API?  [2UK503] [FETCHEX]
    // Ex; https://flaviocopes.com/file-upload-using-ajax/
    //
    // And support pasting images directly into the chat message editor too?
    // Makes sense now with the in-page message preview.
    //
    dieIf(files.length != 1, 'EsE5GPY82');

    const headers = { 'X-XSRF-TOKEN': getXsrfCookie() };
    // For embedded comments, need to incl the session id in a header,
    // since browsers block cookies (tracking prevention features).
    Server.addAnyNoCookieHeaders(headers);

    FileAPI.upload({   // a bit dupl code [2UK503]
      url: '/-/upload-public-file',
      headers,
      files: { file: files },
      // This is per file.
      fileprogress: (event, file, xhr, options) => {
        if (this.isGone) return;
        const state: EditorState = this.state;
        if (!state.isUploadingFile) {
          this.setState({ isUploadingFile: true });
          pagedialogs.getProgressBarDialog().open(t.UploadingDots, () => {
            xhr.abort("Intentionally cancelled [EsM3GU05]");
            if (this.isGone) return;
            this.setState({ uploadCancelled: true });
          });
        }
        else {
          const percent = event.loaded / event.total * 100;
          pagedialogs.getProgressBarDialog().setDonePercent(percent);
        }
      },
      // This is when all files have been uploaded — but we're uploading just one.
      complete: (error, xhr) => {
        pagedialogs.getProgressBarDialog().close();
        const state: EditorState = this.state;
        if (!this.isGone) this.setState({
          isUploadingFile: false,
          uploadCancelled: false
        });
        if (error) {
          if (!state.uploadCancelled) {
            pagedialogs.getServerErrorDialog().open(xhr);
          }
          return;
        }
        if (this.isGone) return;
        const fileUrlPath = JSON.parse(xhr.response);
        dieIf(!_.isString(fileUrlPath), 'DwE06MF22');
        dieIf(!_.isString(state.text), 'EsE5FYZ2');
        const file = xhr.files[0];
        const linkHtml = this.makeUploadLink(file, fileUrlPath);
        // This: this.rta.getCaretPosition()  might not always work, e.g. if pat
        // just minimized the editor or switched to full screen preview?
        const caretPos = state.caretPos;
        const textBefore = state.text.substr(0, caretPos);
        const textAfter = state.text.substr(caretPos);
        const perhapsNewline = textBefore.endsWith('\n') ? '' : '\n';

        const uploadedFileHtml = perhapsNewline + '\n' +
            // (There's a sanitizer for this — for everything in the editor.)
            "<!-- Uploaded file name:  " + file.name + "  -->\n" +
            linkHtml +
            '\n\n';

        // Place the caret on the blank line just after the html (but not
        // 2 lines below — so, -1  not -2).
        const newCaretPos = textBefore.length + uploadedFileHtml.length - 1;

        this.setState({
          text: textBefore + uploadedFileHtml + textAfter,
          caretPos: newCaretPos,
          draftStatus: DraftStatus.ShouldSave,
        }, () => {
          if (this.rta && !this.isGone) {
            this.rta.setCaretPosition(newCaretPos);
            // Seems rta generates a onCaretPositionChange itself before
            // setCaretPosition() above — and seems that setCaretPosition()
            // does *not* trigger any new onCaretPositionChange event, so,
            // we need to update the caret position manually here?
            this.setState({ caretPos: newCaretPos });
          }

          // The following is fine also if this.isGone.
          this.saveDraftSoon();
          // UX: It'd be nice if the uploaded thing could scroll into view,
          // in the preview?
          this.updatePreviewSoon();
        });
      },
    });
  },

  cancelUpload: function() {
    const state: EditorState = this.state;
    if (state.uploadFileXhr) {
      state.uploadFileXhr.abort();
    }
    else {
      logW("Cannot cancel upload: No this.state.uploadFileXhr [DwE8UMW2]");
    }
  },

  showUploadProgress: function(percent: Nr) {
    if (percent === 0) {
      pagedialogs.getProgressBarDialog().open(t.UploadingDots, this.cancelUpload);
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

  makeUploadLink: function(file: File, url: St) {
    // The relative path is like '/-/u/1/a/bc/def...zwq.suffix' = safe,
    // and we got it from the server.
    dieIf(!url.match(/^[0-9a-z/\.-]+$/),
        "Bad image relative path: " + url + " [DwE8PUMW2]");

    const parts = url.split('.');
    const suffix = parts.length > 1 ? _.last(parts) : '';

    // (SVG doesn't work in old browsers, fine. tif doesn't work for me.)
    const isImage = suffix === 'png' || suffix === 'jpg' || suffix === 'jpeg' || suffix === 'gif' ||
        suffix === 'mpo' || suffix === 'bmp' || suffix === 'svg';

    // Only .mp4 is supported by all browsers.
    const isVideo = suffix === 'mp4' || suffix === 'ogg' || suffix === 'webm';

    let link;
    if (isImage) {
      // <img> is a void element, shouldn't be any </img> close tag.
      link = `<img src="${url}">`;
    }
    else if (isVideo) {
      link = '<video width="490" height="400" controls src="' + url + '"></video>';
    }
    else {
      // Unfortunately, download="the-file-name" won't work if a cdn is in use: needs to be same origin.
      // Can maybe add some http origin header?
      link = `<a download="${file.name}" href="${url}">${file.name}</a> (${prettyBytes(file.size)})`;
    }
    return link;
  },



  toggleWriteReplyToPostNr: function(postNr: PostNr, inclInReply: Bo,
        anyPostType?: PostType, inFrame?: DiscWin) {
    if (this.alertBadState('WriteReply'))
      return;

    const state: EditorState = this.state;
    let postNrs = state.replyToPostNrs;

    // If we're in the blog comments editor iframe, then, usernames are in a store
    // in another iframe, namely the one with the comments (rather than this iframe
    // with only the editor).
    // We'll then clone the parts we need of that other store, and remember
    // in this.state.inFrameStore.
    const discStore: DiscStore = this.getOrCloneDiscStore(inFrame);

    if (inclInReply && postNrs.length) {
      // This means we've started replying to a post, and then clicked Reply
      // for *another* post too — i.e. we're trying to reply to more than one post,
      // a a single time. This is, in Talkyard, called Multireply.
      // Disable this for now — it's disabled server side, and the UX for this was
      // poor actually.
      // Disable the reply buttons? Also see (5445522) just below. — Done,
      // see store.isEditorOpen.
      // @ifdef DEBUG
      die('TyE305FKUGPGJ0');
      // @endif
      return;
    }

    // No multireplies — disabled.
    dieIf(postNrs.length >= 2, 'TyE35KKGJRT0');

    if (state.editorsPageId !== discStore.currentPageId && postNrs.length) {
      // The post nrs on this different page, won't match the ones in postNrs.
      // So ignore this.
      // UX COULD disable the reply buttons? Also see (5445522) just above.  — Done.
      // @ifdef DEBUG
      die('TyE630KRGUJMF');
      // @endif
      return;
    }

    // Insert postNr into the list of posts we're replying to — or remove it, if present. (I.e. toggle.)

    const index = postNrs.indexOf(postNr);
    if (inclInReply && index >= 0) {
      // 2020: Dead code.
      die('TyE305WKGJS34');
      /*
      // Now almost certainly this can be removed — Reply buttons hidden,
      // once edior open. So cannot get out of sync?
      // Editor out of sync with reply button states: reply button wants to add,
      // editor wants to remove the post, from the reply-to-list.
      // Happened in embedded comments iframe because of a bug. Fixed now, but keep this
      // anyway, in case there're other such iframe + iframe sync bugs?
      // @ifdef DEBUG
      logW("Discussion button and editor reply-list out of sync: " +
          "inclInReply && index >= 0  [TyE5UKJWVDQ2]");
      debugger;
      // @endif
      postNrs = [postNr];
      this.showEditor();
      */
    }
    else if (index === -1) {
      // We're starting to write a reply to postNr.
      postNrs.push(postNr);
    }
    else {
      // 2020: Dead code.
      die('TyE305WKGJS34');
      // Remove postNr — we're not going to reply to it any longer.
      //postNrs.splice(index, 1);
    }

    // Don't change post type from flat to something else.
    let postType = anyPostType;
    if (postNrs.length >= 2 && state.anyPostType === PostType.Flat) {
      postType = PostType.Flat;
    }

    let inFrameStore: DiscStore | U;
    if (eds.isInEmbeddedEditor && inFrame?.eds) {
      // [many_embcom_iframes]
      inFrameStore = discStore;
      eds.embeddedPageId = inFrame.eds.embeddedPageId;
      eds.embeddingUrl = inFrame.eds.embeddingUrl;
      eds.embeddedPageAltId = inFrame.eds.embeddedPageAltId;
      eds.lazyCreatePageInCatId = inFrame.eds.lazyCreatePageInCatId;
    }

    const editorsPageId = discStore.currentPageId || eds.embeddedPageId;

    // Annoying! Try to get rid of eds.embeddedPageId? So can remove discStore2.
    const discStore2: DiscStore = { ...discStore, currentPageId: editorsPageId };

    const discProps: DiscPropsDerived = page_deriveLayout(
            discStore.currentPage, discStore, LayoutFor.PageNoTweaks);

    const choosenAnon = anon.maybeChooseAnon({ store: discStore2, discProps, postNr });

    const newState: Partial<EditorState> = {
      inFrame,
      inFrameStore,
      anyPostType: postType,
      editorsCategories: discStore.currentCategories,
      editorsPageId,
      // [editorsNewLazyPageRole] = PageRole.EmbeddedComments if eds.isInEmbeddedEditor?
      replyToPostNrs: postNrs,
      text: state.text || makeDefaultReplyText(discStore, postNrs),
      myAliasOpts: choosenAnon.myAliasOpts,
      doAsAnon: choosenAnon.doAsAnon,
      discProps,
    };

    this.showEditor(newState);

    if (!postNrs.length) {
      this.saveDraftClearAndClose();
      return;
    }

    const draftType = postType === PostType.BottomComment ?
        DraftType.ProgressPost : DraftType.Reply;


    const draftLocator: DraftLocator = {
      draftType,
      pageId: newState.editorsPageId,
      postNr: postNrs[0], // for now
    };
    draftLocator.postId = store_getPostId(discStore, draftLocator.pageId, draftLocator.postNr);

    // draftLocator used as key in local storage, better avoid null/undef/empty fields.
    if (eds.embeddingUrl) {
      draftLocator.embeddingUrl = eds.embeddingUrl;
    }
    if (eds.embeddedPageAltId) {
      draftLocator.discussionId = eds.embeddedPageAltId;  // [draft_diid]
    }


    let writingWhat = WritingWhat.ReplyToNotOriginalPost;
    if (_.isEqual([BodyNr], postNrs)) writingWhat = WritingWhat.ReplyToOriginalPost;
    else if (_.isEqual([NoPostId], postNrs)) writingWhat = WritingWhat.ChatComment;

    this.loadDraftAndGuidelines(
          draftLocator, writingWhat, undefined, inFrameStore);
  },



  editPost: function(postNr: PostNr, onDone?: EditsDoneHandler, inFrame?: DiscWin) {
    // [editor-drafts] UX COULD somehow give the user the option to cancel & close, without
    // loading? saving? any draft.

    if (this.alertBadState())
      return;

    // If many comments iframes, update the embedded page id, so we'll load the post
    // on the correct page, from the server. [many_embcom_iframes]
    if (inFrame?.eds) {
      eds.embeddedPageId = inFrame.eds.embeddedPageId;
      eds.embeddingUrl = inFrame.eds.embeddingUrl;
      eds.embeddedPageAltId = inFrame.eds.embeddedPageAltId;
      delete eds.lazyCreatePageInCatId; // page already exists
      const inFrameStore: DiscStore = this.getOrCloneDiscStore(inFrame);
      const newState: Partial<EditorState> = { inFrame, inFrameStore };
      this.setState(newState);
    }

    // [manyiframes_pageid]
    Server.loadDraftAndText(postNr, (response: LoadDraftAndTextResponse) => {
      const state: EditorState = this.state;
      if (this.isGone) return;
      if (state.inFrame !== inFrame) return;
      const draft: Draft | U = response.draft;

      // In case the draft was created when one wasn't logged in, then, now, set a user id.
      const discStore: DiscStore = this.getDiscStore();
      if (draft && discStore.me) {
        draft.byUserId = discStore.me.id;
      }

      // This can fail, if the post was moved by staff to a different page? Then it
      // gets a new postNr. Then do what? Show a "this post was moved to: ..." dialog?
      dieIf(postNr !== response.postNr, 'TyE23GPKG4');

      const editorsDiscStore: DiscStore = { ...discStore, currentPageId: response.pageId };
      const discProps: DiscPropsDerived = page_deriveLayout(
              discStore.currentPage, discStore, LayoutFor.PageNoTweaks);

      const choosenAnon = anon.maybeChooseAnon({ store: editorsDiscStore, discProps, postNr });

      const newState: Partial<EditorState> = {
        anyPostType: null,
        editorsCategories: discStore.currentCategories, // [many_embcom_iframes]
        editorsPageId: response.pageId,
        editingPostNr: postNr,
        editingPostUid: response.postUid,
        editingPostRevisionNr: response.currentRevisionNr,
        text: draft ? draft.text : response.currentText,
        onDone: onDone,
        draftStatus: DraftStatus.NothingHappened,
        draft,
        doAsAnon: choosenAnon.doAsAnon,
        myAliasOpts: choosenAnon.myAliasOpts,
        discProps,
      };

      this.showEditor(newState);
    });
  },

  editNewForumPage: function(catRefOrId: RefOrId | U, role: PageRole | U) {
    if (this.alertBadState())
      return;

    const state: EditorState = this.state;
    const store: Store = state.store;
    // This cannot happen in an embedded editor, currently.
    // @ifdef DEBUG
    dieIf(state.inFrame, 'TyE502MHEARI0-1');
    // @endif

    let category: Category | U;
    let categoryId: CategoryId | U;
    let newPageRole: PageType | U;

    if (role === PageRole.PrivateChat) {
      // Private chat topics shouldn't be placed in a category.
      dieIf(catRefOrId, `${catRefOrId} [TyE5KF024]`)
      newPageRole = role;
    }
    else if (_.isNumber(catRefOrId) && role) {
      categoryId = catRefOrId;
      newPageRole = role;
    }
    else {
      // Find the category id and/or default topic type.
      category = store_findCatByRefOrId(store, catRefOrId);
      dieIf(!category, `No such category: ${catRefOrId} [TyE8PE2B]`);
      categoryId = category.id;
      newPageRole = role || category.defaultTopicType;  // [05AKTD5J]
    }

    const text = state.text || '';

    const futurePage: PageDiscPropsSource = {
      categoryId,
      pageRole: newPageRole,
    };

    // Props for the future page, with settings inherited from the ancestor categories.
    const discProps: DiscPropsDerived = page_deriveLayout(
            futurePage, store, LayoutFor.PageNoTweaks);

    const choosenAnon = anon.maybeChooseAnon({ store, discProps });

    const newState: Partial<EditorState> = {
      discProps,
      anyPostType: null,
      editorsCategories: store.currentCategories,
      // The current page doens't matter, when creating a new page. [DRAFTS_BUG] set to undefined
      editorsPageId: store.currentPageId,
      newForumTopicCategoryId: categoryId,
      newPageRole,
      text: text,
      showSimilarTopics: true,
      searchResults: null,
      doAsAnon: choosenAnon.doAsAnon,
      myAliasOpts: choosenAnon.myAliasOpts,
    };

    this.showEditor(newState);

    const draftLocator: DraftLocator = {
      draftType: DraftType.Topic,
      pageId: store.currentPageId,
      categoryId: categoryId,
    };

    this.loadDraftAndGuidelines(draftLocator, WritingWhat.NewPage, role);
  },

  openToEditChatTitleAndPurpose: function() {   // RENAME to  openToEditChatPurpose only (not title)
    this.editPost(BodyNr);
  },

  openToWriteChatMessage: function(text: string, draft: Draft | undefined, draftStatus,
        onDone?: EditsDoneHandler) {
    if (this.alertBadState())
      return;

    const state: EditorState = this.state;
    const store: Store = state.store;
    // This cannot happen in an embedded editor, currently.
    // @ifdef DEBUG
    dieIf(state.inFrame, 'TyE502MHEARI0-2');
    // @endif

    const newState: Partial<EditorState> = {
      editorsCategories: store.currentCategories,
      editorsPageId: store.currentPageId,
      isWritingChatMessage: true,
      text: text || '',
      draft,
      draftStatus,
      onDone,
    };

    this.showEditor(newState);
    // No guidelines for chat messages, because usually a smaller "inline" editor is used instead.
  },

  openToWriteMessage: function(userId: UserId) {
    if (this.alertBadState())
      return;
    const state: EditorState = this.state;
    const store: Store = state.store;
    // This cannot happen in an embedded editor, currently.
    // @ifdef DEBUG
    dieIf(state.inFrame, 'TyE502MHEARI0-3');
    // @endif
    const newState: Partial<EditorState> = {
      editorsCategories: store.currentCategories,
      // The current page doens't matter, when creating a new page. [DRAFTS_BUG] set to undefined
      editorsPageId: store.currentPageId,
      messageToUserIds: [userId],
      text: '',
      newPageRole: PageRole.FormalMessage,
    };
    
    this.showEditor(newState);

    const draftLocator: DraftLocator = {
      draftType: DraftType.DirectMessage,
      toUserId: userId,
    };
    this.loadDraftAndGuidelines(draftLocator, WritingWhat.NewPage, PageRole.FormalMessage);
    this.showAndFadeOutBackdrop();
  },

  showAndFadeOutBackdrop: function() {
    // Later: Start using util.FadingBackdrop instead. [4KEF0YUU2]
    this.setState({ backdropOpacity: 0.83 });
    const fadeBackdrop = () => {
      const state: EditorState = this.state;
      if (this.isGone || !state.visible) return;
      const opacity = state.backdropOpacity;
      const nextOpacity = opacity < 0.01 ? 0 : opacity - 0.009;
      this.setState({ backdropOpacity: nextOpacity });
      if (nextOpacity) {
        setTimeout(fadeBackdrop, 16);
      }
    };
    setTimeout(fadeBackdrop, 1400);
  },

  alertBadState: function(wantsToDoWhat = null): boolean {
    // REFACTOR  we call clearIsReplyingMarks from here, so cannot return directly if allFine,
    // which makse this unnecessarily complicated?
    // :- ) But now clearIsReplyingMarks() is gone !
    // so can simplify? this.  (it was old jQuery code that highlighted
    // the active Reply button(s).)

    const state: EditorState = this.state;
    const store: DiscStore = this.getDiscStore();

    // REFACTOR: Remove allFine? Not needed?
    const allFine = state.draftStatus <= DraftStatus.NeedNotSave &&
        store.currentPageId === state.editorsPageId;

    const maybeAlert = allFine ? (x: any) => {} : alert;
    let seemsBad = false;

    if (wantsToDoWhat !== 'WriteReply' && state.replyToPostNrs.length > 0) {
      maybeAlert(t.e.PleaseFinishPost);
      seemsBad = true;
    }

    if (state.isWritingChatMessage) {
      maybeAlert(t.e.PleaseFinishChatMsg);
      seemsBad = true;
    }

    if (state.messageToUserIds.length) {
      maybeAlert(t.e.PleaseFinishMsg);
      seemsBad = true;
    }

    if (_.isNumber(state.editingPostNr)) {
      maybeAlert(t.e.PleaseSaveEdits);
      seemsBad = true;
    }

    if (state.newPageRole) {
      maybeAlert(t.e.PleaseSaveOrCancel);
      seemsBad = true;
    }

    return !allFine && seemsBad;
  },


  loadDraftAndGuidelines: function(draftLocator: DraftLocator, writingWhat: WritingWhat,
        pageRole?: PageRole, inFrameStore?: DiscStore) {

    const setDraftAndGuidelines = (anyDraft?, anyGuidelines?) => {
      let draft: Draft | U = anyDraft ||
            // BUG harmleess: Use BrowserStorage.forEachDraft(page-id) instead?
            // So same algorithm for finding drafts to show in-page, as to load
            // in the editor.  [find_br_drafts]
            BrowserStorage.get(draftLocator);
      // Also try without any  pageId  or discussionId,  [draft_diid]
      // in case we started writing, before a page had been created,
      // or before there was a discussion id (maybe the site admin added later).
      if (!draft) {
        const hasDiscId = !!draftLocator.discussionId;
        const hasPageId = !isNoPage(draftLocator.pageId);
        // UX, minor: Could find all 3 drafts (if any) and pick the most recent one?
        // Or let pat choose, or show diffs  o.O  almost a can of worms?
        if (hasDiscId) {
          // Lookup by url path or page id, if the draft was saved before the
          // embedded discussion had a discussion id assigned.
          // But if the url is different, skip this draft [emb_draft_url].
          // (COULD consider the url path only? In case blog moved elsewhere?)
          const loc2 = { ... draftLocator };
          delete loc2.discussionId;
          draft = BrowserStorage.get(loc2);
        }
        if (!draft && hasPageId) {
          // Lookup by url path or discussion id, if draft created before
          // the page existed, that is, when the page id was sitll empty/no-page-id.
          // (Remember, embedded comments pages aren't created before the first
          // comment gets posted [emb_lzy_pgs], so, a draft of the very first comment,
          // usually won't have any page id.)
          const loc2 = { ... draftLocator };
          // Replies currently always have a page id — if page doesn't exist,
          // then, EmptyPageId, not undefined.
          loc2.pageId = EmptyPageId;
          draft = BrowserStorage.get(loc2);
          // But, later on, new forum topics, don't (since don't yet exist).
          // (New forum topics cannot have embedded discussion ids, so this
          // not needed in the last if{} below.))
          if (!draft) {
            delete loc2.pageId;
            draft = BrowserStorage.get(loc2);
          }
        }
        if (!draft && hasDiscId && hasPageId) {
          // Lookup by url path, if draft created before the emb comments page existed,
          // and before it had a discussion id.
          const loc2 = { ... draftLocator };
          delete loc2.discussionId;
          loc2.pageId = EmptyPageId;
          draft = BrowserStorage.get(loc2);
        }
      }

      logD("Setting draft and guidelines: !!anyDraft: " + !!anyDraft +
          " !!draft: " + !!draft +
          " !!anyGuidelines: " + !!anyGuidelines);
      const newState: Partial<EditorState> = {
        draft,
        draftStatus: DraftStatus.NothingHappened,
        text: draft ? draft.text : '',
        title: draft ? draft.title : '',
        // For now, skip guidelines, for blog comments — they would break e2e tests,
        // and maybe are annoying?
        guidelines: eds.isInIframe ? undefined : anyGuidelines,
      };
      if (draft && draft.doAsAnon) {
        // TESTS_MISSING  TyTANONDFLOAD
        newState.doAsAnon = draft.doAsAnon;
      }
      this.setState(newState, () => {
        this.focusInputFields();
        this.scrollToPreview = true;
        this.updatePreviewSoon();
      });
    };

    const state: EditorState = this.state;
    if (isEmbeddedNotYetCreatedPage(state)) {
      // Cannot currently load draft & guidelines (below) for a not-yet-created page.
      // Instead, we'll load from the browser. [BLGCMNT1]
      setDraftAndGuidelines();
      return;
    }

    const store: DiscStore = inFrameStore || state.store;

    // For embedded comments iframes, the page might not yet have been created,
    // and the categoryId might be unknown / undefined.
    const page: Page = store.currentPage;
    const categoryId: CategoryId | undefined = draftLocator.categoryId || page.categoryId;
    const pageType: PageRole = pageRole || page.pageRole || (
      eds.isInEmbeddedEditor ? PageRole.EmbeddedComments : die('TyE305WKD'));

    // What's this? why? I should have added a comment. The code seems to say that
    // if *guidelines* have been loaded, then any *draft* has also been loaded.
    const currentGuidelines = state.guidelines;
    if (currentGuidelines &&
        currentGuidelines.categoryId === categoryId &&
        currentGuidelines.pageRole === pageType &&
        currentGuidelines.writingWhat === writingWhat) {
      this.setState({ draftStatus: DraftStatus.NothingHappened });
      return;
    }

    logD("Loading draft and guidelines...");
    Server.loadDraftAndGuidelines(draftLocator, writingWhat, categoryId, pageType,
        (guidelinesSafeHtml: string | U, draft?: Draft) => {
      logD("Done loading draft and guidelines.");
      const state: EditorState = this.state;
      if (this.isGone || !state.visible) return;
      if (state.inFrameStore !== inFrameStore) return;
      let guidelines = undefined;
      if (guidelinesSafeHtml) {
        const guidelinesHash = hashStringToNumber(guidelinesSafeHtml);
        const hiddenGuidelinesHashes = BrowserStorage.get('dwHiddenGuidelinesHashes') || {};
        const isHidden = hiddenGuidelinesHashes[guidelinesHash];
        guidelines = {
          writingWhat: writingWhat,
          categoryId: categoryId,
          pageRole: pageType,
          safeHtml: guidelinesSafeHtml,
          hidden: isHidden,
        };
      }
      setDraftAndGuidelines(draft, guidelines);
    });
  },


  // Remembers that these guidelines have been hidden, by storing a hash of the text in localStorage.
  // So, if the guidelines get changed, they'll be shown again (good). COULD delete old hashes if
  // we end up storing > 100? hashes?
  hideGuidelines: function() {
    const state: EditorState = this.state;
    const guidelines = state.guidelines;
    guidelines.hidden = true;
    this.setState({
      guidelines: guidelines,
      showGuidelinesInModal: false,
    });
    const hash = hashStringToNumber(guidelines.safeHtml);
    const hiddenGuidelinesHashes = BrowserStorage.get('dwHiddenGuidelinesHashes') || {};
    hiddenGuidelinesHashes[hash] = true;
    BrowserStorage.set('dwHiddenGuidelinesHashes', hiddenGuidelinesHashes);
  },

  showGuidelines: function() {
    const state: EditorState = this.state;
    const guidelines = state.guidelines;
    guidelines.hidden = false;
    this.setState({ guidelines: guidelines });
    // Leave hidden on page reload? I.e. don't update the browser storage.
  },

  // If we're showing some guidelines, but they're not visible on screen, then show them
  // in a modal dialog instead — guidelines are supposedly fairly important.
  perhapsShowGuidelineModal: function() {
    const state: EditorState = this.state;
    if (!this.refs.guidelines || state.showGuidelinesInModal)
      return;

    // If the guidelines are visible, we don't need no modal.
    const rect = this.refs.guidelines.getBoundingClientRect();
    if (rect.top >= 0)
      return;

    this.setState({ showGuidelinesInModal: true });
  },

  onTitleEdited: function(event) {
    const title = event.target.value;
    const state: EditorState = this.state;
    this._handleEditsImpl(title, state.text);
  },

  onTextEdited: function(event) {
    const text = event.target.value;
    const state: EditorState = this.state;
    this._handleEditsImpl(state.title, text);
  },

  _handleEditsImpl: function(title: St | U, text: St | U) {
    const state: EditorState = this.state;

    // A bit dupl code [7WKABF2]
    const draft: Draft = state.draft;
    const draftStatus = draft && draft.text === text && draft.title === title
        ? DraftStatus.EditsUndone
        : DraftStatus.ShouldSave;

    const newState: Partial<EditorState> = { title, text, draftStatus };

    const titleChanged = state.title !== title;
    if (titleChanged) newState.showTitleErrors = false;
    else newState.showTextErrors = false; // maybe a mistake in some edge case, oh well

    this.setState(newState, () => {
      if (draftStatus === DraftStatus.ShouldSave) {
        this.saveDraftSoon();
      }
      if (titleChanged) {
        this.searchForSimilarTopicsSoon();
      }
      this.updatePreviewSoon();
    });
  },

  onKeyPressOrKeyDown: function(event) {
    // In my Chrome, Ctrl + Enter won't fire onKeyPress, only onKeyDown. [5KU8W2]
    if (event_isCtrlEnter(event)) {
      event.preventDefault();
      this.saveStuff();
    }
    if (event_isEscape(event)) {
      this.saveDraftClearAndClose();
    }
  },

  updatePreviewNow: function() {
    // This function is debounce-d, so the editor might have been cleared
    // and closed already, or even unmounted.
    const state: EditorState = this.state;
    if (this.isGone || !state.visible)
      return;

    // This cannot be a function param, because updatePreviewSoon() is debounce():d,
    // and only args from the last invokation are sent — so any scrollToPreview = true
    // argument, could get "debounce-overwritten".
    const scrollToPreview = this.scrollToPreview;

    // (COULD verify still edits same post/thing, or not needed?)
    const isEditingBody = state.editingPostNr === BodyNr;
    const sanitizerOpts = {
      allowClassAndIdAttr: true, // or only if isEditingBody?  dupl [304KPGSD25]
      allowDataAttr: isEditingBody
    };

    const safeHtml = markdownToSafeHtml(
        state.text, window.location.host, sanitizerOpts);

    this.setState({
      // UX COULD save this in the draft too, & send to the server, so the preview html
      // is available when rendering the page and one might want to see one's drafts,
      // here: [DRAFTPRVW]. But would need to sanitize server side (!).
      safePreviewHtml: safeHtml,
    }, () => {
      if (this.isGone) return;
      // Show an in-page preview, unless we're creating a new page.  [showPreviewWhere]
      const state: EditorState = this.state;
      if (state.newPageRole || state.newForumTopicCategoryId) {
        // Then the page doesn't yet exist — cannot show any in-page preview.
      }
      else {
        const params: ShowEditsPreviewParams = {
          scrollToPreview,
          safeHtml,
          editorsPageId: state.editorsPageId,
          doAsAnon: state.doAsAnon,
        };
        const postNrs: PostNr[] = state.replyToPostNrs;
        if (postNrs.length === 1) {
          params.replyToNr = postNrs[0];
          params.anyPostType = state.anyPostType;
        }
        if (state.editingPostUid) {
          params.editingPostNr = state.editingPostNr;
        }
        ReactActions.showEditsPreviewInPage(params, state.inFrame);
        // We'll hide the preview, wheh closing the editor, here: (TGLPRVW)
      }
    });
  },

  searchForSimilarTopicsNow: function() {
    if (!this.refs.editor)
      return;

    const state: EditorState = this.state;
    const store: Store = state.store;
    // This cannot happen in an embedded editor, currently.
    // @ifdef DEBUG
    dieIf(state.inFrame, 'TyE502MHEARI0-4');
    // @endif

    const settings: SettingsVisibleClientSide = store.settings;
    if (settings.enableSimilarTopics === false)
      return;

    // Wait until has typed a bit, so there's sth to search for.
    // People sometimes type short titles like "Popups flicker" or "gravatar support",
    // so start searching fairly soon:
    const trimmedTitle = (state.title || '').trim();
    const tooFewChars = trimmedTitle.length < 12;
    const tooFewWords = trimmedTitle.indexOf(' ') === -1;  // 2 words

    let skipSilimarTopics = tooFewChars || tooFewWords;

    // For now, if not enough space to show a list of similar topics, don't do it.
    // UX COULD instead show the similar topics, between the title input, and the
    // topic body textarea input. (StackOverflow does this, for some screen resolutons).
    // This'd work on mobile, at least if it's in portrait orientation
    // (in landscape orientation, might push the textarea down below the lower edge
    // of the screen — maybe bad?).
    if (!skipSilimarTopics) {
      const rect = this.refs.editor.getBoundingClientRect();
      skipSilimarTopics = rect.top < 170; // sync w css [SIMLTPCH]
    }

    if (skipSilimarTopics) {
      if (state.searchResults) {
        this.setState({ searchResults: null });
      }
      return;
    }

    Server.search({ rawQuery: state.title }, (searchResults: SearchResults) => {
      const state: EditorState = this.state;
      if (this.isGone || !state.visible)
        return;
      // Exclude category description pages — they're off-topic, here. Also don't show
      // forum topic index pages or blog post list pages. (Such pages are typically
      // *not* answers to a question we're asking.)
      const pagesNoAboutCats = _.filter(
          searchResults.pagesAndHits, (ph: PageAndHits) =>
              ph.pageType !== PageRole.About && !isSection(ph.pageType));
      searchResults = { ...searchResults, pagesAndHits: pagesNoAboutCats };
      this.setState({ searchResults });
    }, null, { showLoadingOverlay: false });
  },

  changeCategory: function(categoryId: CategoryId) {
    this.setState({ newForumTopicCategoryId: categoryId });
  },

  changeNewForumPageRole: function(pageRole: PageRole) {
    this.setState({ newPageRole: pageRole });
  },

  onCancelClick: function() {
    const state: EditorState = this.state;
    this.callOnDoneCallback(false);
    if (state.isWritingChatMessage) {
      // We'll continue editing in the simple inline editor, and it'll save the draft —
      // don't save here too; that could result in dupl drafts [TyT270424]. Also, no
      // can-continue-editing tips needed, because we're just switching to the simple inline editor.
      this.clearAndCloseFineIfGone();
    }
    else {
      this.saveDraftClearAndClose();
    }
  },

  makeEmptyDraft: function(): Draft | U {
    const state: EditorState = this.state;
    const anyPostType: PostType | U = state.anyPostType;
    const locator: DraftLocator = { draftType: DraftType.Scratch };
    const discStore: DiscStore = this.getDiscStore();

    // If we're in an iframe, the page might have gotten lazy-created; then
    // we need to use eds.embeddedPageId.
    // Is undefined e.g. if we're on someone's user profile page and click Create Chat
    // or Send Message. [NEWTOPIC0CURPAGE]
    const editorsPageId: PageId | U = state.editorsPageId || eds.embeddedPageId;

    const isNewForumTopic = state.newForumTopicCategoryId;
    const isNewDirectMessage = state.messageToUserIds && state.messageToUserIds.length;
    const isReplying = state.replyToPostNrs?.length;  // CLEAN_UP can remove '?.', never undef? [TyE502KRDL35]

    let postType: PostType;

    // There's an annoying db constraint, when creating topics: (as of 2020-04)
    // drafts_c_type_topic:
    ///   check (draft_type <> 2   /* that's NewTopic,  DirectMessage is 3 */
    //    or category_id is not null
    //    and topic_type is not null and page_id is not null and post_nr is null
    //    and post_id is null and post_type is null and to_user_id is null)
    // which prevents drafts for new tocips created in the API section,
    // where there's no current page id.
    // For now, then just don't create any draft.  [DRAFTS_BUG]
    // There'll be an incorrect 'Will save draft ...' status message.
    if (isNewForumTopic && !editorsPageId)
      return undefined;

    // ---------------------------------------------------------
    // @ifdef DEBUG
    dieIf(!state.replyToPostNrs, '[TyE502KRDL35]');
    // The new draft cannot be for a new topic, and for edits or a reply, at the same time.
    if (isNewForumTopic) {
      dieIf(isReplying, '[TyE603956RKTSH]');
      dieIf(anyPostType, '[TyE306KDGR24]');
      dieIf(state.editingPostNr, '[TyE40602TKSJ]');
    }
    // Same (as above) for new direct messages.
    if (isNewDirectMessage) {
      dieIf(isReplying, '[TyE502KRTJ5]');
      dieIf(anyPostType, '[TyE02EKRDL6]');
      dieIf(state.editingPostNr, '[TyE4AKVTGL045]');
    }
    // If there's no current page, we cannot be editing or chatting or replying.
    if (!state.editorsPageId) {
      dieIf(state.editingPostNr, '[TyE40JMABN42]');
      // Cannot post chat messages on non-existing pages.
      dieIf(state.isWritingChatMessage, '[TyE40JMABN44]');
      // Just sometimes we can post new replies, if the page doesn't exist
      // — because PageRole.EmbeddedComments pages get created lazily.
      dieIf(isReplying && !eds.isInEmbeddedEditor, '[TyE02RKJF45602]');
    }
    // @endif
    // ---------------------------------------------------------

    if (state.editingPostNr) {
      locator.draftType = DraftType.Edit;
      locator.pageId = editorsPageId;
      locator.postId = state.editingPostUid;
      locator.postNr = state.editingPostNr;
    }
    else if (isReplying) {
      // @ifdef DEBUG
      dieIf(anyPostType !== PostType.Normal &&
          anyPostType !== PostType.BottomComment, 'TyE25KSTJ30');
      // @endif
      postType = anyPostType || PostType.Normal;
      locator.draftType = postType_toDraftType(postType);
      locator.pageId = editorsPageId;
      locator.postNr = state.replyToPostNrs[0]; // for now just pick the first one
      locator.postId = store_getPostId(discStore, locator.pageId, locator.postNr);
      // This is needed for embedded comments, if the discussion page hasn't yet been created.
      if (eds.embeddingUrl) {
        locator.embeddingUrl = eds.embeddingUrl;
      }
      if (eds.embeddedPageAltId) {
        locator.discussionId = eds.embeddedPageAltId;  // [draft_diid]
      }
    }
    else if (state.isWritingChatMessage) {
      locator.draftType = DraftType.Reply;
      locator.pageId = editorsPageId;
      locator.postNr = BodyNr;
      locator.postId = store_getPostId(discStore, locator.pageId, locator.postNr);
      postType = PostType.ChatMessage;
    }
    else if (isNewDirectMessage) {
      locator.draftType = DraftType.DirectMessage;
      locator.toUserId = state.messageToUserIds[0];  // for now
    }
    else if (state.newForumTopicCategoryId) {
      locator.draftType = DraftType.Topic;
      locator.categoryId = state.newForumTopicCategoryId;
      // Need to know in which forum (sub community) the new page should be placed.
      // (Hmm or could lookup via category id?)  [NEWTOPIC0CURPAGE]
      locator.pageId = editorsPageId;  //[DRAFTS_BUG] should *not* store new topics by page id
    }
    else {
      // Editor probably closed, state gone.
      return;
    }

    const draft: Draft = {
      byUserId: discStore.me.id,
      draftNr: NoDraftNr,
      forWhat: locator,
      createdAt: getNowMs(),
      topicType: state.newPageRole,
      postType: state.anyPostType || postType,
      title: '',
      text: '',
    };

    return draft;
  },

  saveDraftUseBeacon: function() {
    logD("saveDraftUseBeacon");
    this.saveDraftNow(undefined, UseBeacon);
  },

  saveDraftNow: function(callbackThatClosesEditor: (draft?: Draft) => void,
      useBeacon?: UseBeacon) {
    // Tested here: 7WKABZP2
    // A bit dupl code [4ABKR2J0]
    const state: EditorState = this.state;

    // If we're closing the page, do try saving anyway, using becaon, because the current non-beacon
    // request will probably be aborted by the browser (since, if beacon, the page is getting unloaded).
    if (this.isSavingDraft && !useBeacon) {
      logD("isSavingDraft already.");
      return;
    }

    const oldDraft: Draft | undefined = state.draft;
    const draftOldOrEmpty: Draft | undefined = oldDraft || this.makeEmptyDraft();
    const draftStatus: DraftStatus = state.draftStatus;

    if (!draftOldOrEmpty || draftStatus <= DraftStatus.NeedNotSave) {
      logD("Need not save draft, because: !!draftOldOrEmpty: " +
          !!draftOldOrEmpty + " draftStatus: " + draftStatus);
      if (callbackThatClosesEditor) {
        callbackThatClosesEditor(oldDraft);
      }
      return;
    }

    const text: string = (state.text || '').trim();
    const title: string = (state.title || '').trim();

    // BUG the lost update bug, unlikely to happen: Might overwrite other version of this draft [5KBRZ27]
    // which might be open in another browser tab. Could have the server check if there's
    // a newer version of the draft (saved in another browser tab) and, if so, ask if
    // wants to overwrite or not?  [5ABRQP0]  — This happens to me sometimes actually, in Facebook,
    // when composing replies there; FB has this lost-updates bug in their editor (2018)?

    // Delete any old draft, if text empty.
    if (!text && !title) {
      if (oldDraft) {
        logD("Deleting draft...");
        this.setState({
          // When closing editor, after having deleted all text, it's rather uninteresting
          // that the draft gets deleted — don't show a modal dialog about that.
          // Still a bit interesting? so if editor still open, do show a small non-obtrusive
          // info about the draft getting deleted.
          draftStatus: callbackThatClosesEditor ?
              DraftStatus.NothingHappened : DraftStatus.Deleting,
        });
        this.isSavingDraft = true;

        // Deleting the draft post, would in fact delete the edits preview
        // instead — because now when editing, the draft post has been temporarily
        // removed and there's a preview (with the same post nr) instead.
        const deleteDraftPost = false;

        ReactActions.deleteDraft(
            state.editorsPageId,  // why needed? Won't delete a new topic draft? [DRAFTS_BUG]
            oldDraft, deleteDraftPost, useBeacon || (() => {
          // DUPL CODE, bad, here & above [UPSDFTDUPLCD]
          this.isSavingDraft = false;
          logD("...Deleted draft.");

          // Could patch the store: delete the draft — so won't reappear
          // if [offline-first] and navigates back to this page.

          const state: EditorState = this.state;
          if (this.isGone || !state.visible)
            return;

          this.setState({
            draft: null,
            draftStatus: DraftStatus.Deleted,
          });
        }), useBeacon || this.setCannotSaveDraft, state.inFrame);
      }
      if (callbackThatClosesEditor) {
        callbackThatClosesEditor();
      }
      return;
    }

    const me: Myself = this.getDiscStore().me;
    const draftToSave: Draft = {
      ...draftOldOrEmpty,
      doAsAnon: state.doAsAnon,
      text,
      title,
    };

    // If this is an embedded comments discussion, and the discussion page hasn't
    // yet been created, there's no page id to use as draft locator key. Then,
    // save the draft in the browser storage only, for now.
    // UX COULD save server side, with url as key  [BLGCMNT1]
    // — it's the key already, in the sesison cache.
    const saveInBrowser = !me.isLoggedIn || isEmbeddedNotYetCreatedPage(state);

    logD(`Saving draft: ${JSON.stringify(draftToSave)}, ` + (
        saveInBrowser ? "temp in browser" : "server side"));

    if (saveInBrowser) {
      BrowserStorage.set(draftToSave.forWhat, draftToSave);
      this.setState({
         draft: draftToSave,
         draftStatus: DraftStatus.SavedInBrowser,
      });
      if (callbackThatClosesEditor) {
        callbackThatClosesEditor(draftToSave);
      }
      return;
    }

    this.setState({
      draftStatus: callbackThatClosesEditor ?
          DraftStatus.SavingBig : DraftStatus.SavingSmall,
    });

    this.isSavingDraft = true;
    Server.upsertDraft(draftToSave, useBeacon || ((draftWithNr: Draft) => {
      // DUPL CODE, bad, here & above [UPSDFTDUPLCD]
      logD("...Saved draft.");
      this.isSavingDraft = false;

      const state: EditorState = this.state;
      if (this.isGone || !state.visible)
        return;

      this.setState({
        draft: draftWithNr,
        draftStatus: DraftStatus.SavedServerSide,
      });

      if (callbackThatClosesEditor) {
        callbackThatClosesEditor(draftWithNr);
      }
    }), useBeacon || this.setCannotSaveDraft);
  },

  setCannotSaveDraft: function(errorStatusCode?: number) {
    // Dupl code [4ABKR2JZ7]
    logW(`... Error saving draft, status: ${errorStatusCode}`);
    if (this.isGone) return;
    this.isSavingDraft = false;
    this.setState({
      draftStatus: DraftStatus.CannotSave,
      draftErrorStatusCode: errorStatusCode,
    });
  },

  onSaveClick: function() {
    this.saveStuff();
  },

  saveStuff: function() {
    const state: EditorState = this.state;
    const isReplying = state.replyToPostNrs.length > 0;
    const loginToWhat = eds.isInEmbeddedEditor && isReplying ?
      LoginReason.PostEmbeddedComment : LoginReason.SubmitEditorText;

    // Email verification shouldn't be needed immediately, checked by this constraint:
    // settings3_compose_before_c. However, there's a RACE condition: a user clicks Reply,
    // starts composing without having logged in, then an admin changes the settings
    // to may-NOT-compose-before-logged-in, and then the user clicks Post Reply. Then,
    // #dummy below might get used, but won't work.
    debiki2.login.loginIfNeededReturnToAnchor(loginToWhat, '#dummy-TyE2PBBYL0', () => {
      // Continue also if this.isGone — so we'll finis saving.
      const state: EditorState = this.state;
      if (page_isPrivateGroup(state.newPageRole)) {
        this.startPrivateGroupTalk();
      }
      else if (state.newForumTopicCategoryId) {  // this incl public chats, right
        this.saveNewForumPage();
      }
      else if (_.isNumber(state.editingPostNr)) {
        this.saveEdits();
      }
      else if (state.isWritingChatMessage) {
        this.postChatMessage();
      }
      else {
        // Replying to someone.
        this.saveNewPost();
      }
    });
  },

  saveEdits: function() {
    this.ifNewPostLooksOk(null, t.e.PleaseDontDeleteAll, () => {
      const state: EditorState = this.state;
      Server.saveEdits(state.editorsPageId, state.editingPostNr, state.text,
            this.anyDraftNr(), state.doAsAnon, () => {
        // BUG (harmless) poor UX: [JMPBCK] If we're no longer on the same page as
        // the post we were editing (e.g. because keeping the editor open and
        // navigating away) then, one won't see the edits appear. Probably should
        // navigate back to the post that got edited? First show a popup:
        //   "Go back and view the now edited post? It's on another page;
        //   you have navigated away frome it, to here""
        this.callOnDoneCallback(true);
        this.clearAndCloseFineIfGone(); // [6027TKWAPJ5]
      }, state.inFrame);
    });
  },

  saveNewPost: function() {
    this.ifNewPostLooksOk(null, t.e.PleaseWriteSth, () => {
      const state: EditorState = this.state;
      ReactActions.saveReply(state.editorsPageId, state.replyToPostNrs, state.text,
            state.anyPostType, state.draft, state.doAsAnon, () => {
        // BUG (harmless) poor UX: See [JMPBCK] aboe.
        // Also, if we've navigaated away, seems any draft won't get deleted.
        this.callOnDoneCallback(true);
        this.clearAndCloseFineIfGone();
      }, state.inFrame);
    });
  },

  saveNewForumPage: function() {
    const state: EditorState = this.state;
      this.ifNewPostLooksOk(t.e.PleaseWriteTitle, t.e.PleaseWriteSth, () => {
      const data = {
        categoryId: state.newForumTopicCategoryId,
        pageRole: state.newPageRole,
        pageStatus: 'Published',
        pageTitle: state.title,
        pageBody: state.text,
        deleteDraftNr: this.anyDraftNr(),
        doAsAnon: state.doAsAnon,
      };
      // [DRAFTS_BUG] This doesn't delete the draft? (if any)
      Server.createPage(data, (newPageId: string) => {
        // Could, but not needed, since assign() below:
        //   this.callOnDoneCallback(true);
        this.clearAndCloseFineIfGone();
        window.location.assign('/-' + newPageId);
      });
    });
  },

  postChatMessage: function() {
    const state: EditorState = this.state;
    // ANON_UNIMPL: send state.doAsAnon,
    ReactActions.insertChatMessage(state.text, state.draft, () => {
      this.callOnDoneCallback(true);
      this.clearAndCloseFineIfGone();
    });
  },

  startPrivateGroupTalk: function() {
    this.ifNewPostLooksOk(t.e.PleaseWriteMsgTitle, t.e.PleaseWriteMsg, () => {
      const state: EditorState = this.state;
      // [DRAFTS_BUG] I think this *does* delete any draft?  this.anyDraftNr() below
      Server.startPrivateGroupTalk(state.title, state.text, state.newPageRole,
          state.messageToUserIds, this.anyDraftNr(), (pageId: PageId) => {
        // Could, but not needed, since assign() below:
        //   this.callOnDoneCallback(true);
        this.clearAndCloseFineIfGone();
        window.location.assign('/-' + pageId);
      });
    });
  },

  anyDraftNr: function(): DraftNr | undefined {
    const state: EditorState = this.state;
    const draft: Draft | undefined = state.draft;
    if (draft) return draft.draftNr;
  },

  ifNewPostLooksOk: function(titleErrorMessage, textErrorMessage, ifOkFn: () => Vo) {
    const state: EditorState = this.state;
    let errors = '';
    if (titleErrorMessage && isBlank(state.title)) {
      errors += titleErrorMessage;
      this.setState({ showTitleErrors: true });
    }
    if (textErrorMessage && isBlank(state.text)) {
      if (errors) errors += ' ';
      errors += textErrorMessage;
      this.setState({ showTextErrors: true });
    }
    if (errors) {
      util.openDefaultStupidDialog({ body: errors });
      return;
    }

    // Haven't updated the tests — many would fail, if "That's a short ..." dialogs pop up.
    // Also, skip for staff users (if they write something short, it's probably ok)
    // — later, this'll be per group settings; see pats_t.mod_conf_c.
    const skipProbl = isAutoTestSite() || user_isStaffOrCoreMember(state.store.me);

    const titleLen = state.title.trim().length;
    const textLen = state.text.trim().length;
    const longTitle = !skipProbl && titleErrorMessage && titleLen > 130;
    const shortTitle = !skipProbl && titleErrorMessage && titleLen < (
            // Chats often have short titles, e.g. "dev" or "support" or "ux" 2 letters :- )
            page_isChat(state.newPageRole) ? 2 : 15);
    // Orig posts generally need a bit more details than comments (replies).
    const shortOrigPost = !skipProbl && textErrorMessage && state.newPageRole && textLen < 90;
    const shortComment = !skipProbl && textErrorMessage && !state.newPageRole && textLen < 30;
    const moreMargin = (text: St) => r.span({ className: 'n_MoreMargin' }, text)
    const problemText =   // I18N
        // Show title errors first — the title input field is above  [.title_errs_1st].
        // the page body textarea.
        longTitle ?
            r.p({}, `That's a long title. Fewer people read titles that long.`) : (
        shortTitle ?
            r.p({}, `That's a short title. Descriptive titles tend to get better responses.`) : (
        shortOrigPost ?
            r.p({}, `Your post is pretty short. Any more details you can add?`) : (
        shortComment ? r.div({ className: 'c_2Short-Cmt'},
            r.p({}, `That's a short comment. Any more details you can add to the discussion?`),
            r.p({},
              `Instead of comments like `,
              moreMargin(`"Me too" `), `or `, moreMargin(`"+1", `),
              `click the `,
              moreMargin(rFr({}, r.b({}, `Like `), r.span({ className: 'icon-heart' }))),
              ` button on the comment you're replying to.`)) :
        null)));

    if (problemText) {
      // Paint a red error outline around the too short text or title, so simpler
      // to see what the dialog refers to (although will be dimmed behind the
      // dialog's overlay, until it's closed).
      const showTitleErrors = shortTitle || longTitle;
      this.setState({
        // Title errors shown first.  [.title_errs_1st].
        showTitleErrors,
        showTextErrors: (shortOrigPost || shortComment) && !showTitleErrors,
      });

      util.openDefaultStupidDialog({
        body: problemText,
        primaryButtonTitle: "Okay (continue editing)",  // I18N
        secondaryButonTitle: "Post anyway",             // I18N
        onCloseOk: (bttonNr: Nr) => {
          if (bttonNr === 2) {
            // Pat clicked 2 "Post anyway", so submit.
            ifOkFn();
          }
        },
      });
      return;
    }

    ifOkFn();
  },


  cycleMaxHorizBack: function() {
    // Cycle from 1) normal to 2) place left (or right, if rtl language),
    // to 3) maximized & tiled vertically, to 4) maximized & tiled horizontally,
    // and then back to normal.  [.cycle_editor_layout]

    const state: EditorState = this.state;

    // The next layout after the default (which is the editor at the bottom, and the
    // discussion above), is the editor to the left, and the discussion to the right.
    const newPlaceLeft = state.canPlaceLeft && !state.placeLeft &&
            // But if we're already using another layout, we'll cycle back to normal first.
            !state.showMaximized;

    // After place-left, we make the editor full screen, with the preview to the right
    // of the editable textarea. Thereafter, the preview below, instead.
    const newShowMaximized = !newPlaceLeft && (!state.showMaximized ||
            // After the horizontal split layout (preview below), we cycle back to normal.
            !state.splitHorizontally);

    // In full screen layout, we first show the preview to the right of the editable textarae,
    // then below it.
    const newSplitHorizontally = state.showMaximized && !state.splitHorizontally;

    if (eds.isInEmbeddedEditor && newShowMaximized !== state.showMaximized) {
      window.parent.postMessage(JSON.stringify(['maximizeEditor', newShowMaximized]),
          eds.embeddingOrigin);
    }

    const newState: Partial<EditorState> = {
      placeLeft: newPlaceLeft,
      showMaximized: newShowMaximized,
      splitHorizontally: newSplitHorizontally,
    };

    this.setState(newState);
  },


  togglePreview: function() {
    const state: EditorState = this.state;
    this.setState({
      showOnlyPreview: !state.showOnlyPreview,
      showMinimized: false,
    });
  },


  /// (When the editor is minimized, it's still considered open — there's some
  /// edits in progress inside, just that its' been temporarily minimized.)
  ///
  toggleMinimized: function() {
    const state: EditorState = this.state;
    const nextShowMini = !state.showMinimized;
    if (eds.isInEmbeddedEditor) {
      window.parent.postMessage(JSON.stringify(['minimizeEditor', nextShowMini]), eds.embeddingOrigin);
    }
    this.setState({ showMinimized: nextShowMini });
  },


  showEditor: function(statePatch: Partial<EditorState>) {
    // @ifdef DEBUG
    dieIf(!_.isUndefined(statePatch.visible), 'TyE305WKTJP4');
    // @endif

    const oldState: EditorState = this.state;
    const newState: Partial<EditorState> = { ...statePatch, visible: true };
    this.setState(newState);

    const params: EditorStorePatch = {
      editorsPageId: newState.editorsPageId || oldState.editorsPageId,
      replyingToPostNr: newState.replyToPostNrs?.[0],
      editingPostId: newState.editingPostUid,
    };
    ReactActions.onEditorOpen(params, () => {
      if (this.isGone || !this.state.visible) return;
      this.focusInputFields();
      this.scrollToPreview = true;
      this.updatePreviewSoon();
    });
  },


  saveDraftClearAndClose: function() {
    this.saveDraftNow(
        (upToDateDraft?: Draft) =>
          this.clearAndCloseFineIfGone({ keepDraft: true, upToDateDraft }));
  },


  clearAndCloseFineIfGone: function(ps: { keepDraft?: true, upToDateDraft?: Draft } = {}) {
    const state: EditorState = this.state;
    const anyDraft: Draft = ps.upToDateDraft || state.draft;

    if (!ps.keepDraft && anyDraft) {
      const deleteDraftPost = true;
      // What about  state.newForumTopicCategoryId, for new topics?  [DRAFTS_BUG]
      ReactActions.deleteDraft(
            state.editorsPageId, anyDraft, deleteDraftPost,
            undefined, undefined, state.inFrame);
    }

    const params: HideEditorAndPreviewParams = {
      anyDraft,
      keepDraft: ps.keepDraft,
      editorsPageId:
          // If the page was just lazy-created (embedded comments), need to specify
          // the correct id. [4HKW28]
          !isNoPage(eds.embeddedPageId) ? eds.embeddedPageId :
              state.editorsPageId,
    };

    const postNrs: PostNr[] = state.replyToPostNrs;
    if (postNrs.length === 1) {
      params.replyToNr = postNrs[0];
      params.anyPostType = state.anyPostType;
    }

    if (state.editingPostUid) {
      params.editingPostNr = state.editingPostNr;
    }

    if (state.isWritingChatMessage) {
      // Then we'll continue typing, in the simple chat message text box.
      params.keepPreview = true;
    }

    // Hide any preview post we created when opening the editor (TGLPRVW),
    // and reenable any Reply buttons.
    ReactActions.hideEditorAndPreview(params, state.inFrame);

    this.returnSpaceAtBottomForEditor();
    this.returnSpaceToTheLeftForEditor();

    if (this.isGone)
      return;

    this.setState({
      inFrame: undefined,
      inFrameStore: undefined,
      visible: false,
      replyToPostNrs: [],
      anyPostType: undefined,
      editorsCategories: null,
      editorsPageId: null,
      editingPostNr: null,
      editingPostUid: null,
      isWritingChatMessage: false,
      messageToUserIds: [],
      newForumTopicCategoryId: null,
      newPageRole: null,
      editingPostRevisionNr: null,
      text: '',
      title: '',
      showTitleErrors: false,
      showTextErrors: false,
      draftStatus: DraftStatus.NotLoaded,
      draft: null,
      safePreviewHtml: '',
      onDone: null,
      guidelines: null,
      backdropOpacity: 0,
    });
    eds.embeddedPageId = EmptyPageId;
    // eds.embeddingUrl — probably stays the same
    eds.embeddedPageAltId = null;
    eds.lazyCreatePageInCatId = null;
  },

  callOnDoneCallback: function(saved: boolean) {
    const state: EditorState = this.state;
    const onDone: EditsDoneHandler = state.onDone;
    if (onDone) {
      onDone(
          saved, state.text,
          // If the text in the editor was saved (i.e. submitted, not draft-saved), we don't
          // need the draft any longer.
          saved ? null : state.draft,
          saved ? DraftStatus.NothingHappened : state.draftStatus);
    }
  },

  showEditHistory: function() {
    const state: EditorState = this.state;
    dieIf(!state.editingPostNr || !state.editingPostUid, 'EdE5UGMY2');
    debiki2.edithistory.getEditHistoryDialog().open(state.editingPostUid);
  },

  makeTextBold: function() {
    const text = wrapSelectedText(this.textareaElm, t.e.exBold, '**');
    this.setState({ text }, this.updatePreviewSoon);
  },

  makeTextItalic: function() {
    const text = wrapSelectedText(this.textareaElm, t.e.exEmph, '*');
    this.setState({ text }, this.updatePreviewSoon);
  },

  // It's more important to get code blocks right, than inline single variables,
  // so skip this fn, and we'll use markupAsCode() below instead.
  // (If forgetting to markup an inline variable, that barely matters. But a
  // messed up code block can be both long and hard to read.)
  /*
  markupAsInlineCode: function() {
    const newText = wrapSelectedText(this.textareaElm, t.e.exPre, '`');
    this.setState({ text: newText }, this.updatePreviewSoon);
  }, */

  markupAsCode: function() {
    // UX COULD use just `...` if text selected inside a line.
    const text = wrapSelectedText(
            this.textareaElm, t.e.exPre, '\n\n```\n', '\n```\n\n');
    this.setState({ text }, this.updatePreviewSoon);
  },

  quoteText: function() {
    const text = wrapSelectedText(
            this.textareaElm, t.e.exQuoted, '\n\n> ', '\n\n', '\n> ');
    this.setState({ text }, this.updatePreviewSoon);
  },

  addHeading: function() {
    const text = wrapSelectedText(this.textareaElm, t.e.ExHeading, '\n\n### ', '\n\n');
    this.setState({ text });
  },



  render: function() {
    const state: EditorState = this.state;
    const store: DiscStore = this.getDiscStore();

    // Is undef, if in the API section, e.g. typing a direct message to a user.
    const editorsPage: Page | undefined =
        store.pagesById[state.editorsPageId] || store.currentPage;

    const editorsPageType: PageType | undefined = editorsPage?.pageRole;

    const me: Myself = store.me;
    const myUiPrefs: UiPrefs = me_uiPrefs(me);
    const settings: SettingsVisibleClientSide = state.store.settings;
    const isPrivateGroup = page_isPrivateGroup(state.newPageRole);

    // We'll disable the editor, until any draft has been loaded. [5AKBW20] Otherwise one might
    // start typing, and then the draft gets loaded (which might take some seconds if
    // the server was just started, or maybe slow connection) and overwrites the text one
    // has already typed.
    const draftStatus: DraftStatus = state.draftStatus;
    const anyDraftLoaded = draftStatus !== DraftStatus.NotLoaded;


    // ----- Guidelines?

    const guidelines = state.guidelines;
    let guidelinesElem;
    let showGuidelinesBtn;
    if (guidelines && guidelines.safeHtml) {
      if (guidelines.hidden) {
        showGuidelinesBtn =
          r.a({ className: 'icon-info-circled', onClick: this.showGuidelines });
      }
      else if (state.showGuidelinesInModal) {
        // Skip the post-it style guidelines just below.
      }
      else {
        guidelinesElem =
          r.div({ className: 'dw-editor-guidelines-wrap', ref: 'guidelines' },
            r.div({ className: 'dw-editor-guidelines clearfix' },
              r.div({ className: 'dw-editor-guidelines-text',
                dangerouslySetInnerHTML: { __html: state.guidelines.safeHtml }}),
              r.a({ className: 'icon-cancel dw-hide', onClick: this.hideGuidelines }, t.Hide)));
      }
    }

    const guidelinesModal = GuidelinesModal({ guidelines,
        isOpen: guidelines && state.showGuidelinesInModal, close: this.hideGuidelines });


    // ----- Similar topics?

    let similarTopicsTips;
    const searchResults: SearchResults = state.searchResults;

    if (searchResults && state.showSimilarTopics) {
      const urlEncodedQuery = urlEncodeSearchQuery(state.title);
      const searchUrl = '/-/search?q=' + urlEncodedQuery;

      const hitList = !searchResults.pagesAndHits.length ? null :
          r.ul({},
            _.take(searchResults.pagesAndHits, 15).map((pageAndHits: PageAndHits) =>
              r.li({ key: pageAndHits.pageId, className: 's_E_SimlTpcs_L_It' },
                r.a({ href: '/-' + pageAndHits.pageId, target: '_blank' },
                  pageAndHits.pageTitle))));

      similarTopicsTips = !hitList ? null :
        r.div({ className: 's_E_SimlTpcs' },
          r.h4({}, t.e.SimilarTopicsC),
          r.a({ className: 'icon-cancel dw-hide s_E_SimlTpcs_HideB',
              onClick: () => this.setState({ showSimilarTopics: false }) },
            t.Hide),
          r.a({ className: 'icon-search dw-hide s_E_SimlTpcs_SearchB', href: searchUrl,
              target: '_blank' },
            t.Search),
          hitList);
    }

    // Sometimes it's hard to notice that the editor opens. But by making everything very dark,
    // except for the editor, people will see it for sure. We'll make everything dark only for
    // a short while.
    const anyBackdrop = state.backdropOpacity < 0.01 ? null :
        r.div({ className: 'esEdtr_backdrop', style: { opacity: state.backdropOpacity }});


    // ----- Title, page type, category

    let titleInput;
    let pageRoleDropdown;
    let categoriesDropdown;
    if (state.newForumTopicCategoryId || isPrivateGroup) {
      const titleErrorClass = state.showTitleErrors ? ' esError' : '';
      let titlePlaceholder = page_isChat(state.newPageRole) && t.c.TypeTitle ?
                                t.c.TypeTitle : t.e.TitlePlaceholder;
      titleInput =
          r.input({ className: 'title-input esEdtr_titleEtc_title form-control' + titleErrorClass,
              type: 'text', ref: (e: HElm) => this.titleElm = e,
              tabIndex: 1, onChange: this.onTitleEdited,
              value: state.title, disabled: !anyDraftLoaded,
              placeholder: titlePlaceholder,
              onKeyPress: this.onKeyPressOrKeyDown,
              onKeyDown: this.onKeyPressOrKeyDown,
            });

      if (state.newForumTopicCategoryId && !isPrivateGroup &&
          settings_showCategories(settings, me))
        categoriesDropdown =
          SelectCategoryDropdown({ className: 'esEdtr_titleEtc_category', store,
              categories: state.editorsCategories,
              selectedCategoryId: state.newForumTopicCategoryId,
              onCategorySelected: this.changeCategory });

      if (state.newPageRole && settings_selectTopicType(settings, me)) {
        pageRoleDropdown = PageRoleDropdown({ store, pageRole: state.newPageRole,
            complicated: settings.showExperimental,
            onSelect: this.changeNewForumPageRole,
            title: t.TopicType, className: 'esEdtr_titleEtc_pageRole' });
      }
    }

    const editingPostNr = state.editingPostNr;
    const replyToPostNrs = state.replyToPostNrs;
    const isOrigPostReply = _.isEqual([BodyNr], replyToPostNrs);
    const repliesToNotOrigPost = replyToPostNrs.length && !isOrigPostReply;

    // The page might not yet have been created — it's just {} before it gets
    // saved and lazy-created. However, in such a situation, we're inside
    // the editor iframe, at the blog (not at the Talkyard site).
    // Maybe add a [editorsNewLazyPageRole] state field?
    const isBlogPostReply = isOrigPostReply && (
        // Won't work if embedded, and the discussion hasn't yet been lazy-created:
        editorsPage?.pageRole === PageRole.EmbeddedComments ||
        // Works if embedded:
        eds.isInEmbeddedEditor);

    // ----- Delete these?:
    const isChatComment = replyToPostNrs.length === 1 && replyToPostNrs[0] === NoPostId;
    const isMindMapNode = replyToPostNrs.length === 1 && editorsPage.pageRole === PageRole.MindMap;
    // --------------------


    // ----- "Reply to" or "Editing" text

    const whichFrameScrollOpts: ShowPostOpts = { inFrame: state.inFrame };

    let doingWhatInfo: any;
    if (_.isNumber(editingPostNr)) {
      doingWhatInfo =
        r.span({},
          // "Edit post X:"
          t.e.EditPost_1,
          // Dupl code, break out fn? [306KUGSTRR3]  <a href='#post-..'>  + onClick preventDefault?
          r.a({ href: '#post-' + editingPostNr,
              onMouseEnter: () => ReactActions.highlightPost(editingPostNr, true),
              onMouseLeave: () => ReactActions.highlightPost(editingPostNr, false),
              onClick: (event) => {
                event.preventDefault();
                ReactActions.scrollAndShowPost(editingPostNr, whichFrameScrollOpts);
                this.scrollToPreview = true;
              }},
            t.e.EditPost_2 + editingPostNr + ':'));
    }
    else if (state.isWritingChatMessage) {
      doingWhatInfo = t.e.TypeChatMsg;
    }
    else if (state.messageToUserIds.length) {
      doingWhatInfo = t.e.YourMsg;
    }
    else if (state.newPageRole) {
      let what = t.e.CreateTopic;
      switch (state.newPageRole) {
        case PageRole.CustomHtmlPage: what = t.e.CreateCustomHtml; break;
        case PageRole.WebPage: what = t.e.CreateInfoPage; break;
        case PageRole.Code: what = t.e.CreateCode; break;
        case PageRole.SpecialContent: die('DwE5KPVW2'); break;
        case PageRole.EmbeddedComments: die('DwE2WCCP8'); break;
        case PageRole.Blog: die('DwE2WQB9'); break;
        case PageRole.Forum: die('DwE5JKF9'); break;
        case PageRole.About: die('DwE1WTFW8'); break;
        case PageRole.Question: what = t.e.AskQuestion; break;
        case PageRole.Problem: what = t.e.ReportProblem; break;
        case PageRole.Idea: what = t.e.SuggestIdea; break;
        case PageRole.ToDo: what = "Create a todo"; break;
        // Show "Chat" for both these, and let one toggle need-to-join on/off later? UX SHOULD [JoinlessChat]
        case PageRole.JoinlessChat:
        case PageRole.OpenChat: what = t.e.NewChat; break;
        case PageRole.PrivateChat: what = t.e.NewPrivChat; break;
        case PageRole.MindMap: what = "Create a mind map page"; break;
        case PageRole.Discussion: break; // use default
        case PageRole.FormalMessage: die('EsE2KFE78'); break;
        case PageRole.UsabilityTesting: what = "Do usability testing"; break; // [plugin]
      }
      doingWhatInfo = what + ":";
    }
    else if (replyToPostNrs.length === 0) {
      doingWhatInfo = t.e.PleaseSelectPosts;
    }
    else if (isChatComment) {
      doingWhatInfo = "New chat comment:";
    }
    else if (isOrigPostReply && page_isUsabilityTesting(editorsPage.pageRole)) { // [plugin]
      //doingWhatInfo = "Your usability testing video link + description:";
      doingWhatInfo = "Your feedback and answers to questions:";
    }
    else if (isMindMapNode) {
      doingWhatInfo = "Add mind map node:";
    }
    else if (state.anyPostType === PostType.BottomComment && !repliesToNotOrigPost) {
      doingWhatInfo = t.e.AppendComment;
    }
    else if (isBlogPostReply) {
      // Blog post author name is unknown. (There's an orig post by System,
      // but "Replying to @system" would be incorrect.)
      doingWhatInfo = t.e.AddCommentC;
    }
    else if (replyToPostNrs.length > 0) {
      doingWhatInfo =
        r.span({},
          t.e.ReplyTo,
          _.filter(replyToPostNrs, (id) => id !== NoPostId).map((replToPostNr, index) => {
            // If replying to a blog post, then, it got auto created by the System
            // user. Don't show "Reply to System".

            const replToPost: Post | U = editorsPage?.postsByNr[replToPostNr];
            const replToAuthor: Pat | U =
                    replToPost && store_getAuthorOrMissing(store, replToPost);

            let replyingToWhat;
            if (replToAuthor) {
              replyingToWhat = UserName({ user: replToAuthor, settings,
                  makeLink: false, onClick: null, avoidFullName: true });
            }
            else {
              replyingToWhat = replToPostNr === BodyNr ?
                  t.e.ReplyTo_theOrigPost : t.e.ReplyTo_post + replToPostNr;
            }

            const anyAnd = index > 0 ? " and " : '';
            return (
              (<any> r.span)({ key: replToPostNr },   // span has no .key, weird [TYPEERROR]
                anyAnd,
                // Dupl code, break out fn? [306KUGSTRR3]  <a href='#post-..'>  + onClick preventDefault?
                r.a({
                  onMouseEnter: () => ReactActions.highlightPost(replToPostNr, true),
                  onMouseLeave: () => ReactActions.highlightPost(replToPostNr, false),
                  onClick: !replToPost ? undefined : () => {
                    ReactActions.scrollAndShowPost(replToPost, whichFrameScrollOpts);
                    // Stop auto scrolling the preview into view — since pat
                    // apparently wants to view the post hen is replying to.
                    // (If clicking Show Preview, we'll resume auto scrolling into view.)
                    this.scrollToPreview = false;
                  }},
                  replyingToWhat)));
          }),
          ':');
    }

    // ----- Anon comments

    // By default, anon posts are disabled, and the "post as ..." dropdown left out.

    let maybeAnonymously: RElm | U;
    if (!me.isAuthenticated) {
      // Only logged in users can post anonymously. (At least for now.)
    }
    else if (state.discProps?.comtsStartAnon >= NeverAlways.Allowed ||
          // If pat 1) is already talking, using an anonym, or 2) has started composing
          // a draft, as anon, but then an admin changed the settings, so cannot
          // be anon any more.  Then it's nevertheless ok to continue, anonymously.
          // (That's what "continue" in NeverAlways.NeverButCanContinue means.)
          // ANON_UNIMPL, UNPOLITE, SHOULD add some server side check, so no one toggles
          // this in the browser only, and the server accepts?  [derive_node_props_on_server]
          // But pretty harmless.
          state.doAsAnon) {
      maybeAnonymously =
          Button({ className: 'c_AliasB', ref: 'aliasB', onClick: () => {
            const atRect = reactGetRefRect(this.refs.aliasB);
            anon.openAnonDropdown({ atRect, open: true, 
                curAnon: state.doAsAnon, me,
                myAliasOpts: state.myAliasOpts,
                discProps: state.discProps,
                saveFn: (doAsAnon: MaybeAnon) => {
                  const newState: Partial<EditorState> = { doAsAnon };
                  this.setState(newState);
                  // The avatar we're showing, might need to change.
                  // (WOULD_OPTIMIZE: Only do if in-page preview, otherwise one's
                  // avatar & name isn't shown anyway.)
                  this.updatePreviewSoon();
                } });
          } },
          anon.whichAnon_titleShort(state.doAsAnon, { me }),
          ' ', r.span({ className: 'caret' }));
    }

    // ----- Save button

    function makeSaveTitle(brief, extra) {
      if (!extra) return brief;
      return r.span({}, brief, r.span({ className: 'esE_SaveB_Verbose' }, ' ' + extra));
    }

    let saveButtonTitle = t.Save;
    let cancelButtonTitle = t.Cancel;  // UX should be entitled  t.SaveDraft  instead?  I18N
    let textareaPlaceholder = t.e.TypeHerePlaceholder;

    if (_.isNumber(editingPostNr)) {
      saveButtonTitle = makeSaveTitle(t.e.Save, t.e.edits);
    }
    else if (isBlogPostReply) {
      saveButtonTitle = t.e.PostComment || t.e.PostReply;   // I18N  t.e.PostComment missing
    }
    else if (replyToPostNrs.length) {
      if (isChatComment) {
        saveButtonTitle = makeSaveTitle(t.e.Post, t.e.comment);
      }
      else if (isMindMapNode) {
        saveButtonTitle = makeSaveTitle("Add", " node");
      }
      else {
        saveButtonTitle = t.e.PostReply;
        if (isOrigPostReply && page_isUsabilityTesting(editorsPage.pageRole)) { // [plugin]
          //saveButtonTitle = makeSaveTitle("Submit", " video");
          saveButtonTitle = makeSaveTitle("Submit", " feedback");
        }
      }
    }
    else if (state.isWritingChatMessage) {
      saveButtonTitle = t.e.PostMessage;
      cancelButtonTitle = t.e.SimpleEditor;
    }
    else if (state.messageToUserIds.length) {
      saveButtonTitle = makeSaveTitle(t.e.Send, t.e.message);
    }
    else if (state.newPageRole) {
      switch (state.newPageRole) {
        case PageRole.CustomHtmlPage:
        case PageRole.WebPage:
        case PageRole.Code:
          saveButtonTitle = makeSaveTitle(t.e.Create, t.e.page);
          break;
        case PageRole.JoinlessChat:
        case PageRole.OpenChat:
        case PageRole.PrivateChat:
          saveButtonTitle = makeSaveTitle(t.e.Create, t.e.chat);
          textareaPlaceholder = t.c.TypePurpose ||
                "Type here — tell others what this chat is about, its purpose.";  // I18N
          break;
        case PageRole.Question: saveButtonTitle = makeSaveTitle(t.e.Post, t.e.question); break;
        case PageRole.Problem: saveButtonTitle = makeSaveTitle(t.e.Submit, t.e.problem); break;
        case PageRole.Idea: saveButtonTitle = makeSaveTitle(t.e.Create, t.e.idea); break;
        case PageRole.ToDo: saveButtonTitle = makeSaveTitle("Create", " to-do"); break;
        case PageRole.MindMap: saveButtonTitle = makeSaveTitle("Create", " mind map"); break;
        default:
          saveButtonTitle = makeSaveTitle(t.e.Create, t.e.topic);
      }
    }


    // ----- Misc (move elsewhere?)

    let anyViewHistoryButton;
    if (state.editingPostRevisionNr && state.editingPostRevisionNr !== 1) {
      anyViewHistoryButton =
          r.a({ onClick: this.showEditHistory, className: 'view-edit-history', tabIndex: 1 },
            t.e.ViewOldEdits);
    }

    // If not visible, don't remove the editor, just hide it, so we won't have
    // to unrigister the mentions parser (that would be boring).
    const styles = {
      display: state.visible ? 'block' : 'none'
    };


    // ----- Textarea and editor buttons

    const textareaButtons =
      r.div({ className: 'esEdtr_txtBtns' },
        r.button({ onClick: this.selectAndUploadFile, title: t.e.UploadBtnTooltip,
            className: 'esEdtr_txtBtn e_UplB' },
          r.span({ className: 'icon-upload' })),
        !me.effAlwUplExts.length ? null :
          r.input({ name: 'files', type: 'file', multiple: false, // dupl code [2UK503]
            className: 'e_EdUplFI',
            ref: 'uploadFileInput', style: { width: 0, height: 0, float: 'left' }}),
        r.button({ onClick: this.makeTextBold, title: t.e.BoldBtnTooltip,
            className: 'esEdtr_txtBtn' }, 'B'),
        r.button({ onClick: this.makeTextItalic, title: t.e.EmBtnTooltip,
          className: 'esEdtr_txtBtn esEdtr_txtBtn-em' }, r.i({}, 'I')),
        r.button({ onClick: this.quoteText, title: t.e.QuoteBtnTooltip,
          className: 'esEdtr_txtBtn' }, '"'),
        r.button({ onClick: this.markupAsCode, title: t.e.PreBtnTooltip,
          className: 'esEdtr_txtBtn' }, r.span({ className: 'icon-code' })),
        r.button({ onClick: this.addHeading, title: t.e.HeadingBtnTooltip,
            className: 'esEdtr_txtBtn' }, 'H'),
        r.button({  // title: t.e.FmtHelpTooltip, // I18N
            className: 'esEdtr_txtBtn n_FmtHlp',
            onClick: () => util.openDefaultStupidDialog(formattingHelp()) },
          'Help ...'), // I18N
        );

    // React-textarea-autocomplete docs:
    //   https://github.com/webscopeio/react-textarea-autocomplete

    const textErrorClass = state.showTextErrors ? ' esError' : '';
    const textarea =
        !anyDraftLoaded ? r.pre({ className: 'e_LdDft' }, t.e.LoadingDraftDots) :
          ReactTextareaAutocomplete({
            className: 'editor form-control esEdtr_textarea' +  textErrorClass,
            ref: rta => { this.rta = rta; },
            innerRef: (e: HTMLTextAreaElement) => {
              this.textareaElm = e;
              // The cursor starts at 0, in a newly appearing <textarea>?
              this.setState({ caretPos: 0 });
              // Don't focus — maybe should focus the topic title <input>
              // instead (if any).
            },
            onCaretPositionChange: (caretPos: Nr) => {
              if (state.caretPos !== caretPos) {
                this.setState({ caretPos });
              }
            },

            // Inside what elem to place the autocomplete popup — defaults to <body>
            // but that means the popup can overflow above the win top.
            // Doesn't work:
            // boundariesElement: '.s_E-E',  // also doesn't work:  this.refs.editor,
            // Instead, custom CSS: [rta_overfl_top_bgfx]
            // Or could:
            // rtaListElm.style.top = (rtaListElm.offsetTop - rect.y) + 'px';
            // But when? There're no appropriate events to listen for?

            movePopupAsYouType: true,
            value: state.text,
            onChange: this.onTextEdited,
            onKeyPress: this.onKeyPressOrKeyDown,  // ? maybe bind to textarea instead?
            onKeyDown: this.onKeyPressOrKeyDown,   // ?
            tabIndex: 1,
            placeholder: textareaPlaceholder ,
            loadingComponent: () => r.span({}, t.Loading),

            // Currently the server says Forbidden unless one is logged in, when listing usernames.
            // UX COULD list usernames of users already loaded & visible anyway, if not logged in?
            // BUT emojis, nice also if not yet logged in. So pass an is-logged-in
            // getter-fn to a trigger constructor instead?
            trigger: me.isLoggedIn ? listUsernamesTrigger : {} });


    // ----- Preview

    const thereIsAnInPagePreview =
        me_uiPrefs(me).inp !== UiPrefsIninePreviews.Skip &&
        // If we're creating a new page, there's not any place to show an in-page preview.
        !(state.newForumTopicCategoryId || state.newPageRole);

    // Don't show any in-editor preview, if we're showing an in-page preview,
    // and hasn't configured double previews (in editor too).
    // UX Actually, always show double previews, if replying, and wide screen? [showPreviewWhere]
    const skipInEditorPreview =
        thereIsAnInPagePreview &&
        myUiPrefs.inp !== UiPrefsIninePreviews.Double &&
        // If the editor is full screen (i.e. textarea and preview split screen),
        // then show an in-editor preview as usual.
        !(state.showMaximized || state.splitHorizontally || state.showOnlyPreview);

    const previewHelp = skipInEditorPreview ? null :
        r.div({ className: 'dw-preview-help' },
          help.HelpMessageBox({ message: previewHelpMessage }));

    const previewTitleTagName = !thereIsAnInPagePreview ? 'span' : 'a';

    const scrollToPreviewProps = !thereIsAnInPagePreview ? {} : {
      onMouseEnter: () => ReactActions.highlightPreview(true),
      onMouseLeave: () => ReactActions.highlightPreview(false),
      onClick: () => {
        ReactActions.scrollToPreview({
          isEditingBody: state.editingPostNr === BodyNr,
          isChat: page_isChat(editorsPageType),
        });
        // Also resume auto-scrolling the preview into view, if typing more text.
        this.scrollToPreview = true;
      },
    };

    const previewTitle = skipInEditorPreview ? null :
        r.div({},
          r[previewTitleTagName](scrollToPreviewProps,
            t.e.PreviewC + (titleInput ? t.e.TitleExcl : '')));

    // If no in-editor preview, instead well include a "Scroll to preview" button
    // above the textarea.
    const scrollToPreviewBtn = !skipInEditorPreview || !thereIsAnInPagePreview ? null :
        r.a({ ...scrollToPreviewProps, className: 's_E_ScrPrvwB' }, t.ShowPreview);

    let editorClasses = skipInEditorPreview ? 's_E-NoInEdPrvw' : 's_E-WithInEdPrvw';


    // ----- Editor size

    editorClasses += eds.isInEmbeddedEditor ? '' : ' editor-box-shadow';
    editorClasses += state.placeLeft ? ' c_E-PlaceLeft' : '';
    editorClasses += state.showMaximized ? ' s_E-Max' : '';
    editorClasses += state.splitHorizontally ? ' s_E-SplitHz' : '';
    editorClasses += state.showMinimized ? ' s_E-Min' : (
        state.showOnlyPreview ? ' s_E-Prv' : ' s_E-E');

    const editorStyles = state.showOnlyPreview ? { display: 'none' } : null;
    const previewStyles = state.showOnlyPreview ? { display: 'block' } : null;

    // [.cycle_editor_layout]
    const editorLayoutIndexAndName =
        !state.showMaximized
            ? (state.canPlaceLeft && !state.placeLeft
                  ? [2, t.e.PlaceLeft || "Place left"]
                  : [3, t.e.Maximize])
            : (state.splitHorizontally
                  ? [1, t.e.ToNormal]
                  : [4, t.e.TileHorizontally]);

    const editorLayoutIndex = editorLayoutIndexAndName[0];
    const maximizeAndHorizSplitBtnTitle = editorLayoutIndexAndName[1];

    // ----- Draft status

    const draft: Draft = state.draft;
    const draftNr = draft ? draft.draftNr : NoDraftNr;

    const draftStatusText =
        DraftStatusInfo({
          draftStatus, draftNr, draftErrorStatusCode: state.draftErrorStatusCode });


    // ----- The result

    return (
      r.div({ style: styles },
        guidelinesModal,
        anyBackdrop,
        r.div({ id: 'debiki-editor-controller', ref: 'editor', className: editorClasses },
          r.button({ className: 'esEdtr_close esCloseCross', onClick: this.onCancelClick }),
          guidelinesElem,
          similarTopicsTips,
          r.div({ id: 'editor-after-borders' },
            r.div({ className: 'editor-area', style: editorStyles },
              r.div({ className: 'editor-area-after-borders' },
                r.div({ className: 's_E_DoingRow' },
                  state.placeLeft ? topbar.OpenWatchbarButton() : null,
                  r.span({ className: 's_E_DoingWhat' }, doingWhatInfo),
                  maybeAnonymously,
                  showGuidelinesBtn,
                  scrollToPreviewBtn,
                  draftStatusText),
                r.div({ className: 'esEdtr_titleEtc' },
                  // COULD use https://github.com/marcj/css-element-queries here so that
                  // this will wrap to many lines also when screen wide but the editor is narrow.
                  titleInput,
                  // Wrap in a div so will appear on the same line also when flex-dir = column.
                  r.div({},
                    categoriesDropdown,
                    pageRoleDropdown)),
                textareaButtons,
                textarea)),
             skipInEditorPreview ? null :
               r.div({ className: 'preview-area', style: previewStyles },
                previewTitle,
                previewHelp,
                r.div({ className: 'preview', id: 't_E_Preview',
                    dangerouslySetInnerHTML: { __html: state.safePreviewHtml }})),
            r.div({ className: 'submit-cancel-btns' },
              PrimaryButton({ onClick: this.onSaveClick, tabIndex: 1, className: 'e_E_SaveB' },
                saveButtonTitle),
              Button({ onClick: this.onCancelClick, tabIndex: 1, className: 'e_EdCancelB' },
                cancelButtonTitle),
              Button({ onClick: this.cycleMaxHorizBack,
                  className: 'esEdtr_cycleMaxHzBtn c_EdLayout-' + editorLayoutIndex,
                  tabIndex: 4 }, maximizeAndHorizSplitBtnTitle),
              // These two buttons are hidden via CSS if the window is wide. Higher tabIndex
              // because float right.
              Button({ onClick: this.toggleMinimized, id: 'esMinimizeBtn',
                  primary: state.showMinimized, tabIndex: 3 },
                state.showMinimized ? t.e.ShowEditorAgain : t.e.Minimize),
              Button({ onClick: this.togglePreview, id: 'esPreviewBtn', tabIndex: 2 },
                state.showOnlyPreview ? t.EditV : t.PreviewV),
              anyViewHistoryButton)),
            r.div({ className: 's_E_iPhoneKbd' },
              t.e.IPhoneKbdSpace_1, r.br(), t.e.IPhoneKbdSpace_2),

            eds.isInEmbeddedEditor ? null :  // [RESEMBEDTR]
              r.div({ className: 's_Resizor-Up', ref: 'resizeHandle' }),
          )));
  }
});



const GuidelinesModal = createClassAndFactory({
  displayName: 'GuidelinesModal',

  render: function () {
    const body = !this.props.isOpen ? null :
      r.div({ className: 'dw-editor-guidelines-text',
        dangerouslySetInnerHTML: { __html: this.props.guidelines.safeHtml }});
    return (
      rb.Modal({ show: this.props.isOpen, onHide: this.props.close,
          dialogClassName: 'es-guidelines-modal' },
        rb.ModalBody({}, body),
        rb.ModalFooter({},
          Button({ onClick: this.props.close, className: 'e_CloseGuidelinesB' }, t.Okay))));
  }
});



function page_isUsabilityTesting(pageType: PageRole): boolean {  // [plugin]
  return pageType === PageRole.UsabilityTesting;
}



function wrapSelectedText(textarea: HTMLTextAreaElement, placeholder: St,
      wrap: St, wrapAfter?: St, newlines?: St) {
  const startIndex = textarea.selectionStart;
  const endIndex = textarea.selectionEnd;
  const selectedText = textarea.value.substring(startIndex, endIndex);
  const textBefore = textarea.value.substring(0, startIndex);
  const textAfter = textarea.value.substring(endIndex);

  // [ed_toolbr_2_newl]
  const twoNewlinesAlready = wrap.startsWith('\n\n') && /^\s*$|\n\n$/.test(textBefore);
  const oneNewlineAlready = wrap.startsWith('\n') && /^\s*$|\n$/.test(textBefore);
  const wrapMaybeTrimmed =
          twoNewlinesAlready ? wrap.substr(2) : (
              oneNewlineAlready ? wrap.substr(1) : wrap);
  const contentWithNewlines = !selectedText ? placeholder : (
          newlines ? selectedText.replace(/\n/gm, newlines) : selectedText);
  if (notVal(wrapAfter)) wrapAfter = wrap;
  return (textBefore +
            wrapMaybeTrimmed +
            contentWithNewlines +
            (wrapAfter || '') +
          textAfter);
}



function makeDefaultReplyText(store: DiscStore, postIds: PostId[]): string {
  const page: Page = store.currentPage;
  let result = '';
  // For UTX replies, include the instructions, in bold-italic lines,  [2JFKD0Y3]
  // so people can write their replies in between.
  if (page.pageRole === PageRole.UsabilityTesting &&  // [plugin]
      postIds.length === 1 && postIds[0] === BodyNr) {
    const origPost: Post = page.postsByNr[BodyNr];
    if (!origPost) return '';
    const elemsInclText: HTMLCollection = $h.parseHtml(origPost.sanitizedHtml);
    // Remove top level text elems (only whitespace and newlines?), and anything after any <hr>
    // — so it's possible to add background info, without including it in the actual instructions.
    let afterHr = false;
    const elems = _.filter(elemsInclText, (elem: HTMLElement) => {
      if (elem.nodeType === 3)  // text elem
        return false;
      if (elem.nodeType === 1 && elem.nodeName === 'HR')
        afterHr = true;
      return !afterHr;
    });

    // Remove "Go to: ... And answer the questions", which should be the first 2 paragraphs:
    elems.splice(0, 2);
    _.each(elems, (elem: HTMLElement) => {
      // UTX specific CSS makes these H5 titles look nice, a bit like quotes.
      // Add ##### both before each paragraph, and also before each line in the paragraphs,
      // in case there's just one paragraph with newline ('\n' = <br>) separated instructions.
      result += '##### ' + elem.innerText.replace('#', '\\#').replace(/\n+/g, '\n\n##### ') + '\n\n';
    });
    // Remove "[...", e.g. "[Edit: ...]", lines. They've been prefixed with '#####'.
    result = result.replace(/\n+##### \[[^\n]*/g, '');
    result = result.trim() + '\n';
  }
  return result;
}



// We currently don't save any draft server side, for the 1st embedded comment  [BLGCMNT1]
// on a new blog post, because the embedded page hasn't yet been created (it gets created
// lazily when the 1st reply is posted [4AMJX7]); there's no page id to use in the
// draft locator. Could use the embedding URL though, or data-discussion-id="..."
// embedding page html tag attr.
function isEmbeddedNotYetCreatedPage(props: { store: DiscStore, messageToUserIds }): Bo {
  // If is-no-page, then the page doesn't exist. However, we might be in the user
  // profile section, composing a reply or a direct message to someone — then we
  // do save drafts.
  const result =
      debiki2.isNoPage(eds.embeddedPageId) &&
      debiki2.isNoPage(props.store.currentPageId) &&
      !props.messageToUserIds.length && // could skip this?
      eds.isInIframe;
  // @ifdef DEBUG
  dieIf(result && !eds.isInEmbeddedEditor, 'TyE7KBTF32');
  // @endif
  return result;
}

const previewHelpMessage = {
  id: 'EdH7MF24',
  version: 1,
  content:
      r.span({}, t.e.PreviewInfo,
        r.br(), t.e.CannotType)
};


export function DraftStatusInfo(props: { draftStatus: DraftStatus, draftNr: number,
       draftErrorStatusCode?: number }) {

  let draftStatusText;
  let draftErrorClass = '';
  const draftNr: number | string = props.draftNr || '';
  const draftErrorStatusCode: number | undefined = props.draftErrorStatusCode;

  switch (props.draftStatus) {
    case DraftStatus.NotLoaded: draftStatusText = t.e.LoadingDraftDots; break;
    case DraftStatus.NothingHappened: break;
    case DraftStatus.EditsUndone: draftStatusText = t.e.DraftUnchanged; break;
    case DraftStatus.SavedInBrowser: draftStatusText = t.e.DraftSavedBrwsr; break;
    case DraftStatus.SavedServerSide: draftStatusText = t.e.DraftSaved(draftNr); break;
    case DraftStatus.Deleted: draftStatusText = t.e.DraftDeleted(draftNr); break;
    case DraftStatus.ShouldSave: draftStatusText = t.e.WillSaveDraft(draftNr); break;
    case DraftStatus.SavingSmall: draftStatusText = t.e.SavingDraft(draftNr); break;
    // UX COULD show in modal dialog, and an "Ok I'll wait until you're done" button, and a Cancel button.
    case DraftStatus.SavingBig: draftStatusText = t.e.SavingDraft(draftNr); break;
    case DraftStatus.Deleting: draftStatusText = t.e.DeletingDraft(draftNr); break;
    case DraftStatus.CannotSave:
      draftErrorClass = ' s_DfSts-Err';
      let details: string;
      if (draftErrorStatusCode === 403) details = "Access denied";
      else if (draftErrorStatusCode === 429) details = "Too many requests";
      else if (draftErrorStatusCode) details = "Error " + draftErrorStatusCode;
      else details = t.ni.NoInet;
      draftStatusText = t.e.CannotSaveDraftC + ' ' + details;
      break;
  }

  return !draftStatusText ? null :
       r.span({ className: 's_DfSts e_DfSts-' + props.draftStatus + draftErrorClass }, draftStatusText);
}



//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
