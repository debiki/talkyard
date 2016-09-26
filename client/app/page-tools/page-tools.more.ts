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
/// <reference path="../slim-bundle.d.ts" />
/// <reference path="../react-bootstrap-old/Input.more.ts" />
/// <reference path="../help/help-dialog.more.ts" />

//------------------------------------------------------------------------------
   module debiki2.pagetools {
//------------------------------------------------------------------------------

var r = React.DOM;
var ReactBootstrap: any = window['ReactBootstrap'];
var Modal = reactCreateFactory(ReactBootstrap.Modal);
var ModalHeader = reactCreateFactory(ReactBootstrap.ModalHeader);
var ModalTitle = reactCreateFactory(ReactBootstrap.ModalTitle);
var ModalBody = reactCreateFactory(ReactBootstrap.ModalBody);
var ModalFooter = reactCreateFactory(ReactBootstrap.ModalFooter);


var pageToolsDialog;


export function getPageToolsDialog() {
  if (!pageToolsDialog) {
    pageToolsDialog = ReactDOM.render(PageToolsDialog(), utils.makeMountNode());
  }
  return pageToolsDialog;
}


var PageToolsDialog = createComponent({
  getInitialState: function () {
    return {
      isOpen: false,
      store: debiki2.ReactStore.allData()
    };
  },

  open: function() {
    this.setState({ isOpen: true });
  },

  close: function() {
    this.setState({ isOpen: false });
  },

  selectPosts: function() {
    // page.openSelectPostsDialog();
  },

  unpinPage: function() {
    ReactActions.unpinPage(this.close);
  },

  deletePage: function() {
    ReactActions.deletePages([this.state.store.pageId], this.close);
  },

  undeletePage: function() {
    ReactActions.undeletePages([this.state.store.pageId], this.close);
  },

  render: function () {
    var store: Store = this.state.store;
    var childProps = {
      store: store,
      closeAllDialogs: this.close
    };

    var selectPostsButton; // = !store_canSelectPosts(store) ? null :
      //Button({ onClick: this.selectPosts }, "Select posts");

    var pinPageButton;
    var pinPageDialog;
    if (store_canPinPage(store)) {
      pinPageDialog = PinPageDialog($.extend({ ref: 'pinPageDialog' }, childProps));
      pinPageButton =
          Button({ onClick: () => this.refs.pinPageDialog.open() },
            store.pinWhere ? "Edit Pin" : "Pin Topic");
    }

    var unpinPageButton = (!store_canPinPage(store) || !store.pinWhere) ? null :
      Button({ onClick: this.unpinPage }, "Unpin Topic");

    var deletePageButton = !store_canDeletePage(store) ?  null :
      Button({ onClick: this.deletePage }, "Delete Topic");

    var undeletePageButton = !store_canUndeletePage(store) ?  null :
      Button({ onClick: this.undeletePage }, "Restore Topic");

    var buttons = r.div({},
      selectPostsButton,
      pinPageButton,
      unpinPageButton,
      deletePageButton,
      undeletePageButton);

    return (
      Modal({ show: this.state.isOpen, onHide: this.close },
        pinPageDialog,
        ModalHeader({}, ModalTitle({}, "Do what?")),
        ModalBody({}, buttons),
        ModalFooter({}, Button({ onClick: this.close }, 'Close'))));
  }
});


var DefaultPinOrder = 5;


var PinPageDialog = createComponent({
  getInitialState: function() {
    return { isOpen: false };
  },

  open: function() {
    this.setState({ isOpen: true });
  },

  close: function() {
    this.setState({ isOpen: false });
  },

  doPin: function() {
    var pinWhere = this.refs.pinGloballyInput.getChecked() ?
        PinPageWhere.Globally : PinPageWhere.InCategory;
    var pinOrder = parseInt(this.refs.pinOrderInput.getValue());
    if (isNaN(pinOrder) || pinOrder < 1 || pinOrder > 100) {
      alert("Please enter a number between 1 and 100");
      return;
    }
    ReactActions.pinPage(pinOrder, pinWhere, () => {
      this.close();
      this.props.closeAllDialogs();
      help.openHelpDialogUnlessHidden({
        content: r.span({ className: 'esPinnedOk' },
          "Pinned. Now there's a pin icon ", r.span({className: 'icon-pin'}),
          " in front of the topic title."),
        id: '32MYKP02',
      });
    });
  },

  render: function() {
    var store = this.props.store;
    var pinInThisCategoryChecked = !store.pinWhere || store.pinWhere === PinPageWhere.InCategory;
    var pinGloballyChecked = store.pinWhere === PinPageWhere.Globally;
    return (
      Modal({ show: this.state.isOpen, onHide: this.close },
        ModalHeader({}, ModalTitle({}, "Pin Page")),
        ModalBody({},
          r.p({}, "Pin this topic to make it show up first in the forum topic list."),
          r.p({}, r.b({}, "Pin where?")),
          r.form({},
            Input({ type: 'radio', name: 'pinWhere', label: "In this category only",
                ref: 'pinInCategoryInput', defaultChecked: pinInThisCategoryChecked }),
            Input({ type: 'radio', name: 'pinWhere', label: "The wole forum, all categories",
                ref: 'pinGloballyInput', defaultChecked: pinGloballyChecked })),
          r.br(),
          Input({ type: 'number', label: "Pin order (you can ignore this)", ref: 'pinOrderInput',
              help: "Sort order if many topics are pinned, 1 is first.",
              defaultValue: store.pinOrder || DefaultPinOrder })),
        ModalFooter({},
          Button({ onClick: this.doPin }, store.pinWhere ? 'Save' : 'Pin'),
          Button({ onClick: this.close }, 'Cancel'))));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
