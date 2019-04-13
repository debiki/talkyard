/*
 * Copyright (c) 2015-2019 Kaj Magnus Lindberg
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

/// <reference path="../more-prelude.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.editor {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const DropdownModal = utils.DropdownModal;
const ExplainingListItem = util.ExplainingListItem;


// BEM name: esTopicType -- no. Instead, esPTD = Page-Type-Dropdown?
// No. Instead: s_PTD = page type dialog.
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
    const props = this.props;
    const state = this.state;
    const pageRole = props.pageRole;
    const complicated = props.complicated;
    const store: Store = this.props.store;
    const settings: SettingsVisibleClientSide = store.settings;
    const me: Myself = store.me;
    const showAllOptions = state.showAllOptions;

    // Don't allow changing already existing topics, to chat topics, because chat
    // topics are "totally" different from "normal" topics like
    // discussions/ideas/questions etc. Chat topic types, may be selected only
    // when creating a new page.
    const canChangeToChat: boolean = !props.pageExists;

    const dropdownButton =
      Button({ onClick: this.open, ref: 'dropdownButton', className: 'esTopicType_dropdown' },
        pageRole_toIconString(pageRole), ' ', r.span({ className: 'caret' }));

    const discussionOption =
      ExplainingListItem({ onSelect: this.onSelect, id: 'te_DiscO',
        activeEventKey: pageRole, eventKey: PageRole.Discussion,
        title: PageRole_Discussion_IconString,
        text: t.pt.DiscussionExpl });

    // HACK bjj... wants only Discussion & MindMap. Later, COULD add a show-only-these-
    // topic-types category & site setting, instead of hardcoding one site settings here.
    const isBjjNotStaff = eds.siteId === 12 && !isStaff(me);

    const questionOption = isBjjNotStaff ? null :
      ExplainingListItem({ onSelect: this.onSelect, id: 'e2eTTD_QuestionO',
        activeEventKey: pageRole, eventKey: PageRole.Question,
        title: PageRole_Question_IconString,
        text: r.span({}, t.pt.QuestionExpl) });

    const problemOption = isBjjNotStaff ? null :
      ExplainingListItem({ onSelect: this.onSelect, id: 'e2eTTD_ProblemO',
        activeEventKey: pageRole, eventKey: PageRole.Problem,
        title: PageRole_Problem_IconString,
        text: t.pt.ProblExpl });

    const ideaOption = isBjjNotStaff ? null :
      ExplainingListItem({ onSelect: this.onSelect, id: 'e2eTTD_IdeaO',
        activeEventKey: pageRole, eventKey: PageRole.Idea,
        title: PageRole_Idea_IconString,
        text: t.pt.IdeaExpl });

    const chatOption = !canChangeToChat ? null :
      user_isGuest(me) || isBjjNotStaff || settings.enableChat === false ? null :
      ExplainingListItem({ onSelect: this.onSelect, id: 'e2eTTD_OpenChatO',
        activeEventKey: pageRole, eventKey: PageRole.OpenChat,
        title: PageRole_OpenChat_IconString,
        text: t.pt.ChatExpl });

    const privateChatOption = !canChangeToChat ? null :
      !isStaff(me) || props.hideStaffOnly || settings.enableChat === false ? null :
      ExplainingListItem({ onSelect: this.onSelect, id: 'e2eTTD_PrivChatO',
        activeEventKey: pageRole, eventKey: PageRole.PrivateChat,
        title: PageRole_PrivateChat_IconString,
        text: t.pt.PrivChatExpl });

    /*
    const wikiMindMap = user_isGuest(me) || !complicated ? false :   [NOMINDMAPS]
      ExplainingListItem({ onSelect: this.onSelect, id: 'e2eTTD_MindMapO',
        activeEventKey: pageRole, eventKey: PageRole.MindMap,
        title: PageRole_MindMap_IconString,
        text: "Comments laid out in a mind map tree." }); */

    const showMore = !isStaff(me) || props.hideStaffOnly || showAllOptions ? null :
      ExplainingListItem({ onClick: this.showAllOptions,
        title: r.span({ className: 'esPageRole_showMore' }, t.MoreDots) });

    const staffOnlyDivider = !isStaff(me) || props.hideStaffOnly ? null :
        r.div({ className: 'esDropModal_header' }, "Only staff can create these:");

    let adminOnlyDivider;
    let webPageOption;
    let formOption;
    let customHtmlPageOption;
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

    const dropdownModal =
      DropdownModal({ show: state.open, onHide: this.close, showCloseButton: true,
          atRect: this.state.buttonRect, windowWidth: this.state.windowWidth,
          ref: 'dropdownModal' },
        r.div({ className: 'esDropModal_header'}, t.pt.SelectTypeC),
        r.ul({ className: 'esTopicType' },

          discussionOption,
          questionOption,
          problemOption,
          ideaOption,
          chatOption,
          //wikiMindMap,

          staffOnlyDivider,
          privateChatOption,

          showMore,

          adminOnlyDivider,
          formOption,
          webPageOption,
          customHtmlPageOption));

    return (
      rFragment({},
        dropdownButton,
        dropdownModal));
  }
});



export function pageRole_toIconString(pageRole: PageRole) {
  switch (pageRole) {
    case PageRole.CustomHtmlPage: return t.pt.CustomHtml;
    case PageRole.WebPage: return t.pt.InfoPage;
    case PageRole.Code: return t.pt.Code;
    case PageRole.SpecialContent: return "Special content";
    case PageRole.EmbeddedComments: return t.pt.EmbCmts;
    case PageRole.Blog: return t.BlogN;
    case PageRole.Forum: return t.Forum;
    case PageRole.About: return t.pt.About;
    case PageRole.Question: return PageRole_Question_IconString;
    case PageRole.Problem: return PageRole_Problem_IconString;
    case PageRole.Idea: return PageRole_Idea_IconString;
    case PageRole.ToDo: return PageRole_Todo_IconString;
    case PageRole.MindMap: return PageRole_MindMap_IconString;
    case PageRole.Discussion: return PageRole_Discussion_IconString;
    case PageRole.FormalMessage: return t.MessageN;
    case PageRole.OpenChat: return PageRole_OpenChat_IconString;
    case PageRole.PrivateChat: return PageRole_PrivateChat_IconString;
    case PageRole.Form: return PageRole_Form_IconString;
    case PageRole.Critique: return "Critique";  // [plugin]
    case PageRole.UsabilityTesting: return PageRole_UsabilityTesting_IconString;  // [plugin]
    default: die(`Bad page role: ${pageRole} [EsE4GUK75Z]`);
  }
}

var iconFor = pageRole_iconClass;

var PageRole_Discussion_IconString =
  r.span({ className: iconFor(PageRole.Discussion) }, t.Discussion);
var PageRole_Question_IconString = r.span({ className: iconFor(PageRole.Question) }, t.Question);
var PageRole_Problem_IconString = r.span({ className: iconFor(PageRole.Problem) }, t.Problem);
var PageRole_Idea_IconString = r.span({ className: iconFor(PageRole.Idea) }, t.Idea);
var PageRole_MindMap_IconString = r.span({ className: iconFor(PageRole.MindMap) }, "Mind Map");

var PageRole_Todo_IconString = r.span({ className: iconFor(PageRole.ToDo) }, "Todo");
var PageRole_OpenChat_IconString = r.span({ className: iconFor(PageRole.OpenChat) }, t.ChatN);
var PageRole_PrivateChat_IconString = r.span({ className: iconFor(PageRole.PrivateChat) }, t.pt.PrivChat);

var PageRole_Form_IconString = r.span({ className: iconFor(PageRole.Form) }, t.pt.Form);

// Use the same icon as ToDo.
var PageRole_UsabilityTesting_IconString = r.span({ className: iconFor(PageRole.ToDo) }, // [plugin]
    "Usability Testing");


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
