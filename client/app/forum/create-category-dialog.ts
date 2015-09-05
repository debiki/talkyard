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

/// <reference path="../../typedefs/react/react.d.ts" />
/// <reference path="../plain-old-javascript.d.ts" />
/// <reference path="../ReactStore.ts" />
/// <reference path="../Server.ts" />

//------------------------------------------------------------------------------
   module debiki2.forum {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var Button = reactCreateFactory(ReactBootstrap.Button);
var ButtonGroup = reactCreateFactory(ReactBootstrap.ButtonGroup);
var Input = reactCreateFactory(ReactBootstrap.Input);
var ButtonInput = reactCreateFactory(ReactBootstrap.ButtonInput);
var Modal = reactCreateFactory(ReactBootstrap.Modal);
var ModalBody = reactCreateFactory(ReactBootstrap.ModalBody);
var ModalFooter = reactCreateFactory(ReactBootstrap.ModalFooter);
var ModalHeader = reactCreateFactory(ReactBootstrap.ModalHeader);
var ModalTitle = reactCreateFactory(ReactBootstrap.ModalTitle);

var DefaultPosition = 50;

var editCategoryDialog;

export function getEditCategoryDialog() {
  if (!editCategoryDialog) {
    function makeMountNode() {
      return $('<div>').appendTo('body')[0];
    }
    editCategoryDialog = React.render(EditCategoryDialog(), makeMountNode());
  }
  return editCategoryDialog;
}


var EditCategoryDialog = createClassAndFactory({
  getInitialState: function () {
    return { isOpen: false };
  },

  open: function(categoryId?: number) {
    this.setState({
      categoryId: categoryId,
      isOpen: true,
      isLoading: !!categoryId,
      isSaving: false,
      isCreating: !categoryId,
      isEditing: !!categoryId,
      customSlug: false,
      customPosition: false,
    });
    if (categoryId) {
      Server.loadCategory(categoryId, (category: Category) => {
        this.setState({
          isLoading: false,
          name: category.name,
          slug: category.slug,
          newTopicTypes: category.newTopicTypes,
          position: category.position,
        });
      });
    }
    else {
      this.setState({
        name: '',
        slug: '',
        newTopicTypes: [],
        position: DefaultPosition,
      });
    }
  },

  close: function() {
    this.setState({
      isOpen: false,
    });
  },

  onNameChanged: function(event) {
    var editedName = event.target.value;
    this.setState({ name: editedName });
    // If this is a new category, it's okay to change the slug. Otherwise, avoid changing it,
    // because it'd break external links to the category.
    if (this.state.isCreating) {
      var slugMatchingName = window['debikiSlugify'](editedName);
      this.setState({ slug: slugMatchingName });
    }
  },

  onSlugChanged: function(event) {
    this.setState({ slug: event.target.value });
  },

  onPositionChanged: function(event) {
    var newPosition = parseInt(event.target.value);
    this.setState({ position: isNaN(newPosition) ? '' : newPosition });
  },

  save: function() {
    this.setState({ isSaving: true });
    var category = {
      categoryId: this.state.categoryId,
      parentCategoryId: ReactStore.getCategoryId(),
      sectionPageId: debiki.internal.pageId,
      name: this.state.name,
      slug: this.state.slug,
      position: this.state.position || DefaultPosition,
      newTopicTypes: [],
    };
    ReactActions.saveCategory(category, this.close, () => {
      this.setState({ isSaving: false });
    });
  },

  render: function () {
    var nameInput =
        Input({ type: 'text', label: "Name:", ref: 'nameInput',
            value: this.state.name, onChange: this.onNameChanged });

    var slugInput = this.state.customSlug
        ? Input({ type: 'text', label: "Slug:",
            ref: 'slugInput', value: this.state.slug, onChange: this.onSlugChanged,
            help: "The slug is shown in the URL in the browser's address bar." })
        : r.a({ className: 'dw-click-to-show', onClick: () => this.setState({ customSlug: true }) },
            "Click to change how the category name looks in URLs");

    var positionnput = this.state.customPosition
        ? Input({ type: 'number', label: "Position:",
              value: this.state.position || '', onChange: this.onPositionChanged,
              help: "Categories with lower positions are listed first. Default: " +
                  DefaultPosition })
        : r.a({ className: 'dw-click-to-show',
              onClick: () => this.setState({ customPosition: true }) },
            "Click to set sort position");

    var body = this.state.isLoading
        ? r.div({}, "Loading...")
        : r.div({}, nameInput, slugInput, positionnput);

    var saveButtonTitle = this.state.isCreating ? "Create Category" : "Save Edits";
    var dialogTitle = this.state.isCreating ? saveButtonTitle : "Edit Category";

    var saveCancel = this.state.isSaving
        ? r.div({}, "Saving...")
        : r.div({},
            Button({ onClick: this.save }, saveButtonTitle),
            Button({ onClick: this.close }, "Cancel"));

    return (
      Modal({ show: this.state.isOpen, onHide: this.close,
          dialogClassName: 'dw-dlg-save-category' },
        ModalHeader({}, ModalTitle({}, dialogTitle)),
        ModalBody({}, body),
        ModalFooter({}, saveCancel)));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
