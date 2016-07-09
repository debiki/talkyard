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
/// <reference path="../utils/fade-in-on-click.ts" />

//------------------------------------------------------------------------------
   module debiki2.forum {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var Button = reactCreateFactory(ReactBootstrap.Button);
var ButtonGroup = reactCreateFactory(ReactBootstrap.ButtonGroup);
var ButtonInput = reactCreateFactory(ReactBootstrap.ButtonInput);
var Modal = reactCreateFactory(ReactBootstrap.Modal);
var ModalBody = reactCreateFactory(ReactBootstrap.ModalBody);
var ModalFooter = reactCreateFactory(ReactBootstrap.ModalFooter);
var ModalHeader = reactCreateFactory(ReactBootstrap.ModalHeader);
var ModalTitle = reactCreateFactory(ReactBootstrap.ModalTitle);

var createTopicDialog;

export function getCreateTopicDialog() {
  if (!createTopicDialog) {
    createTopicDialog = ReactDOM.render(CreateTopicDialog(), utils.makeMountNode());
  }
  return createTopicDialog;
}


var CreateTopicDialog = createClassAndFactory({ // [refactor] [5YKW294] Delete :->
  getInitialState: function () {
    return {
      isOpen: false,
      category: null,
    };
  },

  open: function(category: Category) {
    if (!category.newTopicTypes || category.newTopicTypes.length <= 1) {
      //die("Too few topic types [DwE4WKQ2]");
    }
    this.setState({
      isOpen: true,
      category: category,
    });
  },

  close: function() {
    this.setState({
      isOpen: false,
      category: null,
    });
  },

  openEditor: function(topicType: PageRole) {
    this.close();
    debiki2.editor.editNewForumPage(this.state.category.id, topicType);
  },

  render: function () {
    var openEditor = (topicType: PageRole) => {
      return () => {
        this.openEditor(topicType);
      };
    };

    var topicTypes: PageRole[] = this.state.category ?
        this.state.category.newTopicTypes || [] : [];

    var askQuestionButton = topicTypes.indexOf(PageRole.Question) === -1 ? null :
        Button({ onClick: openEditor(PageRole.Question) },
          r.span({ className: 'icon-help-circled' },
            "A question"));

    var problemButton = topicTypes.indexOf(PageRole.Problem) === -1 ? null :
        Button({ onClick: openEditor(PageRole.Problem) },
          r.span({ className: 'icon-attention-circled' },
            "Something doesn't work, seems broken"));

    var ideaButton = topicTypes.indexOf(PageRole.Idea) === -1 ? null :
        Button({ onClick: openEditor(PageRole.Idea) },
          r.span({ className: 'icon-idea' },
            "An idea"));

    var discussionButton = topicTypes.indexOf(PageRole.Discussion) === -1 ? null :
        Button({ onClick: openEditor(PageRole.Discussion) },
          "Something else");

    var body =
        r.div({},
          askQuestionButton,
          problemButton,
          ideaButton,
          discussionButton);

    return (
      Modal({ show: this.state.isOpen, onHide: this.close,
          dialogClassName: 'dw-dlg-create-topic dw-no-borders' },
        ModalHeader({}, ModalTitle({}, "What kind of topic?")),
        ModalBody({}, body),
        ModalFooter({}, Button({ onClick: this.close }, "Cancel"))));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
