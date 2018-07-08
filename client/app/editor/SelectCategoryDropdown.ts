/*
 * Copyright (c) 2016 Kaj Magnus Lindberg
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

/// <reference path="../prelude.ts" />
/// <reference path="../utils/utils.ts" />
/// <reference path="../utils/react-utils.ts" />
/// <reference path="../utils/DropdownModal.ts" />
/// <reference path="../util/ExplainingDropdown.ts" />
/// <reference path="../rules.ts" />
/// <reference path="../Server.ts" />
/// <reference path="../widgets.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.editor {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const DropdownModal = utils.DropdownModal;
const ExplainingListItem = util.ExplainingListItem;



export const SelectCategoryDropdown = createClassAndFactory({
  displayName: 'SelectCategoryDropdown',

  getInitialState: function() {
    return {
      open: false,
    };
  },

  open: function() {
    this.setState({
      open: true,
      windowWidth: window.innerWidth,
      buttonRect: reactGetRefRect(this.refs.dropdownButton),
    });
  },

  close: function() {
    this.setState({ open: false });
  },

  onCategorySelected: function(listItem) {
    this.props.onCategorySelected(listItem.eventKey);
    this.close();
  },

  render: function() {
    const props = this.props;
    const store: Store = props.store;

    // UX COULD let user click a checkbox, to show categories from all site sections, even if by
    // default showing only categories from any current site section. [subcomms]
    const categoriesToList: Category[] = store.currentCategories.length ?
        store.currentCategories : store.allCategoriesHacky;

    const selectedCategory: Category =
      _.find(categoriesToList, c => c.id === props.selectedCategoryId);

    dieIf(!selectedCategory && props.selectedCategoryId, "Selected category missing [EdE5YFK24]");
    const categoryName = selectedCategory ? selectedCategory.name : "Select category...";

    const dropdownButton =
      Button({ onClick: this.open, ref: 'dropdownButton' },
        categoryName + ' ', r.span({ className: 'caret' }));

    const categoryListItems = categoriesToList.map((category: Category) => {
      return ExplainingListItem({ onSelect: this.onCategorySelected,
        activeEventKey: props.selectedCategoryId, eventKey: category.id, key: category.id,
        title: category.name, text: category.description });
    });

    const dropdownModal =
      DropdownModal({ show: this.state.open, onHide: this.close, showCloseButton: true,
          atRect: this.state.buttonRect, windowWidth: this.state.windowWidth },
        r.div({ className: 'esDropModal_header' }, "Select category:"),
        r.ul({},
          categoryListItems));

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
