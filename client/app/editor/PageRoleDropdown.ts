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

// [refactor] move to ../util/TopicTypeDropdown.ts

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
// BEM name: esTopicType
export var PageRoleDropdown = createComponent({
  getInitialState: function() {
    return {
      open: false,
      buttonX: -1,
      buttonY: -1,
      showAllOptions: false,
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
    if (this.props.onSelect) {
      this.props.onSelect(listItem.eventKey);
    }
    this.close();
  },

  showAllOptions: function() {
    this.setState({ showAllOptions: true });
    // This'll reposition the dropdown, otherwise the new options might get placed
    // outside the window, unreachable.
    setTimeout(() => {
      if (this.refs.dropdownModal)
        this.refs.dropdownModal.componentDidUpdate();
    });
  },

  render: function() {
    var props = this.props;
    var state = this.state;
    var pageRole = props.pageRole;
    var complicated = props.complicated;
    var store: Store = this.props.store;
    var me: Myself = store.me;
    var showAllOptions = state.showAllOptions;

    var dropdownButton =
      Button({ onClick: this.open, ref: 'dropdownButton', className: 'esTopicType_dropdown' },
        pageRole_toIconString(pageRole), ' ', r.span({ className: 'caret' }));

    var wikiMindMap = !complicated || !showAllOptions || !isStaff(me) ? false :
      ExplainingListItem({ onSelect: this.onSelect,
        activeEventKey: pageRole, eventKey: PageRole.MindMap,
        title: PageRole_MindMap_IconString,
        text: "Comments laid out in a mind map tree." });

    var showMore = !isStaff(me) || showAllOptions || props.hideMore ? null :
      ExplainingListItem({ onClick: this.showAllOptions,
        title: r.span({ className: 'esPageRole_showMore' }, "More...") });

    var staffOnlyDivider;
    var todoOption;
    var privateChatOption;

    if (isStaff(me) && showAllOptions) {
      staffOnlyDivider = r.div({ className: 'esDropModal_header' }, "Only staff can create these:");

      /* [refactor] remove, use Icon status Planned / Doing instead  [4YK0F24]
      todoOption =
        ExplainingListItem({ onSelect: this.onSelect,
          activeEventKey: pageRole, eventKey: PageRole.ToDo,
          title: PageRole_Todo_IconString,
          text: "Something that should be done or fixed." });
        */

      // Not yet implemented:
      // privateChatOption = r.option({ value: PageRole.PrivateChat }, "Private chat");
    }

    var adminOnlyDivider;
    var webPageOption;
    var customHtmlPageOption;
    if (me.isAdmin && showAllOptions) {
      adminOnlyDivider = r.div({ className: 'esDropModal_header' }, "Only for admins:");

      webPageOption =
        ExplainingListItem({ onSelect: this.onSelect,
          activeEventKey: pageRole, eventKey: PageRole.WebPage,
          title: "Info page",
          text: "A page without comments and author name." });

      if (complicated) {
        customHtmlPageOption =
          ExplainingListItem({ onSelect: this.onSelect,
            activeEventKey: pageRole, eventKey: PageRole.CustomHtmlPage,
            title: "Custom HTML page",
            text: "Create your own page in HTML and CSS." });
      }
    }

    var dropdownModal =
      DropdownModal({ show: state.open, onHide: this.close, pullLeft: this.props.pullLeft,
          atX: state.buttonX, atY: state.buttonY, ref: 'dropdownModal' },
        r.div({ className: 'esDropModal_header'}, "Select topic type:"),
        r.ul({ className: 'esTopicType' },
          ExplainingListItem({ onSelect: this.onSelect,
            activeEventKey: pageRole, eventKey: PageRole.Discussion,
            title: PageRole_Discussion_IconString,
            text: "A discussion about something." }),

          ExplainingListItem({ onSelect: this.onSelect,
            activeEventKey: pageRole, eventKey: PageRole.Question,
            title: PageRole_Question_IconString,
            text: r.span({}, "One answer can be marked as the accepted answer.") }),

          ExplainingListItem({ onSelect: this.onSelect,
            activeEventKey: pageRole, eventKey: PageRole.Problem,
            title: PageRole_Problem_IconString,
            text: "If something is broken or doesn't work. Can be marked as fixed/solved." }),

          ExplainingListItem({ onSelect: this.onSelect,
            activeEventKey: pageRole, eventKey: PageRole.Idea,
            title: PageRole_Idea_IconString,
            text: "A suggestion. Can be marked as done/implemented." }),

          ExplainingListItem({ onSelect: this.onSelect,
            activeEventKey: pageRole, eventKey: PageRole.OpenChat,
            title: PageRole_Chat_IconString,
            text: "A possibly never-ending conversation." }),

          showMore,

          staffOnlyDivider,

          wikiMindMap,
          todoOption,
          privateChatOption,

          adminOnlyDivider,
          webPageOption,
          customHtmlPageOption));

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
