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
      expandedCats: {},
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
    this.setState({ open: false, expandedCats: {} });
  },

  onCategorySelected: function(listItem) {
    this.props.onCategorySelected(listItem.eventKey);
    this.close();
  },

  render: function() {
    const props = this.props;
    const store: Store = props.store;
    const categories: Category[] | U = props.categories || store.currentCategories;
    const expandedCats: { [id: string]: Bo } = this.state.expandedCats;

    // UX add a text input to fuzzy-filter on category names, like Skim (rustlang) does.

    // UX COULD let user click a checkbox, to show categories from all site sections, even if by
    // default showing only categories from any current site section. [subcomms]
    const catsToList: Category[] =
            categories.length ? categories : store.allCategoriesHacky;

    const selectedCategory: Category =
      _.find(catsToList, c => c.id === props.selectedCategoryId);

    dieIf(!selectedCategory && props.selectedCategoryId, "Selected category missing [EdE5YFK24]");
    const categoryName = selectedCategory ? selectedCategory.name : t.scd.SelCat + '...';

    const dropdownButton =
      Button({ onClick: this.open, ref: 'dropdownButton' },
        categoryName + ' ', r.span({ className: 'caret' }));

    const catsTree = categories_sortTree(catsToList);

    const makeCatListItem = (category: CatsTreeCat, depth: Nr) => {
      if (depth > CategoryDepth.SubSubCatDepth) {
        // @ifdef DEBUG
        die("Sub sub sub cats not supported. Category cycle? [TyE4056MWK2]");
        // @endif
        return false;
      }

      let subStuff;
      if (category.subCats) {
        const numSubCats = category.subCats.length;
        const isExpanded = numSubCats <= 2 || expandedCats[category.id];
        subStuff = r.div({},
            isExpanded ? null :
                Button({ onClick: () => {
                  const newExpCats = { ...expandedCats };
                  newExpCats[category.id] = true;
                  this.setState({ expandedCats: newExpCats });
                } }, `Show ${numSubCats} sub categories ...`),  // I18N
            !isExpanded ? null :
                r.ol({},
                  category.subCats.map(c => makeCatListItem(c, depth + 1))));
      }

      const listItemProps: ExplainingListItemProps = {
              onSelect: this.onCategorySelected,
              activeEventKey: props.selectedCategoryId, eventKey: category.id,
              key: category.id, title: category.name, text: category.description,
              subStuff };

      return ExplainingListItem(listItemProps);
    }

    const catListItems = catsTree.baseCats.map(c =>
              makeCatListItem(c, CategoryDepth.BaseCatDepth));

    const dropdownModal =
      DropdownModal({ show: this.state.open, onHide: this.close, showCloseButton: true,
          atRect: this.state.buttonRect, windowWidth: this.state.windowWidth },
        r.div({ className: 'esDropModal_header' }, t.scd.SelCat + ':'),
        r.ul({},
          catListItems));

    return (
      rFragment({},
        dropdownButton,
        dropdownModal));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
