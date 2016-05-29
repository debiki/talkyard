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
/// <reference path="../plain-old-javascript.d.ts" />
/// <reference path="../model.ts" />
/// <reference path="../page-methods.ts" />

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


// Some dupl code, see SelectCategoryDropdown [7GKDF25]
// BEM name: esPageRole
export var PageRoleDropdown = createComponent({
  getInitialState: function() {
    return {
      open: false,
      buttonX: -1,
      buttonY: -1,
    };
  },

  open: function() {
    // Dupl code [7GKDF25]
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

  onSelect: function(listItem) {
    this.props.onSelect(listItem.eventKey);
    this.close();
  },

  render: function() {
    var props = this.props;
    var state = this.state;
    var pageRole = props.pageRole;
    var complicated = props.complicated;
    var store: Store = this.props.store;
    var me: Myself = store.me;

    var dropdownButton =
      Button({ onClick: this.open, ref: 'dropdownButton' },
        pageRole_toString(pageRole) + ' ', r.span({ className: 'caret' }));

    var wikiMindMap = !complicated ? false :
      ExplainingListItem({ onSelect: this.onSelect,
        activeEventKey: pageRole, eventKey: PageRole.MindMap,
        title: "Mind map", text: "" });

    var adminOnlyDivider;
    var openChatOption;
    var privateChatOption;
    var webPageOption;
    var customHtmlPageOption;
    if (me.isAdmin) {
      adminOnlyDivider = r.div({ className: 'esDropModal_header' }, "Only staff can create these:");
      openChatOption =
        ExplainingListItem({ onSelect: this.onSelect,
          activeEventKey: pageRole, eventKey: PageRole.OpenChat,
          title: "Chat channel", text: "" });

      webPageOption =
        ExplainingListItem({ onSelect: this.onSelect,
          activeEventKey: pageRole, eventKey: PageRole.WebPage,
          title: "Info page", text: "A normal discussion page with comments enabled, " +
              "but with no page author name shown. Use for about-this-site like pages." });

      // Not yet implemented:
      // privateChatOption = r.option({ value: PageRole.PrivateChat }, "Private chat");

      if (complicated) {
        customHtmlPageOption =
          ExplainingListItem({ onSelect: this.onSelect,
            activeEventKey: pageRole, eventKey: PageRole.CustomHtmlPage,
            title: "Custom HTML page", text: "Create your own page in HTML and CSS." });
      }
    }

    var dropdownModal =
      DropdownModal({ show: state.open, onHide: this.close, pullLeft: this.props.pullLeft,
          atX: state.buttonX, atY: state.buttonY },
        r.div({ className: 'esDropModal_header'}, "Select topic type:"),
        r.ul({},
          ExplainingListItem({ onSelect: this.onSelect,
            activeEventKey: pageRole, eventKey: PageRole.Discussion,
            title: "Discussion", text: "The default. Use if there's no better fit." }),

          ExplainingListItem({ onSelect: this.onSelect,
            activeEventKey: pageRole, eventKey: PageRole.Question,
            title: "Question", text: "" }),

          ExplainingListItem({ onSelect: this.onSelect,
            activeEventKey: pageRole, eventKey: PageRole.Problem,
            title: "Problem", text: "If something is broken or doesn't work." }),

          ExplainingListItem({ onSelect: this.onSelect,
            activeEventKey: pageRole, eventKey: PageRole.Idea,
            title: "Idea", text: "" }),

          ExplainingListItem({ onSelect: this.onSelect,
            activeEventKey: pageRole, eventKey: PageRole.ToDo,
            title: "Todo", text: "Something that should be done or fixed." }),

          wikiMindMap,
          adminOnlyDivider,
          webPageOption,
          customHtmlPageOption,
          openChatOption,
          privateChatOption));

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
