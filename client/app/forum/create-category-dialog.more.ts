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

/// <reference path="../slim-bundle.d.ts" />
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


const EditCategoryDialog = createClassAndFactory({
  displayName: 'EditCategoryDialog',

  getInitialState: function () {
    return {
      isOpen: false,
      store: ReactStore.allData(),
      defaultTopicType: PageRole.Discussion,
    };
  },

  open: function(categoryId?: number) {
    this.setState({
      categoryId: categoryId,
      isOpen: true,
      isLoading: !!categoryId,
      isSaving: false,
      isCreating: !categoryId,
      isEditing: !!categoryId,
    });
    if (categoryId) {
      Server.loadCategory(categoryId, (category: Category, permissions: PermsOnPage[],
          groups: Group[]) => {
        this.setState({
          isLoading: false,
          isCreatingNewCategory: false,
          originalSlug: category.slug,
          category: category,
          permissions: permissions,
          groups: groups,
          canChangeDefault: !category.isDefaultCategory || false,
        });
      });
    }
    else {
      const categoryId = -1; // then the server will give it a >= 1 id
      Server.loadGroups((groups: Group[]) => {
        const newCategory: Category = {
          id: categoryId,
          name: '',
          slug: '',
          defaultTopicType: PageRole.Discussion,
          isDefaultCategory: false,
          position: DefaultPosition,
          description: '',
          unlisted: false,
          includeInSummaries: IncludeInSummaries.Default,
        };
        this.setState({
          isCreatingNewCategory: true,
          canChangeDefault: true,
          category: newCategory,
          groups: groups,
          permissions: [
            defaultPermsOnPages(-11, Groups.EveryoneId, categoryId, false),
            defaultPermsOnPages(-12, Groups.StaffId, categoryId, true)],
        });
      });
    }
  },

  close: function() {
    this.setState({
      isOpen: false,
    });
  },

  save: function() {
    this.setState({ isSaving: true });
    const store: Store = this.state.store;
    const stateCat: Category = this.state.category;
    const category: Category = {
      ...stateCat,
      parentId: ReactStore.getCategoryId(), // CLEAN_UP remove that fn, use instead: store.currentPage.categoryId
      sectionPageId: store.currentPageId,
    };
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
    //const isChangingSlug = this.state.originalSlug !== category.slug;
    ReactActions.saveCategory(category, falseToUndef(this.state.permissions), this.close, () => {
      this.setState({ isSaving: false });
      // BUG if isChangingSlug, needs to update the URL slug, otherwise there'll be an error
      // when rendering the category topic list, with the old slug. [7AFDW01]
    });
  },

  deleteCategory: function() {
    ReactActions.deleteCategory(this.state.categoryId, () => {
      const deletedCategory = { ...this.state.category, isDeleted: true  };
      this.setState({ category: deletedCategory });
      util.openDefaultStupidDialog({
        body: "Category deleted. You can undo, by clicking Undelete.",
        small: true,
      });
    }, () => {});
  },

  undeleteCategory: function() {
    ReactActions.undeleteCategory(this.state.categoryId, () => {
      const restoredCategory = { ...this.state.category, isDeleted: false };
      this.setState({ category: restoredCategory });
      util.openDefaultStupidDialog({
        body: "Done, category undeleted. It is back again.",
        small: true,
      });
    }, () => {});
  },

  updateCategory: function(updatedCategory) {
    this.setState({
      category: { ...this.state.category, ...updatedCategory }
    });
  },

  updatePermissions: function(newPermissions: PermsOnPage[]) {
    this.setState({ permissions: newPermissions });
  },

  render: function() {
    const body = this.state.isLoading
      ? r.div({}, "Loading...")
      : rb.Tabs({ defaultActiveKey: 1, id: 't_CD_Tabs' },
          rb.Tab({ eventKey: 1, title: "Settings", className: 's_CD_Tabs_Stn' },
            CategorySettings({ ...this.state, updateCategory: this.updateCategory,
                deleteCategory: this.deleteCategory, undeleteCategory: this.undeleteCategory })),
          rb.Tab({ eventKey: 2, title: "Security", className: 's_CD_Tabs_Sec' },
            CategorySecurity({ ...this.state, updatePermissions: this.updatePermissions })));

    const saveButtonTitle = this.state.isCreating ? "Create Category" : "Save Edits";
    const dialogTitle = this.state.isCreating ? saveButtonTitle : "Edit Category";

    const saveCancel = this.state.isSaving
      ? r.div({}, "Saving...")
      : r.div({},
        PrimaryButton({ onClick: this.save, id: 'e2eSaveCatB' }, saveButtonTitle),
        Button({ onClick: this.close, id: 'e2eCancelCatB' }, "Cancel"));

    return (
      Modal({ show: this.state.isOpen, onHide: this.close, dialogClassName: 'esCatDlg s_CD' },
        ModalHeader({}, ModalTitle({}, dialogTitle)),
        ModalBody({}, body),
        ModalFooter({}, saveCancel)));
  }
});



const CategorySettings = createClassAndFactory({
  displayName: 'CategorySettings',

  onNameChanged: function(event) {
    const editedName = event.target.value;
    const editedFields: any = { name: editedName };
    // If this is a new category, it's okay to change the slug. Otherwise, avoid changing it,
    // because it'd break external links to the category.
    if (this.props.isCreating) {
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

  toggleUnlisted: function() {
    const category: Category = this.props.category;
    this.props.updateCategory({ unlisted: !category.unlisted });
  },

  toggleExclFromSummaries: function() {
    const category: Category = this.props.category;
    const newInclInSummaries = category.includeInSummaries === IncludeInSummaries.NoExclude ?
        IncludeInSummaries.Default : IncludeInSummaries.NoExclude;
    this.props.updateCategory({ includeInSummaries: newInclInSummaries });
  },

  render: function () {
    const store: Store = this.props.store;
    const page: Page = store.currentPage;
    const category: Category = this.props.category;
    if (!category)
      return null;

    const nameInput =
        Input({ type: 'text', label: "Name", ref: 'nameInput', id: 'e2eCatNameI',
            value: category.name, onChange: this.onNameChanged,
            help: "Keep it short, only one word, if possible." });

    const editDescriptionLink = this.props.isCreatingNewCategory ? null :
      r.div({ className: 'form-group' },
        r.label({ className: 'control-label' }, "Description"),
        r.div({},
          r.a({ href: linkToRedirToAboutCategoryPage(category.id), target: '_blank' },
            "Edit description ", r.span({ className: 'icon-link-ext' }))),
        r.span({ className: 'help-block' },
          "Opens the category description page. Edit the first paragraph on that page."));

    const defaultTopicTypeInput =
      r.div({ className: 'form-group' },
        r.label({ className: 'control-label', style: { display: 'block' }}, "Default topic type"),
        PageRoleDropdown({ store: store, pageRole: category.defaultTopicType,
          complicated: store.settings.showExperimental, hideMore: true,
          onSelect: this.setDefaultTopicType,
          title: 'Topic type', className: 'esEdtr_titleEtc_pageRole', pullLeft: true }),
        r.span({ className: 'help-block' },
          "New topics in this category will be of this type, by default."));

    const isDefaultInput =
      Input({ type: 'checkbox', label: "Set as default category", id: 'e2eSetDefCat',
        checked: category.isDefaultCategory, onChange: this.onIsDefaultChanged,
        disabled: !this.props.canChangeDefault,
        help: "Places new topics in this category, if no other category selected." });

    const slugInput =
        utils.FadeInOnClick({ clickToShowText: "Click to change how the name looks in URLs",
            clickToShowId: 'e2eShowCatSlug' },
          Input({ type: 'text', label: "URL slug", id: 'e2eCatSlug',
              ref: 'slugInput', value: category.slug, onChange: this.onSlugChanged,
              help: r.div({ className: 'esCatDlg_slug_help' },
                "Included in the computer address (URL) to this category. The address " +
                "would be: ",
                r.samp({}, location.origin + page.pagePath.value + RoutePathLatest + '/',
                  r.span({ className: 'esCatDlg_slug_help_addr_slug' }, category.slug))) }));

    let sortPositionText = "Click to set sort position";
    if (category.position !== DefaultPosition) {
      sortPositionText += " (" + category.position + ")";
    }
    const positionInput =
        utils.FadeInOnClick({ clickToShowText: sortPositionText, clickToShowId: 'e2eShowCatPos' },
          Input({ type: 'number', label: "Position", id: 'e2eCatPos',
            value: category.position || '', onChange: this.onPositionChanged,
            help: "On the category list page, categories with lower values are listed first. " +
              "Default: " + DefaultPosition }));

    const unlistedTitle = "Unlisted (" + (category.unlisted ?  "yes)" : "no)");
    const unlistedInput =
        utils.FadeInOnClick({ clickToShowText: unlistedTitle, clickToShowId: 'e2eShowUnlistedCB' },
            Input({ type: 'checkbox', label: "Unlisted", id: 'e2eUnlistedCB',
              checked: category.unlisted, onChange: this.toggleUnlisted,
              help: "Hides this category and all topics herein, in the forum topic lists — " +
                  "only staff will see them. However, when accessed directly, the pages " +
                  "will be visible. This is useful for pages like a homepage or about-this-" +
                  "website page, which people shouldn't see in the forum topic list." }));

    const shallExclude = category.includeInSummaries === IncludeInSummaries.NoExclude;
    const excludeFromSummariesTitle =
        "Exclude from summary emails (" + (shallExclude ?  "yes, exclude)" : "no)");
    const excludeFromSummariesInput =
      utils.FadeInOnClick({ clickToShowText: excludeFromSummariesTitle, clickToShowId: 'e_ShowExclCB' },
        Input({ type: 'checkbox', label: "Exclude from summary emails", id: 'e_ExclCB',
          checked: shallExclude, onChange: this.toggleExclFromSummaries,
          help: "Prevents topics from this category from being included in activity summary " +
              "emails." }));

    let anyUndeleteInfoAndButton;
    let anyDeleteButton;
    if (this.props.isCreatingNewCategory) {
      // Then cannot delete it yet.
    }
    else if (category.isDeleted) {
      anyUndeleteInfoAndButton =
          r.div({ className: 's_CD_Dd' },
            r.p({ className: 'icon-trash' }, "This category has been deleted."),
            Button({ onClick: this.props.undeleteCategory, className: 's_CD_UndelB' }, "Undelete"));
    }
    else {
      anyDeleteButton =
        r.div({ className: 's_CD_Btns'},
          Button({ onClick: this.props.deleteCategory, className: 'icon-trash s_CD_DelB' },
            "Delete category"));
    }

    return r.div({},
            anyUndeleteInfoAndButton,
            nameInput,
            editDescriptionLink,
            defaultTopicTypeInput,
            isDefaultInput,
            slugInput,
            positionInput,
            unlistedInput,
            excludeFromSummariesInput,
            anyDeleteButton);
  }
});



function defaultPermsOnPages(newPermId: PermissionId, forWhoId: PeopleId,
        categoryId: CategoryId, isStaff: boolean): PermsOnPage {
  return {
    id: newPermId,
    forPeopleId: forWhoId,
    onCategoryId: categoryId,
    // Setting these to false is not currently supported. [2LG5F04W]
    // Sync these default perms with Scala code. [7KFWY025]
    mayEditPage: isStaff || undefined,
    mayEditComment: isStaff || undefined,
    mayEditWiki: isStaff || undefined,
    // If someone sees hen's own post, hen would probably get angry if hen couldn't edit it?
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



const CategorySecurity = createClassAndFactory({
  displayName: 'CategorySecurity',

  addPermission: function() {
    const category: Category = this.props.category;
    const permissions: PermsOnPage[] = this.props.permissions;
    let newPermId = -1;  // negative = server will choose a "real" id, > 0  [9P1U6E5]
    _.each(permissions, p => {
      if (p.id <= newPermId) {
        newPermId = p.id - 1;
      }
    });
    const newPerm = defaultPermsOnPages(newPermId, Groups.NoUserId, category.id, false);
    this.props.updatePermissions(permissions.concat(newPerm));
  },

  render: function() {
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

  const selectGroupDropdown = SelectGroupDropdown({ groups: allGroups, selectedGroup: forGroup,
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

  const peopleClass = forGroup ? 's_PoP-Grp-' + forGroup.id : '';

  return r.li({ className: 's_PoP ' + peopleClass, key: thisPerm.id },
    r.div({ className: 's_PoP_Expl' }, "These people: "),
    r.div({ className: 's_PoP_Un' }, selectGroupDropdown),
    deleteButton,
    r.br(),
    r.div({ className: 's_PoP_Expl s_PoP_Expl-What' }, "may do this: "),
    r.div({ className: 's_PoP_Ps' },
      Checkbox('s_PoP_Ps_P_EdPg', "Edit other people's topics",
          thisPerm.mayEditPage, (p: PermsOnPage, c: boolean) => {
        p.mayEditPage = c;
        if (c) p.mayEditOwn = true;
      }),
      Checkbox('s_PoP_Ps_P_EdCm', "Edit others' comments",
          thisPerm.mayEditComment, (p: PermsOnPage, c: boolean) => {
        p.mayEditComment = c;
        if (c) p.mayEditOwn = true;
      }),
      Checkbox('s_PoP_Ps_P_EdWk', "Edit wiki posts",
          thisPerm.mayEditWiki, (p: PermsOnPage, c: boolean) => {
        p.mayEditWiki = c;
        if (c) p.mayEditOwn = true;
      }),
      Checkbox('s_PoP_Ps_P_EdOwn', "Edit one's own stuff",
          thisPerm.mayEditOwn, (p: PermsOnPage, c: boolean) => {
        p.mayEditOwn = c;
        if (c === false) {  // but not if undefined
          p.mayEditPage = false;
          p.mayEditComment = false;
          p.mayEditWiki = false;
        }
      }),
      Checkbox('s_PoP_Ps_P_DlPg', "Delete others' topics",
          thisPerm.mayDeletePage, (p: PermsOnPage, c: boolean) => p.mayDeletePage = c),
      Checkbox('s_PoP_Ps_P_DlCm', "Delete others' comments",
          thisPerm.mayDeleteComment, (p: PermsOnPage, c: boolean) => p.mayDeleteComment = c),
      Checkbox('s_PoP_Ps_P_CrPg', "Create pages",
          thisPerm.mayCreatePage, (p: PermsOnPage, c: boolean) => p.mayCreatePage = c),
      Checkbox('s_PoP_Ps_P_Re', "Post comments",
          thisPerm.mayPostComment, (p: PermsOnPage, c: boolean) => p.mayPostComment = c),
      Checkbox('s_PoP_Ps_P_See', "See other people's topics",
          thisPerm.maySee, (p: PermsOnPage, c: boolean) => {
        p.maySee = c;
        if (c) p.maySeeOwn = true;
      }),
      Checkbox('s_PoP_Ps_P_SeeOwn', "See one's own topics",
          thisPerm.maySeeOwn, (p: PermsOnPage, c: boolean) => {
        p.maySeeOwn = c;
        if (c === false) { // but not if undefined
          p.maySee = false;
        }
      })));

  function Checkbox(className: string, label: string, checked: boolean,
          set: (p: PermsOnPage, b: boolean) => void ) {
    const onChange = function(event) {
      const allPerms2: PermsOnPage[] = allPerms.slice(); // clones
      const thisPerm2: PermsOnPage = { ...thisPerm };  // clones
      set(thisPerm2, event.target.checked);
      replaceById(allPerms2, thisPerm2);
      updatePermissions(allPerms2);
    };
    return Input({ className: className, type: 'checkbox', label: label, checked: checked,
        onChange: onChange });
  }
}


const SelectGroupDropdown = createClassAndFactory({
  displayName: 'SelectGroupDropdown',

  getInitialState: function() {
    return { open: false };
  },

  open: function() {
    this.setState({
      open: true,
      windowWidth: window.innerWidth,
      buttonRect: reactGetRefRect(this.refs.btn),
    });
  },

  close: function() {
    this.setState({ open: false });
  },

  onSelect: function(listItem) {
    this.props.onSelect(listItem.eventKey);
    this.close();
  },

  render: function() {
    const props = this.props;
    const state = this.state;
    const groups: Group[] = props.groups;
    const selectedGroup: Group = props.selectedGroup;

    // The 'selectedGroup' should be in 'groups'.
    // @ifdef DEBUG
    dieIf(selectedGroup && !_.find(groups, g => g.id === selectedGroup.id), 'EdE2WCPA40');
    // @endif

    const title = selectedGroup ? selectedGroup.fullName : "Select group ...";

    const dropdownButton =
      Button({ onClick: this.open, ref: 'btn' }, title + ' ', r.span({ className: 'caret' }));

    const listItems = groups.map((group: Group) => {
      return ExplainingListItem({ onSelect: this.onSelect,
        activeEventKey: selectedGroup ? selectedGroup.id : NoId, eventKey: group.id, key: group.id,
        title: group.fullName });
    });

    listItems.unshift(ExplainingListItem({ onSelect: this.onSelect,
        activeEventKey: selectedGroup ? selectedGroup.id : NoId, eventKey: NoId, key: NoId,
        title: "Select group ..." }));

    const dropdownModal =
      DropdownModal({ show: state.open, onHide: this.close, showCloseButton: true,
          atRect: this.state.buttonRect, windowWidth: this.state.windowWidth },
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
