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

/// <reference path="../../typedefs/react/react.d.ts" />
/// <reference path="../slim-bundle.d.ts" />
/// <reference path="../widgets.more.ts" />
/// <reference path="../react-bootstrap-old/Input.more.ts" />
/// <reference path="../util/stupid-dialog.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.forum {
//------------------------------------------------------------------------------

const r = React.DOM;
const Modal = rb.Modal;
const ModalBody = rb.ModalBody;
const ModalFooter = rb.ModalFooter;
const ModalHeader = rb.ModalHeader;
const ModalTitle = rb.ModalTitle;
const PageRoleDropdown = editor.PageRoleDropdown;

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
      Server.loadCategory(categoryId, (category: Category) => {
        this.setState({
          isLoading: false,
          isCreatingNewCategory: false,
          originalSlug: category.slug,
          category: category,
          //name: category.name,
          //slug: category.slug,
          //defaultTopicType: category.defaultTopicType,
          canChangeDefault: !category.isDefaultCategory || false,
          //isDefault: category.isDefaultCategory || false,
          //position: category.position,
          //unlisted: category.unlisted,
          //staffOnly: category.staffOnly,
          //onlyStaffMayCreateTopics: category.onlyStaffMayCreateTopics,
          //isDeleted: category.isDeleted,
        });
      });
    }
    else {
      const newCategory: Category = {
        id: NoCategoryId,
        name: '',
        slug: '',
        defaultTopicType: PageRole.Discussion,
        isDefaultCategory: false,
        position: DefaultPosition,
        description: '',
        unlisted: false,
        staffOnly: false,
        onlyStaffMayCreateTopics: false,
      };
      this.setState({
        isCreatingNewCategory: true,
        canChangeDefault: true,
        category: newCategory,
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
    const category = {
      ...this.state.category,
      //categoryId: this.state.categoryId,
      parentCategoryId: ReactStore.getCategoryId(),
      sectionPageId: debiki.internal.pageId,
      //name: this.state.name,
      //slug: this.state.slug,
      //isDefault: this.state.isDefault,
      //position: this.state.position || DefaultPosition,
      //defaultTopicType: this.state.defaultTopicType,
      //unlisted: this.state.unlisted,
      //staffOnly: this.state.staffOnly,
      //onlyStaffMayCreateTopics: this.state.onlyStaffMayCreateTopics,
    };
    const isChangingSlug = this.state.originalSlug !== category.slug;
    ReactActions.saveCategory(category, this.close, () => {
      this.setState({ isSaving: false });
      // BUG needs to update the URL slug, otherwise there'll be an error when rendering the
      // category topic list, with the old slug. [7AFDW01]
    });
  },

  deleteCategory: function() {
    ReactActions.deleteCategory(this.state.categoryId, () => {
      this.setState({ isDeleted: true });
      util.openDefaultStupidDialog({
        body: "Category deleted. You can undo, by clicking Undelete.",
        small: true,
      });
    }, () => {});
  },

  undeleteCategory: function() {
    ReactActions.undeleteCategory(this.state.categoryId, () => {
      this.setState({ isDeleted: false });
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

  render: function() {
    const body = this.state.isLoading
      ? r.div({}, "Loading...")
      : r.div({},
        CategorySettings({ ...this.state, updateCategory: this.updateCategory,
            deleteCategory: this.deleteCategory, undeleteCategory: this.undeleteCategory }));

    const saveButtonTitle = this.state.isCreating ? "Create Category" : "Save Edits";
    const dialogTitle = this.state.isCreating ? saveButtonTitle : "Edit Category";

    const saveCancel = this.state.isSaving
      ? r.div({}, "Saving...")
      : r.div({},
        PrimaryButton({ onClick: this.save, id: 'e2eSaveCatB' }, saveButtonTitle),
        Button({ onClick: this.close, id: 'e2eCancelCatB' }, "Cancel"));

    return (
      Modal({ show: this.state.isOpen, onHide: this.close, dialogClassName: 'esCatDlg' },
        ModalHeader({}, ModalTitle({}, dialogTitle)),
        ModalBody({}, body),
        ModalFooter({}, saveCancel)));
  }
});



const CategorySettings = createClassAndFactory({
  onNameChanged: function(event) {
    const editedName = event.target.value;
    this.props.updateCategory({ name: editedName });
    // If this is a new category, it's okay to change the slug. Otherwise, avoid changing it,
    // because it'd break external links to the category.
    if (this.props.isCreating) {
      const slugMatchingName = window['debikiSlugify'](editedName);
      this.props.updateCategory({ slug: slugMatchingName });
    }
  },

  onSlugChanged: function(event) {
    this.props.updateCategory({ slug: event.target.value });
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

  render: function () {
    const store: Store = this.props.store;
    const category: Category = this.props.category;

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

    const topicTypes = [   // [i18n]
        { value: PageRole.Question, label: 'Question' },
        { value: PageRole.Problem, label: 'Problem' },
        { value: PageRole.Idea, label: 'Idea' },
        { value: PageRole.Discussion, label: 'Discussion' }];
    if (debiki.siteId === '85') {
      topicTypes.push({ value: PageRole.Critique, label: 'Critique' }); // [plugin]
    }

    const defaultTopicTypeInput =
      r.div({ className: 'form-group' },
        r.label({ className: 'control-label', style: { display: 'block' }}, "Default topic type"),
        PageRoleDropdown({ store: store, pageRole: category.defaultTopicType,
          complicated: false, hideMore: true, onSelect: this.setDefaultTopicType,
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
                r.samp({}, location.origin + store.pagePath.value + RoutePathLatest + '/',
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

    const staffOnlyTitle = "Staff only (" + (category.staffOnly ?  "yes)" : "no)");
    const staffOnlyInput =
      utils.FadeInOnClick({ clickToShowText: staffOnlyTitle, clickToShowId: 'e2eShowStaffOnlyCB' },
        Input({ type: 'checkbox', label: "Staff only", id: 'e2eStaffOnlyCB',
          checked: category.staffOnly, onChange: this.toggleStaffOnly,
          help: "Shall topics in this category be accessible only to admins and moderators?" }));

    const onlyStaffMayCreateTopicsTitle = "Only staff may create topics (" +
          (category.onlyStaffMayCreateTopics ?  "yes)" : "no)");
    const onlyStaffMayCreateTopicsInput =
      utils.FadeInOnClick({ clickToShowText: onlyStaffMayCreateTopicsTitle,
          clickToShowId: 'e2eShowOnlyStaffCreateCB' },
        Input({ type: 'checkbox', label: "Only staff may create topics", id: 'e2eOnlyStaffCreateCB',
          checked: category.onlyStaffMayCreateTopics, onChange: this.toggleOnlyStaffMayCreateTopics,
          help: "May only admins and moderators create topics in this category?" }));

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
            staffOnlyInput,
            onlyStaffMayCreateTopicsInput,
            anyDeleteButton);
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
