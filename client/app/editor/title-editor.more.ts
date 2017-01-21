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

/// <reference path="../../typedefs/react/react.d.ts" />
/// <reference path="../../typedefs/modernizr/modernizr.d.ts" />
/// <reference path="../slim-bundle.d.ts" />
/// <reference path="../react-bootstrap-old/Input.more.ts" />

//------------------------------------------------------------------------------
   module debiki2.titleeditor {
//------------------------------------------------------------------------------

var r = React.DOM;
var SelectCategoryDropdown = editor.SelectCategoryDropdown;
var ModalDropdownButton = utils.ModalDropdownButton;


export var TitleEditor = createComponent({
  displayName: 'TitleEditor',

  getInitialState: function() {
    return {
      showComplicated: false,
      isSaving: false,
      pageRole: this.props.pageRole,
      categoryId: this.props.categoryId,
    };
  },

  componentDidMount: function() {
    Server.loadEditorAndMoreBundles(() => {
      if (!this.isMounted()) return;
      this.setState({ editorScriptsLoaded: true });
    });
  },

  showLayoutAndSettings: function() {
    this.setState({ showLayoutAndSettings: true });
  },

  showComplicated: function() {
    var store: Store = this.props;
    var pagePath: PagePath = store.pagePath;
    this.setState({
      showComplicated: true,
      folder: pagePath.folder,
      slug: pagePath.slug,
      showId: pagePath.showId,
      htmlTagCssClasses: store.pageHtmlTagCssClasses || '',
      htmlHeadTitle: store.pageHtmlHeadTitle,
      htmlHeadDescription: store.pageHtmlHeadDescription,
    });
  },

  onTitleChanged: function(event) {
    var store: Store = this.props;
    var idWillBeInUrlPath = this.refs.showIdInput ?
        this.refs.showIdInput.getChecked() : store.pagePath.showId; // isIdShownInUrl();
    if (!idWillBeInUrlPath) {
      // Then don't automatically change the slug to match the title, because links are more fragile
      // when no id included in the url, and might break if we change the slug. Also, the slug is likely
      // to be something like 'about' (for http://server/about) which we want to keep unchanged.
      return;
    }
    var editedTitle = event.target.value;
    var slugMatchingTitle = window['debikiSlugify'](editedTitle);
    this.setState({ slug: slugMatchingTitle });
  },

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
    ReactActions.editTitleAndSettings(newTitle, pageSettings, this.props.closeEditor, () => {
      this.setState({ isSaving: false });
    });
  },

  getSettings: function() {
    var settings: any = {
      categoryId: this.state.categoryId,
      pageRole: this.state.pageRole,
      pageLayout: this.state.pageLayout,
      folder: addFolderSlashes(this.state.folder),
      slug: this.state.slug,
      showId: this.state.showId,
      htmlTagCssClasses: this.state.htmlTagCssClasses,
      htmlHeadTitle: this.state.htmlHeadTitle,
      htmlHeadDescription: this.state.htmlHeadDescription,
    };
    if (this.refs.layoutInput) {
      settings.layout = this.refs.layoutInput.getValue();
    }
    return settings;
  },

  render: function() {
    let store: Store = this.props;
    let me: Myself = store.me;
    let settings: SettingsVisibleClientSide = store.settings;
    let pageRole: PageRole = this.props.pageRole;
    let titlePost: Post = this.props.postsByNr[TitleNr];
    let titleText = titlePost.sanitizedHtml; // for now. TODO only allow plain text?
    let user = this.props.user;
    let isForumOrAboutOrMessage =
      pageRole === PageRole.Forum || pageRole === PageRole.About || pageRole === PageRole.FormalMessage;

    if (!this.state.editorScriptsLoaded) {
      // The title is not shown, so show some whitespace to avoid the page jumping upwards.
      return r.div({ style: { height: 80 }});
    }

    let layoutAndSettings;
    if (this.state.showLayoutAndSettings) {
      let title = r.span({},
          topicListLayout_getName(this.state.pageLayout) + ' ',
          r.span({ className: 'caret' }));
      let mkSetter = (layout) => (() => this.setState({ pageLayout: layout }));
      layoutAndSettings =
        r.div({},
          r.div({ className: 'form-horizontal', key: 'layout-settings-key' },
            Input({ type: 'custom', label: "Topic list layout",
                labelClassName: 'col-xs-2', wrapperClassName: 'col-xs-10' },
              ModalDropdownButton({ title: title },
                r.ul({ className: 'dropdown-menu' },
                  MenuItem({ onClick: mkSetter(TopicListLayout.TitleOnly) },
                    topicListLayout_getName(TopicListLayout.TitleOnly)),
                  MenuItem({ onClick: mkSetter(TopicListLayout.TitleExcerptSameLine) },
                    topicListLayout_getName(TopicListLayout.TitleExcerptSameLine)),
                  MenuItem({ onClick: mkSetter(TopicListLayout.ThumbnailsBelowTitle) },
                    topicListLayout_getName(TopicListLayout.ThumbnailsBelowTitle)))))));
      }

    var complicatedStuff;
    if (this.state.showComplicated) {
      var dashId = this.state.showId ? '-' + debiki.getPageId() : '';
      var slashSlug =  this.state.slug;
      if (dashId && slashSlug) slashSlug = '/' + slashSlug;
      var url = location.protocol + '//' + location.host +
          addFolderSlashes(this.state.folder) + dashId + slashSlug;

      var anyMetaTitleAndDescription = pageRole !== PageRole.Forum ? null :
        r.div({ className: 'esTtlEdtr_metaTags' },
          Input({ label: "SEO title", type: 'text',
            labelClassName: 'col-xs-2', wrapperClassName: 'col-xs-10',
            value: this.state.htmlHeadTitle,
            onChange: (event) => this.setState({ htmlHeadTitle: event.target.value }),
            help: "Custom title for Search Engine Optimization (SEO). Will be inserted " +
              "into the <html><head><title> tag."}),
          Input({ label: "SERP description", type: 'textarea',
            labelClassName: 'col-xs-2', wrapperClassName: 'col-xs-10',
            value: this.state.htmlHeadDescription,
            onChange: (event) => this.setState({ htmlHeadDescription: event.target.value }),
            help: "Page description, for Search Engine Result Pages (SERP). Will be inserted " +
                "into the <html><head><meta name='description' content='...'> attribute." }));


      var anyUrlAndCssClassEditor = !store.settings.showExperimental ? null :
        r.div({ className: 'esTtlEdtr_urlSettings' },
          r.p({}, r.b({}, "Ignore this "), "— unless you understand URL addresses and CSS."),
          Input({ label: 'Page slug', type: 'text', ref: 'slugInput', className: 'dw-i-slug',
            labelClassName: 'col-xs-2', wrapperClassName: 'col-xs-10',
            value: this.state.slug, onChange: this.onSlugChanged,
            help: "The name of this page in the URL."}),
          Input({ label: 'Folder', type: 'text', ref: 'folderInput', className: 'dw-i-folder',
            labelClassName: 'col-xs-2', wrapperClassName: 'col-xs-10',
            value: this.state.folder, onChange: this.onFolderChanged,
            help: "Any /url/path/ to this page." }),
          Input({ label: 'Show page ID in URL', type: 'checkbox', ref: 'showIdInput',
            wrapperClassName: 'col-xs-offset-2 col-xs-10',
            className: 'dw-i-showid', checked: this.state.showId,
            onChange: this.onShowIdChanged }),
          r.p({}, "The page URL will be: ", r.kbd({}, url)),
          Input({ label: 'CSS class', type: 'text', className: 'theCssClassInput',
            labelClassName: 'col-xs-2', wrapperClassName: 'col-xs-10',
            value: this.state.htmlTagCssClasses,
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

    let layoutAndSettingsButton =
        this.state.showLayoutAndSettings || !user.isAdmin || pageRole !== PageRole.Forum
          ? null
          : r.a({ className: 'esTtlEdtr_openAdv icon-wrench', onClick: this.showLayoutAndSettings },
              "Layout and settings");

    let existsAdvStuffToEdit = pageRole === PageRole.Forum || store.settings.showExperimental;
    let advancedStuffButton = !existsAdvStuffToEdit ||
        this.state.showComplicated || !user.isAdmin || pageRole === PageRole.FormalMessage
          ? null
          : r.a({ className: 'esTtlEdtr_openAdv icon-settings', onClick: this.showComplicated },
              "Advanced");

    let selectCategoryInput;
    if (isForumOrAboutOrMessage) {
      // About-category pages cannot be moved to other categories.
    }
    else if (this.props.forumId && settings_showCategories(settings, me)) {
      selectCategoryInput =
        Input({ type: 'custom', label: "Category", labelClassName: 'col-xs-2',
            wrapperClassName: 'col-xs-10' },
          SelectCategoryDropdown({ store: this.props, pullLeft: true,
            selectedCategoryId: this.state.categoryId,
            onCategorySelected: this.onCategoryChanged }));
    }

    var selectTopicType =
        !page_mayChangeRole(pageRole) || !settings_selectTopicType(settings, me) ? null :
      Input({ type: 'custom', label: "Topic type", labelClassName: 'col-xs-2',
          wrapperClassName: 'col-xs-10' },
        editor.PageRoleDropdown({ store: store, pageRole: this.state.pageRole,
          onSelect: this.onPageRoleChanged, pullLeft: true,
          complicated: store.settings.showExperimental,
          title: 'Topic type', className: 'esEdtr_titleEtc_pageRole',
          help: "Makes the topic behave differently. For example, topics of type " +
          "Question can be marked as solved, and Idea topics can be New, " +
          "Planned or Implemented." }));

    var addBackForumIntroButton;
    if (this.props.pageRole === PageRole.Forum) {
      var introPost = this.props.postsByNr[BodyNr];
      var hasIntro = introPost && introPost.sanitizedHtml && !introPost.isBodyHidden;
      if (!hasIntro) {
        addBackForumIntroButton =
            r.a({ className: 'icon-plus', onClick: () => {
              ReactActions.setPostHidden(BodyNr, false);
              debiki2.ReactActions.showForumIntro(true);
            }}, "Add forum intro text");
      }
    }

    var saveCancel = this.state.isSaving
      ? r.div({}, 'Saving...')
      : r.div({ className: 'dw-save-btns-etc' },
          PrimaryButton({ onClick: this.save, className: 'e2eSaveBtn' }, "Save"),
          Button({ onClick: this.props.closeEditor, className: 'e2eCancelBtn' }, "Cancel"));

    return (
      r.div({ className: 'dw-p-ttl-e' },
        Input({ type: 'text', ref: 'titleInput', className: 'dw-i-title', id: 'e2eTitleInput',
            defaultValue: titleText, onChange: this.onTitleChanged }),
        r.div({ className: 'form-horizontal' }, selectCategoryInput),
        r.div({ className: 'form-horizontal' }, selectTopicType),
        addBackForumIntroButton,
        // Only allow opening one of layout-and-settings and advanced-stuff at once.
        complicatedStuff ? null : layoutAndSettingsButton,
        layoutAndSettings ? null : advancedStuffButton,
        ReactCSSTransitionGroup({ transitionName: 'compl-stuff',
            transitionAppear: true, transitionAppearTimeout: 600,
            transitionEnterTimeout: 600, transitionLeaveTimeout: 500 },
          layoutAndSettings,
          complicatedStuff),
        saveCancel));
  }
});


function topicListLayout_getName(pageLayout: TopicListLayout): string {
  switch (pageLayout) {
    case TopicListLayout.TitleExcerptSameLine: return "Title and excerpt on same line";
    case TopicListLayout.ThumbnailsBelowTitle: return "Thumbnails and excerpt below title";
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
