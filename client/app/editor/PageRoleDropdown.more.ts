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
/// <reference path="../slim-bundle.d.ts" />

//------------------------------------------------------------------------------
   module debiki2.editor {
//------------------------------------------------------------------------------

var r = React.DOM;
var DropdownModal = utils.DropdownModal;
var ExplainingListItem = util.ExplainingListItem;


// BEM name: esTopicType -- no. Instead, esPTD = Page-Type-Dropdown?
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
    this.setState({
      open: true,
      windowWidth: window.innerWidth,
      buttonRect: reactGetRefRect(this.refs.dropdownButton),
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

    var discussionOption =
      ExplainingListItem({ onSelect: this.onSelect,
        activeEventKey: pageRole, eventKey: PageRole.Discussion,
        title: PageRole_Discussion_IconString,
        text: "A discussion about something." });

    // HACK bjj... wants only Discussion & MindMap. Later, COULD add a show-only-these-
    // topic-types category & site setting, instead of hardcoding one site settings here.
    var isBjjNotStaff = debiki.siteId === '12' && !isStaff(me);

    var questionOption = isBjjNotStaff ? null :
      ExplainingListItem({ onSelect: this.onSelect, id: 'e2eTTD_QuestionO',
        activeEventKey: pageRole, eventKey: PageRole.Question,
        title: PageRole_Question_IconString,
        text: r.span({}, "One answer can be marked as the accepted answer.") });

    var problemOption = isBjjNotStaff ? null :
      ExplainingListItem({ onSelect: this.onSelect, id: 'e2eTTD_ProblemO',
        activeEventKey: pageRole, eventKey: PageRole.Problem,
        title: PageRole_Problem_IconString,
        text: "If something is broken or doesn't work. Can be marked as fixed/solved." });

    var ideaOption = isBjjNotStaff ? null :
      ExplainingListItem({ onSelect: this.onSelect, id: 'e2eTTD_IdeaO',
        activeEventKey: pageRole, eventKey: PageRole.Idea,
        title: PageRole_Idea_IconString,
        text: "A suggestion. Can be marked as done/implemented." });

    var chatOption = user_isGuest(me) || isBjjNotStaff ? null :
      ExplainingListItem({ onSelect: this.onSelect, id: 'e2eTTD_OpenChatO',
        activeEventKey: pageRole, eventKey: PageRole.OpenChat,
        title: PageRole_OpenChat_IconString,
        text: "A perhaps never-ending conversation." });

    var privateChatOption = !isStaff(me) ? null :
      ExplainingListItem({ onSelect: this.onSelect, id: 'e2eTTD_PrivChatO',
        activeEventKey: pageRole, eventKey: PageRole.PrivateChat,
        title: PageRole_PrivateChat_IconString,
        text: "Only visible to people that get invited to join the chat." });

    var wikiMindMap = user_isGuest(me) || !complicated ? false :
      ExplainingListItem({ onSelect: this.onSelect, id: 'e2eTTD_MindMapO',
        activeEventKey: pageRole, eventKey: PageRole.MindMap,
        title: PageRole_MindMap_IconString,
        text: "Comments laid out in a mind map tree." });

    var showMore = !isStaff(me) || showAllOptions || props.hideMore ? null :
      ExplainingListItem({ onClick: this.showAllOptions,
        title: r.span({ className: 'esPageRole_showMore' }, "More...") });

    var staffOnlyDivider = !isStaff(me) ? null :
        r.div({ className: 'esDropModal_header' }, "Only staff can create these:");

    var adminOnlyDivider;
    var webPageOption;
    var formOption;
    var customHtmlPageOption;
    if (me.isAdmin && showAllOptions) {
      adminOnlyDivider = r.div({ className: 'esDropModal_header' }, "Only for admins:");

      webPageOption =
        ExplainingListItem({ onSelect: this.onSelect, id: 'e2eTTD_WebPageO',
          activeEventKey: pageRole, eventKey: PageRole.WebPage,
          title: "Info page",
          text: "A page without comments and author name." });

      formOption =  // [6JK8WHI3]
        ExplainingListItem({ onSelect: this.onSelect, id: 'e2eTTD_FormO',
          activeEventKey: pageRole, eventKey: PageRole.Form,
          title: "Form",
          text: "A contact form" });

      if (complicated) {
        customHtmlPageOption =
          ExplainingListItem({ onSelect: this.onSelect, id: 'e2eTTD_CustHtmlO',
            activeEventKey: pageRole, eventKey: PageRole.CustomHtmlPage,
            title: "Custom HTML page",
            text: "Create your own page in HTML and CSS." });
      }
    }

    var dropdownModal =
      DropdownModal({ show: state.open, onHide: this.close, showCloseButton: true,
          atRect: this.state.buttonRect, windowWidth: this.state.windowWidth,
          ref: 'dropdownModal' },
        r.div({ className: 'esDropModal_header'}, "Select topic type:"),
        r.ul({ className: 'esTopicType' },

          discussionOption,
          questionOption,
          problemOption,
          ideaOption,
          chatOption,
          wikiMindMap,

          staffOnlyDivider,
          privateChatOption,

          showMore,

          adminOnlyDivider,
          formOption,
          webPageOption,
          customHtmlPageOption));

    return (
      r.div({ style: { display: 'inline-block' } },
        dropdownButton,
        dropdownModal));
  }
});



function pageRole_toIconString(pageRole: PageRole) {
  switch (pageRole) {
    case PageRole.CustomHtmlPage: return "Custom HTML page";
    case PageRole.WebPage: return "Info page";
    case PageRole.Code: return "Code";
    case PageRole.SpecialContent: return "Special content";
    case PageRole.EmbeddedComments: return "Embedded comments";
    case PageRole.Blog: return "Blog";
    case PageRole.Forum: return "Forum";
    case PageRole.About: return "About";
    case PageRole.Question: return PageRole_Question_IconString;
    case PageRole.Problem: return PageRole_Problem_IconString;
    case PageRole.Idea: return PageRole_Idea_IconString;
    case PageRole.ToDo: return PageRole_Todo_IconString;
    case PageRole.MindMap: return PageRole_MindMap_IconString;
    case PageRole.Discussion: return PageRole_Discussion_IconString;
    case PageRole.FormalMessage: return "Message";
    case PageRole.OpenChat: return PageRole_OpenChat_IconString;
    case PageRole.PrivateChat: return PageRole_PrivateChat_IconString;
    case PageRole.Form: return PageRole_Form_IconString;
    case PageRole.Critique: return "Critique";  // [plugin]
    case PageRole.UsabilityTesting: return "Usability Testing";  // [plugin]
    default: die(`Bad page role: ${pageRole} [EsE4GUK75Z]`);
  }
}

var iconFor = pageRole_iconClass;

var PageRole_Discussion_IconString =
  r.span({ className: iconFor(PageRole.Discussion) }, "Discussion");
var PageRole_Question_IconString = r.span({ className: iconFor(PageRole.Question) }, "Question");
var PageRole_Problem_IconString = r.span({ className: iconFor(PageRole.Problem) }, "Problem");
var PageRole_Idea_IconString = r.span({ className: iconFor(PageRole.Idea) }, "Idea");
var PageRole_MindMap_IconString = r.span({ className: iconFor(PageRole.MindMap) }, "Mind Map");

var PageRole_Todo_IconString = r.span({ className: iconFor(PageRole.ToDo) }, "Todo");
var PageRole_OpenChat_IconString = r.span({ className: iconFor(PageRole.OpenChat) }, "Chat");
var PageRole_PrivateChat_IconString = r.span({ className: iconFor(PageRole.PrivateChat) }, "Private Chat");

var PageRole_Form_IconString = r.span({ className: iconFor(PageRole.Form) }, "Form");


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
