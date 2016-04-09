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

/// <reference path="../../typedefs/react/react.d.ts" />
/// <reference path="../../typedefs/modernizr/modernizr.d.ts" />
/// <reference path="../plain-old-javascript.d.ts" />
/// <reference path="../util/stupid-dialog.ts" />
/// <reference path="../utils/react-utils.ts" />
/// <reference path="../utils/PageUnloadAlerter.ts" />
/// <reference path="../utils/DropdownModal.ts" />
/// <reference path="../util/ExplainingDropdown.ts" />
/// <reference path="../model.ts" />
/// <reference path="../Server.ts" />
/// <reference path="commonmark.ts" />
/// <reference path="editor-utils.ts" />

//------------------------------------------------------------------------------
   module debiki2.editor {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var Button = reactCreateFactory(ReactBootstrap.Button);
var DropdownModal = utils.DropdownModal;
var ExplainingListItem = util.ExplainingListItem;



export var SelectCategoryDropdown = createClassAndFactory({
  getInitialState: function() {
    return {
      open: false,
      buttonX: -1,
      buttonY: -1,
    };
  },

  open: function() {
    var rect = ReactDOM.findDOMNode(this.refs.dropdownButton).getBoundingClientRect();
    this.setState({
      open: true,
      buttonX: this.props.pullLeft ? rect.left : rect.right,
      buttonY: rect.bottom
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
    var props = this.props;
    var state = this.state;
    var store: Store = props.store;
    var selectedCategory: Category =
      _.find(store.categories, c => c.id === props.selectedCategoryId);

    dieIf(!selectedCategory, "Selected category missing [EsE5YFK24]");

    var dropdownButton =
      Button({ onClick: this.open, className: 'zzz', ref: 'dropdownButton' },
        selectedCategory.name + ' ', r.span({ className: 'caret' }));

    var categoryListItems = store.categories.map((category: Category) => {
      return ExplainingListItem({ onSelect: this.onCategorySelected,
        activeEventKey: props.selectedCategoryId, eventKey: category.id, key: category.id,
        title: category.name, text: category.description });
    });

    var dropdownModal =
      DropdownModal({ show: state.open, onHide: this.close, pullLeft: this.props.pullLeft,
          atX: state.buttonX, atY: state.buttonY },
        r.div({ className: 'esSelectCategory_header' }, "Select category:"),
        r.ul({},
          categoryListItems));

    return (
      r.div({},
        dropdownButton,
        dropdownModal));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
