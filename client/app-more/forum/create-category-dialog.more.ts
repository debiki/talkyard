/*
 * Copyright (C) 2015-2017 Kaj Magnus Lindberg
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
/// <reference path="../widgets.more.ts" />
/// <reference path="../react-bootstrap-old/Input.more.ts" />
/// <reference path="../util/stupid-dialog.more.ts" />
/// <reference path="../editor/PageRoleDropdown.more.ts" />


//------------------------------------------------------------------------------
   namespace debiki2.forum {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const Modal = rb.Modal;
const ModalBody = rb.ModalBody;
const ModalFooter = rb.ModalFooter;
const ModalHeader = rb.ModalHeader;
const ModalTitle = rb.ModalTitle;
const PageRoleDropdown = editor.PageRoleDropdown;
const SelectCategoryDropdown = editor.SelectCategoryDropdown;
const DropdownModal = utils.DropdownModal;
const ExplainingListItem = util.ExplainingListItem;

const DefaultPosition = 50; // also in Scala [7KBYW2]

let editCategoryDialog;

export function getEditCategoryDialog(success: (dialog) => void) {
  // Could just return the dialog instead of sending to a callback. Old code.
  if (editCategoryDialog) {
    success(editCategoryDialog);
  }
  else {
    editCategoryDialog = ReactDOM.render(EditCategoryDialog(), debiki2.utils.makeMountNode());
    success(editCategoryDialog);
  }
}


interface EditCatDiagState {
  store?: Store;
  isOpen: Bo;
  isLoading?: Bo;
  isCreatingCat?: Bo,
  isSaving?: Bo;
  onSaved?;
  defaultTopicType: PageRole;
  doItVotesPopFirst: Bo;
  categoryId?: CategoryId;
  originalSlug?: St;                // CLEAN_UP remove, ...
  category?: CategoryPatch;
  catBefEdits?: CategoryPatch;      // <— use this instead
  permissions?: PermsOnPage[];
  groups?;
  canChangeDefault?: Bo;
}


const EditCategoryDialog = createClassAndFactory({
  displayName: 'EditCategoryDialog',

  getInitialState: function () {
    return {
      isOpen: false,
      defaultTopicType: PageRole.Discussion,
    } as EditCatDiagState;
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  open: function(categoryId: number, onSaved: (r: SaveCategoryResponse) => void) {
    const store: Store = ReactStore.allData();
    this.setState({
      store,
      categoryId: categoryId,
      isOpen: true,
      isLoading: !!categoryId,
      isSaving: false,
      isCreatingCat: !categoryId,
      onSaved,
    } as EditCatDiagState);

    // @ifdef DEBUG
    // The current page is the forum contents index page — and its parent
    // category is the forum root category, although we're currently viewing
    // topics from one specific category (namely the one we're about to edit).
    dieIf(store.currentPage.ancestorsRootFirst[0].categoryId
            !== store.currentPage.categoryId, 'TyE502MSKJL57');
    // @endif

    if (categoryId) {
      Server.loadCategory(categoryId, (response: LoadCategoryResponse) => {
        if (this.isGone) return;
        const category: CategoryPatch = response.category;
        // @ifdef DEBUG
        dieIf(category.id !== categoryId, 'TyE502KJDT02');
        dieIf(category.sectionPageId !== store.currentPageId, 'TyE502KJDT01');
        dieIf(!(
            // If is base cat, compare parentId with the root category id.
            category.parentId === store.currentPage.categoryId ||
            // If is sub cat, compare parentId with the base category ids.
            _.find(store.currentCategories, c => category.parentId === c.id)), 'TyE206WKD50');
        // @endif

        this.setState({
          isLoading: false,
          isCreatingCat: false,
          originalSlug: category.slug,   // CLEAN_UP remove
          catBefEdits: { ...category },
          category,
          permissions: response.permissions,
          groups: response.groups,
          canChangeDefault: !category.isDefaultCategory || false,
        } as EditCatDiagState);
      });
    }
    else {
      const catIdMin1 = -1; // then the server will give it a >= 1 id  [4GKWSR1]
      Server.loadGroups((groups: Group[]) => {
        if (this.isGone) return;
        const newCategory: CategoryPatch = {
          id: catIdMin1,
          extId: '',
          parentId: store.currentPage.categoryId,
          sectionPageId: store.currentPageId,
          name: '',
          slug: '',
          defaultTopicType: PageRole.Discussion,
          doItVotesPopFirst: false,
          isDefaultCategory: false,
          position: DefaultPosition,
          description: '',
          unlistCategory: false,
          unlistTopics: false,
          includeInSummaries: IncludeInSummaries.Default,
        };
        this.setState({
          isCreatingCat: true,
          canChangeDefault: true,
          category: newCategory,
          groups: groups,
          // Sync these default perms with Scala code. [7KFWY025]
          permissions: [
            defaultNewCatPerms(-11, Groups.EveryoneId, catIdMin1, false),
            // Full members can edit wikis, by default. Apart from that, it is safer if
            // un-ticking an Everyone group permission, removes it from Full Members
            // too, and only Staff have permissions explicitly granted to themselves.
            // [_no_extra_def_perms] [DEFMAYEDWIKI]
            { ...noPermsOnPages(-12, Groups.FullMembersId, catIdMin1), mayEditWiki: true },
            // But staff have all permissions explicitly granted to it.  TyTSTAFDEFPERMS
            defaultNewCatPerms(-13, Groups.StaffId, catIdMin1, true)],
        } as EditCatDiagState);
      });
    }
  },

  close: function() {
    this.setState({
      category: undefined,
      catBefEdits: undefined,
      isOpen: false,
      isSaving: false,
      isLoading: false,
      isCreatingCat: false,
      store: null,
      onSaved: null,
    } as EditCatDiagState);
  },

  save: function() {
    this.setState({ isSaving: true });
    const stateCat: Category = this.state.category;

    function falseToUndef(permissions: PermsOnPage[]) {
      const ps = _.clone(permissions);
      _.each(ps, (p: PermsOnPage) => {
        // Currently only True and Undef supported, but False = not impl. [2LG5F04W]
        if (p.mayEditPage === false) delete p.mayEditPage;
        if (p.mayEditComment === false) delete p.mayEditComment;
        if (p.mayEditWiki === false) delete p.mayEditWiki;
        if (p.mayEditOwn === false) delete p.mayEditOwn;
        if (p.mayDeletePage === false) delete p.mayDeletePage;
        if (p.mayDeleteComment === false) delete p.mayDeleteComment;
        if (p.mayCreatePage === false) delete p.mayCreatePage;
        if (p.mayPostComment === false) delete p.mayPostComment;
        if (p.maySee === false) delete p.maySee;
        if (p.maySeeOwn === false) delete p.maySeeOwn;
      });
      return ps;
    }

    // REFACTOR use /-/v0/upsert-simple instead?

    //const isChangingSlug = this.state.originalSlug !== category.slug;
    ReactActions.saveCategory(stateCat, falseToUndef(this.state.permissions),
          (response: SaveCategoryResponse) => {
      const state: EditCatDiagState = this.state;
      if (state.onSaved) {
        state.onSaved(response);
      }
      if (this.isGone) return;
      this.close();
    }, () => {
      // If error.
      this.setState({ isSaving: false } as EditCatDiagState);
    });
  },

  deleteCategory: function() {
    const state: EditCatDiagState = this.state;
    const category: Category = state.category;
    dieIf(category.isDefaultCategory,
          "This is the default category, cannot delete it [TyEDELDFCAT]");
    ReactActions.deleteCategory(state.categoryId, () => {
      if (this.isGone) return;
      const deletedCategory = { ...state.category, isDeleted: true  };
      this.setState({ category: deletedCategory });
      util.openDefaultStupidDialog({
        body: "Category deleted. You can undo, by clicking Undelete.",
        small: true,
      });
    }, () => {});
  },

  undeleteCategory: function() {
    const state: EditCatDiagState = this.state;
    ReactActions.undeleteCategory(state.categoryId, () => {
      if (this.isGone) return;
      const state: EditCatDiagState = this.state;
      const restoredCategory = { ...state.category, isDeleted: false };
      this.setState({ category: restoredCategory });
      util.openDefaultStupidDialog({
        body: "Done, category undeleted. It is back again.",
        small: true,
      });
    }, () => {});
  },

  updateCategory: function(updatedCategory) {
    const state: EditCatDiagState = this.state;
    this.setState({
      category: { ...state.category, ...updatedCategory }
    });
  },

  updatePermissions: function(newPermissions: PermsOnPage[]) {
    this.setState({ permissions: newPermissions });
  },

  render: function() {
    const state: EditCatDiagState = this.state;
    const body = !state.isOpen ? null : (state.isLoading
      ? r.div({}, "Loading...")
      : rb.Tabs({ defaultActiveKey: 1, id: 't_CD_Tabs' },
          rb.Tab({ eventKey: 1, title: "Settings", className: 's_CD_Tabs_Stn' },
            CatSettings({ ...state, updateCategory: this.updateCategory,
                deleteCategory: this.deleteCategory, undeleteCategory: this.undeleteCategory })),
          rb.Tab({ eventKey: 2, title: "Security", className: 's_CD_Tabs_Sec' },
            CatSecurity({ ...state, updatePermissions: this.updatePermissions }))));

    const saveButtonTitle = state.isCreatingCat ? "Create Category" : "Save Edits";
    const dialogTitle = state.isCreatingCat ? saveButtonTitle :
            rFr({}, "Edit Category: ", r.i({}, state.catBefEdits?.name));

    const perms: PermsOnPage[] = state.permissions || [];
    const uninitedPerm = _.find(perms, (p: PermsOnPage) =>  {
      return p.forPeopleId < Groups.EveryoneId;
    });

    const canSave = !uninitedPerm;

    const saveCancel = !state.isOpen ? null : (state.isSaving
      ? r.div({}, "Saving...")
      : r.div({},
        PrimaryButton({ onClick: this.save, id: 'e2eSaveCatB', disabled: !canSave },
          saveButtonTitle),
        Button({ onClick: this.close, className: 'e_CancelCatB' }, "Cancel")));

    return (
      Modal({ show: state.isOpen, onHide: this.close,
          dialogClassName: 'esCatDlg s_CD' },
        ModalHeader({}, ModalTitle({}, dialogTitle)),
        ModalBody({}, body),
        ModalFooter({}, saveCancel)));
  }
});



const CatSettings = createClassAndFactory({
  displayName: 'CatSettings',

  onNameChanged: function(event) {
    const editedName = event.target.value;
    const editedFields: any = { name: editedName };
    // If this is a new category, it's okay to change the slug. Otherwise, avoid changing it,
    // because it'd break external links to the category.
    if (this.props.isCreatingCat) {
      editedFields.slug = window['debikiSlugify'](editedName);
    }
    this.props.updateCategory(editedFields);
  },

  onSlugChanged: function(event) {
    this.props.updateCategory({ slug: event.target.value.toLowerCase() });
  },

  setDefaultTopicType: function(topicType: PageRole) {
    this.props.updateCategory({ defaultTopicType: topicType });
  },

  onIsDefaultChanged: function(event) {
    this.props.updateCategory({ isDefaultCategory: event.target.checked });
  },

  onPositionChanged: function(event) {
    const newPosition = parseInt(event.target.value);
    this.props.updateCategory({ position: isNaN(newPosition) ? '' : newPosition });
  },

  toggleExclFromSummaries: function() {
    const category: Category = this.props.category;
    const newInclInSummaries = category.includeInSummaries === IncludeInSummaries.NoExclude ?
        IncludeInSummaries.Default : IncludeInSummaries.NoExclude;
    this.props.updateCategory({ includeInSummaries: newInclInSummaries });
  },

  onExtIdChanged: function(event) {
    this.props.updateCategory({ extId: event.target.value.trim() });
  },

  render: function () {
    const store: Store = this.props.store;
    const settings: SettingsVisibleClientSide = store.settings;
    const sectPage: Page = store.currentPage;
    const category: CategoryPatch = this.props.category;
    if (!category)
      return null;

    const nameInput =
        Input({ type: 'text', label: "Name", ref: 'nameInput', id: 'e2eCatNameI',
            value: category.name, onChange: this.onNameChanged,
            help: "Keep it short, only one word, if possible." });

    const editDescriptionLink = this.props.isCreatingCat ? null :
      r.div({ className: 'form-group' },
        r.label({ className: 'control-label' }, "Description"),
        r.div({},
          r.a({ href: linkToRedirToAboutCategoryPage(category.id), target: '_blank' },
            "Edit description ", r.span({ className: 'icon-link-ext' }))),
        r.span({ className: 'help-block' },
          "Opens the category description page. On that page, click Edit."));

    const defaultTopicTypeInput =
      r.div({ className: 'form-group' },
        r.label({ className: 'control-label', style: { display: 'block' }},
          "Default topic type"),
        PageRoleDropdown({ store, pageRole: category.defaultTopicType,
          complicated: store.settings.showExperimental, hideStaffOnly: true,
          onSelect: this.setDefaultTopicType,
          title: 'Topic type', className: 'esEdtr_titleEtc_pageRole', pullLeft: true }),
        r.span({ className: 'help-block' },
          "New topics in this category will be of this type, by default."));

    const pageTypePlurName = editor.forumTopicType_toEnPlSt(category.defaultTopicType);
    // The label is like "Upvote ideas" or "Upvote questions", depending on the page type.
    const doItVotes =
      Input({ type: 'checkbox', className: 'e_DoVote',
        label: `Upvote ${pageTypePlurName}`,
        checked: category.doItVotesPopFirst, onChange: (event: CheckboxEvent) => {
          this.props.updateCategory({ doItVotesPopFirst: event.target.checked });
        },
        help: `Let members upvote ${pageTypePlurName}, by clicking Like ` +
              `(the heart icon). ` +
              `Sorts the ${pageTypePlurName} by popular (more votes) first, and ` +
              `shows number of votes.` });

    const rootCatId = sectPage.categoryId;

    const commentOrder =
      r.div({ className: 'form-group' },
        r.label({ className: 'control-label', style: { display: 'block' }},
          "Comment sort order:"),
        widgets.DiscLayoutDropdownBtn({ cat: category, store,
            layoutFor: LayoutFor.PageNoTweaks, forEveryone: true,
            onSelect: (newLayout: DiscPropsSource) => {
              this.props.updateCategory(newLayout);
            }}));

    /* Later:
    const pseudonymsAllowed =
      r.div({ className: 'form-group' },
        r.label({ className: 'control-label', style: { display: 'block' }},
          "Pseudonyms: (pen names)"),
        debiki2.pagedialogs.PseudonymsAllowedDrpBtn({ cat: category, store,
            layoutFor: LayoutFor.PageNoTweaks,
            onSelect: (newProps: DiscPropsSource) => {
              this.props.updateCategory(newProps);
            }})); */

    const anonymsAllowed =
      r.div({ className: 'form-group' },
        r.label({ className: 'control-label', style: { display: 'block' }},
          "Anonymous comments:"),
        debiki2.pagedialogs.AnonsAllowedDropdownBtn({ cat: category, store,
            layoutFor: LayoutFor.PageNoTweaks,
            onSelect: (newProps: DiscPropsSource) => {
              this.props.updateCategory(newProps);
            }}));

    const anonsConfigd =
            category.comtsStartAnon && category.comtsStartAnon >= NeverAlways.Allowed;

    const anonPurpose = !anonsConfigd ? null :
      r.div({ className: 'form-group' },
        r.label({ className: 'control-label', style: { display: 'block' }},
          "Purpose:"),
        debiki2.widgets.AnonPurposeBtn({ cat: category, store,
            layoutFor: LayoutFor.PageNoTweaks,
            onSelect: (newProps: DiscPropsSource) => {
              this.props.updateCategory(newProps);
            }}));

    const parentCatDropdown =
        r.div({ className: 'form-group' },
          r.label({ className: 'control-label', style: { display: 'block' }},
            "Parent category"),
          SelectCategoryDropdown({ className: 'esEdtr_titleEtc_category', store,
              categories: store.currentCategories,
              selectedCategoryId: category.parentId,
              // Root cats aren't incl in the json, so if this is a base cat, then,
              // its parent cat, i.e. a root cat, is absent.  [incl_root_cat]
              catAbsentMeansNone: true,
              onlyBaseCats: true,
              onCategorySelected: (newParentCatId: CategoryId) =>
                this.props.updateCategory({ parentId: newParentCatId })
              }),
          // Is there a better text and symbol, than a "Clear" button?
          category.parentId === rootCatId ? null : Button({
              className: 's_CD_0SubCat', onClick: () => {
            this.props.updateCategory({ parentId: rootCatId });
          }}, "Clear"),  // [TyTE2ECLRSUBCAT]
          r.span({ className: 'help-block' },
            "If you want this category to be a sub category."));

    const isDefaultInput =
      Input({ type: 'checkbox', label: "Set as default category", id: 'e2eSetDefCat',
        checked: category.isDefaultCategory, onChange: this.onIsDefaultChanged,
        disabled: !this.props.canChangeDefault,
        help: "Places new topics in this category, if no other category selected." });

    const slugInput =
        utils.FadeInOnClick({ clickToShowText:
              rFragment({}, "Click to change how the name looks in URLs: ",
                r.samp({ style: { marginLeft: '1ex' }}, category.slug)),
            clickToShowId: 'e2eShowCatSlug' },
          Input({ type: 'text', label: "URL slug", id: 'e2eCatSlug',
              ref: 'slugInput', value: category.slug, onChange: this.onSlugChanged,
              help: r.div({ className: 'esCatDlg_slug_help' },
                "Included in the computer address (URL) to this category. The address " +
                "would be: ",
                r.samp({}, location.origin + sectPage.pagePath.value + RoutePathLatest + '/',
                  r.span({ className: 'esCatDlg_slug_help_addr_slug' }, category.slug))) }));

    let sortPositionText = "Click to set category sort position";
    if (category.position !== DefaultPosition) {
      sortPositionText += ": " + category.position;
    }
    const positionInput =
        utils.FadeInOnClick({ clickToShowText: sortPositionText, clickToShowId: 'e2eShowCatPos' },
          Input({ type: 'number', label: "Position", id: 'e2eCatPos',
            value: category.position || '', onChange: this.onPositionChanged,
            help: "On the category list page, categories with lower values are listed first. " +
              "Default: " + DefaultPosition }));

    const unlistTopicsOnly = category.unlistTopics && !category.unlistCategory;
    const unlistCategory = category.unlistCategory;

    const setUnlisted = (n) => {
      this.props.updateCategory({ unlistTopics: n >= 1, unlistCategory: n === 2 });
    };

    const unlistTitle = unlistCategory
        ? r.span({ className: 'icon-2x-unlisted' }, "Unlist both category and topics: Yes")
        : (unlistTopicsOnly
            ? r.span({ className: 'icon-unlisted' }, "Unlist topics: Yes")
            : "Unlist topics: No");
    const unlistCategoryTopicsInput =
      utils.FadeInOnClick({ clickToShowText: unlistTitle, clickToShowId: 'e_ShowUnlRBs' },
        r.hr(),
        r.p({}, "Unlist topics or category?"),
        r.form({ style: { paddingLeft: 30 }},
          Input({ type: 'radio', className: 'e_DontUnlRB',
            label: "No, show them (default)",
            checked: !unlistTopicsOnly && !unlistCategory, onChange: () => setUnlisted(0) }),
          Input({ type: 'radio', className: 'e_UnlTpcsRB',
            label: rFragment({}, "Unlist topics ", r.span({ className: 'icon-unlisted'})),
            checked: unlistTopicsOnly, onChange: () => setUnlisted(1),
            help: "Won't show topics from this category, in the main topic list. " +
              "However, if viewing this category directly, the topics are listed." }),
          Input({ type: 'radio', className: 'e_UnlCatRB',
            label: rFragment({}, "Unlist category and topics ", r.span({ className: 'icon-2x-unlisted' })),
            checked: category.unlistCategory, onChange: () => setUnlisted(2),
            help: "Hides this category and all pages herein, in the forum topic lists — " +
              "only staff will see them. However, when accessed directly, the pages " +
              "will be visible. (This is useful for pages like a homepage or about-this-" +
              "website page, which people shouldn't see in the forum topic list.)" })),
        r.hr());

    const shallExclude = category.includeInSummaries === IncludeInSummaries.NoExclude;
    const excludeFromSummariesTitle =
        "Exclude from summary emails: " + (shallExclude ?  "Yes, exclude" : "No");
    const excludeFromSummariesInput =
      utils.FadeInOnClick({ clickToShowText: excludeFromSummariesTitle, clickToShowId: 'e_ShowExclCB' },
        Input({ type: 'checkbox', label: "Exclude from summary emails", id: 'e_ExclCB',
          checked: shallExclude, onChange: this.toggleExclFromSummaries,
          help: "Prevents topics from this category from being included in activity summary " +
              "emails." }));

    const extIdTitle =
        rFragment({},
          "External ID (optional): ", category.extId ? r.code({}, category.extId) : 'None');

    const extIdInput = settings.enableApi === false ? null :
      utils.FadeInOnClick({ clickToShowText: extIdTitle, clickToShowId: 'te_ShowExtId' },
        Input({ type: 'text', label: "External ID", ref: 'extId', id: 'te_CatExtId',
            value: category.extId, onChange: this.onExtIdChanged,
            help: "An external ID, for example if you need to upsert things via Talkyard's API."}));

    let anyUndeleteInfoAndButton;
    let anyDeleteButton;
    if (this.props.isCreatingCat) {
      // Then cannot delete it yet.
    }
    else if (category.isDeleted) {
      anyUndeleteInfoAndButton =
          r.div({ className: 's_CD_Dd' },
            r.p({ className: 'icon-trash' }, "This category has been deleted."),
            Button({ onClick: this.props.undeleteCategory, className: 's_CD_UndelB' }, "Undelete"));
    }
    else {
      const isDef = category.isDefaultCategory;
      anyDeleteButton =
        r.div({ className: 's_CD_Btns'},
          Button({ onClick: this.props.deleteCategory, className: 'icon-trash s_CD_DelB',
              disabled: isDef },
            "Delete category"),   // 0I18N
          isDef ? r.span({ className: 'e_0Del' }, " — cannot, is default") : null);
    }

    return r.div({},
            anyUndeleteInfoAndButton,
            nameInput,
            editDescriptionLink,
            defaultTopicTypeInput,
            doItVotes,
            commentOrder,
            // pseudonymsAllowed,
            r.div({ className: 'c_CD_Anons' }, anonymsAllowed, anonPurpose),
            parentCatDropdown,
            isDefaultInput,
            slugInput,
            positionInput,
            unlistCategoryTopicsInput,
            excludeFromSummariesInput,
            extIdInput,
            anyDeleteButton);
  }
});



function noPermsOnPages(newPermId: PermissionId, forWhoId: PeopleId,
        categoryId: CatId): PermsOnPage {
  return {
    id: newPermId,
    forPeopleId: forWhoId,
    onCategoryId: categoryId,
  };
}


function defaultNewCatPerms(newPermId: PermissionId, forWhoId: PeopleId,
        categoryId: CatId, isStaff: Bo): PermsOnPage {
  return {
    ...noPermsOnPages(newPermId, forWhoId, categoryId),
    // Setting these to false is not currently supported. [2LG5F04W]
    mayEditPage: isStaff || undefined,
    mayEditComment: isStaff || undefined,
    mayEditWiki: isStaff || forWhoId >= Groups.FullMembersId, // [DEFMAYEDWIKI]
    // If someone sees hans own post, han would probably get angry if han couldn't edit it?
    // And staff probably expects everyone to be allowed to edit their own posts, by default?
    // So, 'true' by default.
    mayEditOwn: true,
    mayDeletePage: isStaff || undefined,
    mayDeleteComment: isStaff || undefined,
    mayCreatePage: true,
    mayPostComment: true,
    maySee: true,
    maySeeOwn: true,
  };
}



const CatSecurity = createClassAndFactory({
  displayName: 'CatSecurity',

  addPermission: function() {
    const category: Category = this.props.category;
    const permissions: PermsOnPage[] = this.props.permissions;
    let newPermId = -1;  // negative = server will choose a "real" id, > 0  [9P1U6E5]
    _.each(permissions, p => {
      if (p.id <= newPermId) {
        newPermId = p.id - 1;
      }
    });
    // Start with zero additional permissions, so the group won't accidentally
    // get any unintended permission. [_no_extra_def_perms] TyTNEWPERMSEMPTY
    // (We don't know which group, yet. The admin will choose a grop from the
    // `SelectGroupDropdown()`.)
    const newPerm = noPermsOnPages(newPermId, Groups.NoUserId, category.id);
    this.props.updatePermissions(permissions.concat(newPerm));
  },

  render: function() {
    // If this is a base category, it could be nice if there was a way to get an
    // overview of all sub cat permissions.  [propagate_cat_perms]

    // Sorted by permission id server side [SORTCATPERMS].
    const permissions: PermsOnPage[] = this.props.permissions;
    if (!permissions)
      return null;

    const groups: Group[] = this.props.groups;
    const permissionItems = permissions.map((perm: PermsOnPage) => {
      const forGroup = _.find(groups, (g: Group) => g.id === perm.forPeopleId);
      return PermissionItemWithKey(
          permissions, perm, forGroup, groups, this.props.updatePermissions);
    });
    return r.div({},
      r.ul({ className: 's_CD_Sec_PoPs' }, permissionItems),
      Button({ className: 's_CD_Sec_AddB', onClick: this.addPermission }, "Add ..."));
  }
});



function PermissionItemWithKey(allPerms: PermsOnPage[], thisPerm: PermsOnPage, forGroup: Group,
      allGroups: Group[], updatePermissions) {

  const groupIdsInUse: PatId[] = allPerms.map(p => p.forPeopleId);

  const selectGroupDropdown = SelectGroupDropdown({ groups: allGroups,
      selectedGroup: forGroup, groupIdsInUse,
      onSelect: (peopleId: PeopleId) => {
        const allPerms2: PermsOnPage[] = allPerms.slice(); // clones
        const thisPerm2: PermsOnPage = { ...thisPerm, forPeopleId: peopleId };
        replaceById(allPerms2, thisPerm2);
        updatePermissions(allPerms2);
      }});

  const deleteButton = Button({ className: 's_PoP_Dl', onClick: () => {
        const allPerms2: PermsOnPage[] = allPerms.slice(); // clones
        deleteById(allPerms2, thisPerm.id);
        updatePermissions(allPerms2);
      }}, "Remove");

  const peopleClass = forGroup ? 's_PoP-Grp-' + forGroup.id : 's_PoP-Select-Grp';

  // Disable checkboxes that has no effect anyway, because of permissions inhereted
  // from other groups. — Right now, this works only for trust level groups,
  // and from the Everyone group.
  // (Moderators might not have all permissions everywhere? So <= Groups.MaxTrustLevelId
  // below, excluding moderators [mods_not_all_perms])
  let anyInhPerms: PermsOnPageNoIdOrPp | U;
  if (thisPerm.forPeopleId <= Groups.MaxTrustLevelId) {
    for (let perm of allPerms) {
      if (perm.forPeopleId < thisPerm.forPeopleId) {
        anyInhPerms = perms_join(perm, anyInhPerms);
      }
    }
  }

  const inhPerms: PermsOnPageNoIdOrPp = anyInhPerms ||  (
          thisPerm.forPeopleId === Groups.EveryoneId
              ? {}
              : _.find(allPerms, p => p.forPeopleId === Groups.EveryoneId) || {});

  return r.li({ className: 's_PoP ' + peopleClass, key: thisPerm.id },
    r.div({ className: 's_PoP_Expl' }, "These people: "),
    r.div({ className: 's_PoP_Un' }, selectGroupDropdown),
    deleteButton,
    r.br(),
    r.div({ className: 's_PoP_Expl s_PoP_Expl-What' }, "may do this: "),
    r.div({ className: 's_PoP_Ps' },
      Checkbox('s_PoP_Ps_P_EdPg', "Edit other people's topics", inhPerms.mayEditPage,
          thisPerm.mayEditPage, (p: PermsOnPage, c: boolean) => {
        p.mayEditPage = c;
        if (c) p.mayEditOwn = true;
      }),
      Checkbox('s_PoP_Ps_P_EdCm', "Edit others' replies", inhPerms.mayEditComment,
          thisPerm.mayEditComment, (p: PermsOnPage, c: boolean) => {
        p.mayEditComment = c;
        if (c) p.mayEditOwn = true;
      }),
      Checkbox('s_PoP_Ps_P_EdWk', "Edit wiki posts", inhPerms.mayEditWiki,
          thisPerm.mayEditWiki, (p: PermsOnPage, c: boolean) => {
        p.mayEditWiki = c;
        if (c) p.mayEditOwn = true;
      }),
      Checkbox('s_PoP_Ps_P_EdOwn', "Edit one's own stuff", inhPerms.mayEditOwn,
          thisPerm.mayEditOwn, (p: PermsOnPage, c: boolean) => {
        p.mayEditOwn = c;
        if (c === false) {  // but not if undefined  — what? why not (NOTUNDEF)
          p.mayEditPage = false;    // UX BUG doesnt' work, pretty harmless
          p.mayEditComment = false; //
          p.mayEditWiki = false;    //
        }
      }),
      Checkbox('s_PoP_Ps_P_DlPg', "Delete others' topics", inhPerms.mayDeletePage,
          thisPerm.mayDeletePage, (p: PermsOnPage, c: boolean) => p.mayDeletePage = c),
      Checkbox('s_PoP_Ps_P_DlCm', "Delete others' replies", inhPerms.mayDeleteComment,
          thisPerm.mayDeleteComment, (p: PermsOnPage, c: boolean) => p.mayDeleteComment = c),
      Checkbox('s_PoP_Ps_P_CrPg', "Create pages", inhPerms.mayCreatePage,
          thisPerm.mayCreatePage, (p: PermsOnPage, c: boolean) => p.mayCreatePage = c),
      Checkbox('s_PoP_Ps_P_Re', "Post replies", inhPerms.mayPostComment,
          thisPerm.mayPostComment, (p: PermsOnPage, c: boolean) => p.mayPostComment = c),
      Checkbox('s_PoP_Ps_P_See', "See other people's topics", inhPerms.maySee,
          thisPerm.maySee, (p: PermsOnPage, c: boolean) => {
        p.maySee = c;
        if (c) p.maySeeOwn = true;
      }),
      Checkbox('s_PoP_Ps_P_SeeOwn', "See one's own topics", inhPerms.maySeeOwn,
          thisPerm.maySeeOwn, (p: PermsOnPage, c: boolean) => {
        p.maySeeOwn = c;
        if (c === false) {   // but not if undefined  — what? why not (NOTUNDEF)
          p.maySee = false;  // UX BUG doesnt' work, pretty harmless
        }
      })));

  function Checkbox(className: string, label: string, inherited: boolean, checked: boolean,
          set: (p: PermsOnPage, b: boolean) => void) {
    const onChange = inherited ? undefined : function(event) {
      const allPerms2: PermsOnPage[] = allPerms.slice(); // clones
      const thisPerm2: PermsOnPage = { ...thisPerm };  // clones
      set(thisPerm2, event.target.checked);
      replaceById(allPerms2, thisPerm2);
      updatePermissions(allPerms2);
    };
    return Input({ className: className, type: 'checkbox', label: label,
        checked: checked || inherited, onChange: onChange, disabled: inherited });
  }
}


interface SelectGroupDropdownProps {
  groups: Group[];
  selectedGroup?: Group;
  groupIdsInUse: PatId[];
  onSelect;
}


interface SelectGroupDropdownState {
  open?: Bo;
  windowWidth?: Nr;
  buttonRect?: Rect;
}


const SelectGroupDropdown = createClassAndFactory({
  displayName: 'SelectGroupDropdown',

  getInitialState: function() {
    return {};
  },

  open: function() {
    const newState: SelectGroupDropdownState = {
      open: true,
      windowWidth: window.innerWidth,
      buttonRect: reactGetRefRect(this.refs.btn),
    };
    this.setState(newState);
  },

  close: function() {
    const newState: SelectGroupDropdownState = { open: false };
    this.setState(newState);
  },

  onSelect: function(listItem) {
    const props: SelectGroupDropdownProps = this.props;
    props.onSelect(listItem.eventKey);
    this.close();
  },

  render: function() {
    const props: SelectGroupDropdownProps = this.props;
    const state: SelectGroupDropdownState = this.state;
    const groupsUnsorted: Group[] = props.groups;
    const selectedGroup: Group | U = props.selectedGroup;
    const selectedGroupId: PatId = selectedGroup ? selectedGroup.id : NoId;

    // The 'selectedGroup' should be in 'groups'.
    // @ifdef DEBUG
    dieIf(selectedGroup && !_.find(groupsUnsorted, g => g.id === selectedGroup.id), 'EdE2WCPA40');
    // @endif

    function nameOf(group) {
      return group.fullName || '@' + group.username;
    }

    const title = selectedGroup ? nameOf(selectedGroup) : "Select group ...";

    // Make the Select Group button stand out, until one has selected a group
    // — so one notices one is to select a group.
    const whichButton = selectedGroup ? Button : PrimaryButton;

    const dropdownButton =
      whichButton({ onClick: this.open, ref: 'btn', className: 'e_SelGrpB' },
          title + ' ', r.span({ className: 'caret' }));

    // Sort by id, so will always appear in the same order, and also, so built-in groups
    // like "Everyone" appear first (it's typically interesting to know what permissions
    // Everyone has).
    const groupsSorted = _.sortBy(groupsUnsorted, g => g.id);

    const listItems = groupsSorted.map((group: Group) => {
      const canSelect = group.id === selectedGroupId ||
              props.groupIdsInUse.indexOf(group.id) === -1;
      return ExplainingListItem({ onSelect: this.onSelect,
        activeEventKey: selectedGroupId, eventKey: group.id, key: group.id,
        title: nameOf(group), disabled: !canSelect });
    });

    listItems.unshift(ExplainingListItem({ onSelect: this.onSelect,
        activeEventKey: selectedGroupId, eventKey: NoId, key: NoId,
        title: "Select group ..." }));

    const dropdownModal =
      DropdownModal({ show: state.open, onHide: this.close, showCloseButton: true,
          atRect: state.buttonRect, windowWidth: state.windowWidth },
        r.ul({},
          listItems));

    return (
      r.div({ style: { display: 'inline-block' } },
        dropdownButton,
        dropdownModal));
  }
});



//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
