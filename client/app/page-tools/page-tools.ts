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
/// <reference path="../../shared/plain-old-javascript.d.ts" />
/// <reference path="../ReactStore.ts" />
/// <reference path="../Server.ts" />

//------------------------------------------------------------------------------
   module debiki2.pagetools {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var Button = reactCreateFactory(ReactBootstrap.Button);
var Input = reactCreateFactory(ReactBootstrap.Input);
var Modal = reactCreateFactory(ReactBootstrap.Modal);
var ModalTrigger = reactCreateFactory(ReactBootstrap.ModalTrigger);
var OverlayMixin = ReactBootstrap.OverlayMixin;


export var pageToolsDialog;


export function createPageToolsDialog() {
  var elem = document.getElementById('dw-react-page-tools-dialog');
  if (elem) {
    pageToolsDialog = React.render(PageToolsDialog(), elem);
  }
}


var PageToolsDialog = createComponent({
  mixins: [OverlayMixin],

  getInitialState: function () {
    return {
      isOpen: false,
      store: debiki2.ReactStore.allData()
    };
  },

  isEmpty: function() {
    var store: Store = this.state.store;
    return !canPinPage(store);
  },

  open: function(post: Post) {
    this.setState({ isOpen: true });
  },

  close: function() {
    this.setState({ isOpen: false });
  },

  render: function () {
    return null;
  },

  unpinPage: function() {
    ReactActions.unpinPage(this.close);
  },

  renderOverlay: function () {
    if (!this.state.isOpen)
      return null;

    var store: Store = this.state.store;
    var childProps = {
      store: store,
      closeAllDialogs: this.close
    };

    var pinPageButton = !canPinPage(store) ? null :
      ModalTrigger({ modal: PinPageDialog(childProps) },
        Button({}, store.pinWhere ? "Edit Pin" : "Pin Topic"));

    var unpinPageButton = (!canPinPage(store) || !store.pinWhere) ? null :
      Button({ onClick: this.unpinPage }, "Unpin Topic");

    var buttons = [
      pinPageButton,
      unpinPageButton];

    return (
      Modal({ title: "Do what?", onRequestHide: this.close },
        r.div({ className: 'modal-body' }, buttons),
        r.div({ className: 'modal-footer' }, Button({ onClick: this.close }, 'Close'))));
  }
});


function canPinPage(store: Store) {
  return store.parentPageId && store.pageRole !== PageRole.Category;
}


var DefaultPinOrder = 5;


var PinPageDialog = createComponent({
  doPin: function() {
    var pinWhere = this.refs.pinGloballyInput.getChecked() ?
        PinPageWhere.Globally : PinPageWhere.InCategory;
    var pinOrder = parseInt(this.refs.pinOrderInput.getValue());
    if (isNaN(pinOrder) || pinOrder < 1 || pinOrder > 100) {
      alert("Please enter a number between 1 and 100");
      return;
    }
    ReactActions.pinPage(pinOrder, pinWhere, () => {
      this.props.closeAllDialogs();
    });
  },

  render: function() {
    var props = $.extend({ title: 'Pin Page' }, this.props);
    var store = props.store;
    var pinInThisCategoryChecked = !store.pinWhere || store.pinWhere === PinPageWhere.InCategory;
    var pinGloballyChecked = store.pinWhere === PinPageWhere.Globally;
    return (
      Modal(props,
        r.div({ className: 'modal-body' },
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
        r.div({ className: 'modal-footer' },
          Button({ onClick: this.doPin }, store.pinWhere ? 'Save' : 'Pin'),
          Button({ onClick: this.props.onRequestHide }, 'Cancel'))));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
