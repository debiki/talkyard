/*
 * Copyright (c) 2015-2016 Kaj Magnus Lindberg
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
/// <reference path="../react-bootstrap-old/Input.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.titleeditor {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const SelectCategoryDropdown = editor.SelectCategoryDropdown;
const ModalDropdownButton = utils.ModalDropdownButton;

const MaxSlugLength = 100;  // sync with Scala [MXPGSLGLN]


interface TitleEditorPops {
  closeEditor: () => V;
  store: Store;
}

interface TitleEditorState {
  categoryId: CatId;
  pageRole: PageRole;
  editorScriptsLoaded?: Bo;
  // (Alternatively, could keep these changes in the Store [.only_store], and re-render when
  // the store changes? But the current approach (simpleChanges here) works fine too.)
  simpleChanges?: Partial<Page>;
  showComplicated?: Bo;
  // -- COULD wrap these in a advChanges obj? ------
  folder?: St;
  showId?: Bo;
  slug?: St;
  htmlTagCssClasses?: St;
  htmlHeadTitle?: St;
  htmlHeadDescription?: St;
  // -----------------------------------------------
  isSaving?: Bo;
}



export const TitleEditor = createComponent({
  displayName: 'TitleEditor',

  getInitialState: function() {
    const props: TitleEditorPops = this.props;
    const store: Store = props.store;
    const page: Page = store.currentPage;
    return {
      pageRole: page.pageRole,
      categoryId: page.categoryId,
    };
  },

  componentDidMount: function() {
    // COULD load title source text here instead of always including it server side [5S02MR4].
    Server.loadEditorAndMoreBundles(() => {
      if (this.isGone) return;
      this.setState({ editorScriptsLoaded: true });
    });
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  showSettings: function() {
    const props: TitleEditorPops = this.props;
    const store: Store = props.store;
    const page: Page = store.currentPage;
    const newState: Partial<TitleEditorState> = {
      simpleChanges: {
        pageLayout: page.pageLayout,
        forumSearchBox: page.forumSearchBox,
        forumMainView: page.forumMainView,
        forumCatsTopics: page.forumCatsTopics,
      },
    };
    this.setState(newState);
  },

  showComplicated: function() {
    const props: TitleEditorPops = this.props;
    const store: Store = props.store;
    const page: Page = store.currentPage;
    const pagePath: PagePath = page.pagePath;
    const newState: Partial<TitleEditorState> = {
      showComplicated: true,
      folder: pagePath.folder,
      slug: pagePath.slug,
      showId: pagePath.showId,
      htmlTagCssClasses: page.pageHtmlTagCssClasses || '',
      htmlHeadTitle: page.pageHtmlHeadTitle,
      htmlHeadDescription: page.pageHtmlHeadDescription,
    };
    this.setState(newState);
  },

  onTitleChanged: function(event) {
    const props: TitleEditorPops = this.props;
    const store: Store = props.store;
    const page: Page = store.currentPage;
    const idWillBeInUrlPath = this.refs.showIdInput ?
        this.refs.showIdInput.getChecked() : page.pagePath.showId; // isIdShownInUrl();
    if (!idWillBeInUrlPath) {
      // Then don't automatically change the slug to match the title, because links are more fragile
      // when no id included in the url, and might break if we change the slug. Also, the slug is likely
      // to be something like 'about' (for http://server/about) which we want to keep unchanged.
      return;
    }
    const editedTitle = event.target.value;
    const slugMatchingTitle: string = window['debikiSlugify'](editedTitle);
    this.setState({ slug: slugMatchingTitle.substr(0, MaxSlugLength) });
  },

  // COULD_OPTIMIZE SMALLER_BUNDLE inline all these
  onCategoryChanged: function(categoryId: CategoryId) {
    this.setState({ categoryId: categoryId });
  },

  onPageRoleChanged: function(pageRole) {
    this.setState({ pageRole: pageRole });
  },

  onFolderChanged: function(event) {
    this.setState({ folder: event.target.value });
  },

  onSlugChanged: function(event) {
    this.setState({ slug: event.target.value });
  },

  onShowIdChanged: function(event) {
    this.setState({ showId: event.target.checked });
  },

  save: function() {
    this.setState({ isSaving: true });
    var newTitle = this.refs.titleInput.getValue();
    var pageSettings = this.getSettings();
    // This'll keep any layout changes, so the current user won't need to reload the page.
    ReactActions.editTitleAndSettings({ ...pageSettings, newTitle }, () => {
      document.title = newTitle; // also done here: [30MRVH2]
      if (this.isGone) return;
      const props: TitleEditorPops = this.props;
      props.closeEditor();
    }, () => {
      this.setState({ isSaving: false });
    });
  },

  cancel: function() {
    const props: TitleEditorPops = this.props;
    const state: TitleEditorState = this.state;
    if (state.simpleChanges) {
      // Clear any unsaved changes.
      const patch: PageTweaksStorePatch = { curPageTweaks: {} };
      ReactActions.patchTheStore(patch);
    }
    props.closeEditor();
  },

  getSettings: function() {
    const state: TitleEditorState = this.state;
    var settings: any = {
      categoryId: state.categoryId,
      pageRole: state.pageRole,
      ...state.simpleChanges,
      folder: addFolderSlashes(state.folder),
      slug: state.slug,
      showId: state.showId,
      htmlTagCssClasses: state.htmlTagCssClasses,
      htmlHeadTitle: state.htmlHeadTitle,
      htmlHeadDescription: state.htmlHeadDescription,
    };
    return settings;
  },

  render: function() {
    const props: TitleEditorPops = this.props;
    const state: TitleEditorState = this.state;
    const simpleChanges: Partial<Page> | U = state.simpleChanges;
    const store: Store = props.store;
    const page: Page = store_curPage(store);
    const me: Myself = store.me;
    const settings: SettingsVisibleClientSide = store.settings;
    const pageRole: PageRole = page.pageRole;
    const titlePost: Post = page.postsByNr[TitleNr];
    const isForum = pageRole === PageRole.Forum;

    if (!state.editorScriptsLoaded) {
      // The title is not shown, so show some whitespace to avoid the page jumping upwards.
      return r.div({ style: { height: 80 }});
    }

    let layoutAndSettings: RElm | U;
    if (simpleChanges) {
      const layoutBtnTitle = r.span({},
          topicListLayout_getName(simpleChanges.pageLayout) + ' ',
          r.span({ className: 'caret' }));

      const setLayoutFn = (pageLayout: PageLayout) => changeSthFn({ pageLayout });

      const changeSthFn = (moreChanges: Partial<Page>) => () => {
        const newChanges = { ...simpleChanges, ...moreChanges };
        // (Could maybe skip setState, and only use the store?  [.only_store])
        this.setState({ simpleChanges: newChanges });
        const patch: PageTweaksStorePatch = {
          curPageTweaks: { ...store.curPageTweaks, ...newChanges },
        };
        ReactActions.patchTheStore(patch);
      };

      layoutAndSettings =
          r.div({ className: 'form-horizontal', key: 'layout-settings-key' },

            Input({ type: 'checkbox', label: "Show search box",
                wrapperClassName: 'col-xs-offset-2 col-xs-10',
                className: 'e_SearchFld',
                checked: simpleChanges.forumSearchBox === 2,
                onChange: changeSthFn({
                  forumSearchBox: simpleChanges.forumSearchBox === ShowSearchBox.Yes ?
                      ShowSearchBox.No : ShowSearchBox.Yes }),
                }),

            Input({ type: 'custom', label: "Topic list layout",
                labelClassName: 'col-xs-2', wrapperClassName: 'col-xs-10' },
              ModalDropdownButton({ title: layoutBtnTitle },
                r.ul({ className: 'dropdown-menu' },
                  MenuItem({ onClick: setLayoutFn(TopicListLayout.TitleOnly) },
                    topicListLayout_getName(TopicListLayout.TitleOnly)),
                  MenuItem({ onClick: setLayoutFn(TopicListLayout.TitleExcerptSameLine) },
                    topicListLayout_getName(TopicListLayout.TitleExcerptSameLine)),
                  MenuItem({ onClick: setLayoutFn(TopicListLayout.ExcerptBelowTitle) },
                    topicListLayout_getName(TopicListLayout.ExcerptBelowTitle)),
                  MenuItem({ onClick: setLayoutFn(TopicListLayout.ThumbnailsBelowTitle) },
                    topicListLayout_getName(TopicListLayout.ThumbnailsBelowTitle)),
                  MenuItem({ onClick: setLayoutFn(TopicListLayout.NewsFeed) },
                    topicListLayout_getName(TopicListLayout.NewsFeed))))));
    }

    let complicatedStuff: RElm | U;
    if (state.showComplicated) {
      const dashId = state.showId ? '-' + page.pageId : '';
      let slashSlug =  state.slug;
      if (dashId && slashSlug) slashSlug = '/' + slashSlug;
      const url = location.protocol + '//' + location.host +
          addFolderSlashes(state.folder) + dashId + slashSlug;

      const anyMetaTitleAndDescription = pageRole !== PageRole.Forum ? null :
        r.div({ className: 'esTtlEdtr_metaTags' },
          Input({ label: "SEO title", type: 'text',
            labelClassName: 'col-xs-2', wrapperClassName: 'col-xs-10',
            value: state.htmlHeadTitle,
            onChange: (event) => this.setState({ htmlHeadTitle: event.target.value }),
            help: "Custom title for Search Engine Optimization (SEO). Will be inserted " +
              "into the <html><head><title> tag."}),
          Input({ label: "SERP description", type: 'textarea',
            labelClassName: 'col-xs-2', wrapperClassName: 'col-xs-10',
            value: state.htmlHeadDescription,
            onChange: (event) => this.setState({ htmlHeadDescription: event.target.value }),
            help: "Page description, for Search Engine Result Pages (SERP). Will be inserted " +
                "into the <html><head><meta name='description' content='...'> attribute." }));


      // Forum pages must not have a slug (then /latest etc suffixes won't work),
      // and should not show the page id.
      const anyUrlAndCssClassEditor = !store.settings.showExperimental ? null :
        r.div({ className: 'esTtlEdtr_urlSettings' },
          r.p({}, r.b({}, "Ignore this "), "— unless you understand URL addresses and CSS."),
          isForum ? null : Input({ label: 'Page slug', type: 'text', ref: 'slugInput',
            className: 'dw-i-slug', labelClassName: 'col-xs-2', wrapperClassName: 'col-xs-10',
            value: state.slug, onChange: this.onSlugChanged,
            help: "The name of this page in the URL."}),
          Input({ label: 'Folder', type: 'text', ref: 'folderInput', className: 'dw-i-folder',
            labelClassName: 'col-xs-2', wrapperClassName: 'col-xs-10',
            value: state.folder, onChange: this.onFolderChanged,
            help: "Any /url/path/ to this page." }),
          isForum ? null : Input({ label: 'Show page ID in URL', type: 'checkbox', ref: 'showIdInput',
            wrapperClassName: 'col-xs-offset-2 col-xs-10',
            className: 'dw-i-showid', checked: state.showId,
            onChange: this.onShowIdChanged }),
          r.p({}, "The page URL will be: ", r.kbd({}, url)),
          Input({ label: 'CSS class', type: 'text', className: 'theCssClassInput',
            labelClassName: 'col-xs-2', wrapperClassName: 'col-xs-10',
            value: state.htmlTagCssClasses,
            onChange: (event) => this.setState({ htmlTagCssClasses: event.target.value }),
            help: r.span({}, "The CSS classes you type here will be added to the ",
                r.kbd({}, '<html class="...">'), " attribute.") }));

      complicatedStuff =
        r.div({},
          r.div({ className: 'dw-compl-stuff form-horizontal', key: 'compl-stuff-key' },
            anyMetaTitleAndDescription,
            anyUrlAndCssClassEditor));
    }

    // Once more stuff has been shown, one cannot hide it, except by cancelling
    // the whole dialog. Because if hiding it, then what about any changes made? Save or ignore?

    const layoutAndSettingsButton =
        simpleChanges || !me.isAdmin || pageRole !== PageRole.Forum ||
              settings.enableForum === false
          ? null
          : r.a({ className: 'esTtlEdtr_openAdv icon-wrench', onClick: this.showSettings },
              "Layout and settings");

    const existsAdvStuffToEdit = pageRole === PageRole.Forum || store.settings.showExperimental;
    const advancedStuffButton = !existsAdvStuffToEdit ||
        state.showComplicated || !me.isAdmin || pageRole === PageRole.FormalMessage ||
              settings.enableForum === false
          ? null
          : r.a({ className: 'esTtlEdtr_openAdv icon-settings', onClick: this.showComplicated },
              "Advanced");

    const selectCategoryInput =
        !page_canChangeCategory(page) || !settings_showCategories(settings, me) ? null :
      // UX BUG  col-xs-2 beomes needlessly small, when screen narrow.
      Input({ type: 'custom', label: t.Category, labelClassName: 'col-xs-2',
            wrapperClassName: 'col-xs-10' },
          SelectCategoryDropdown({ store: props.store, pullLeft: true,
            selectedCategoryId: state.categoryId,
            onCategorySelected: this.onCategoryChanged }));

    const selectTopicType =
        !page_mayChangeRole(pageRole) || !settings_selectTopicType(settings, me) ? null :
      Input({ type: 'custom', label: t.TopicType, labelClassName: 'col-xs-2',
          wrapperClassName: 'col-xs-10' },
        editor.PageRoleDropdown({ store, pageRole: state.pageRole, pageExists: true,
          onSelect: this.onPageRoleChanged, pullLeft: true,
          complicated: store.settings.showExperimental,
          className: 'esEdtr_titleEtc_pageRole' }));

    let addBackForumIntroButton;
    if (page.pageRole === PageRole.Forum) {
      var introPost = page.postsByNr[BodyNr];
      var hasIntro = introPost && introPost.sanitizedHtml && !introPost.isBodyHidden;
      if (!hasIntro) {
        addBackForumIntroButton =
            r.a({ className: 'icon-plus', onClick: () => {
              ReactActions.setPostHidden(BodyNr, false);
              debiki2.ReactActions.showForumIntro(true);
            }}, "Add forum intro text");
      }
    }

    const saveCancel = state.isSaving
      ? r.div({}, t.SavingDots)
      : r.div({ className: 'dw-save-btns-etc' },
          PrimaryButton({ onClick: this.save, className: 'e_Ttl_SaveB' }, t.Save),
          Button({ onClick: this.cancel }, t.Cancel));

    return (
      r.div({ className: 'dw-p-ttl-e' },
        Input({ type: 'text', ref: 'titleInput', className: 'dw-i-title', id: 'e2eTitleInput',
            defaultValue: titlePost.unsafeSource, onChange: this.onTitleChanged }),
        r.div({ className: 'form-horizontal' }, selectCategoryInput),
        r.div({ className: 'form-horizontal' }, selectTopicType),
        addBackForumIntroButton,
        // Only allow opening one of layout-and-settings and advanced-stuff at once.
        complicatedStuff ? null : layoutAndSettingsButton,
        layoutAndSettings ? null : advancedStuffButton,
          utils.FadeGrowIn({},
            layoutAndSettings,
            complicatedStuff),
        saveCancel));
  }
});


function topicListLayout_getName(pageLayout: TopicListLayout): string {
  switch (pageLayout) {
    case TopicListLayout.TitleExcerptSameLine: return "Title and excerpt on same line";
    case TopicListLayout.ExcerptBelowTitle: return "Excerpt below title";
    case TopicListLayout.ThumbnailsBelowTitle: return "Excerpt and preview images below title";
    case TopicListLayout.NewsFeed: return "News feed";
    case TopicListLayout.TitleOnly: // fall through
    default:
      return "Show topic title only";
  }
}


function addFolderSlashes(folder) {
  if (folder || folder === '') {
    if (folder[folder.length - 1] !== '/') folder = folder + '/';
    if (folder[0] !== '/') folder = '/' + folder;
  }
  return folder;
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
