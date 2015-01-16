/*
 * Copyright (C) 2015 Kaj Magnus Lindberg (born 1979)
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
/// <reference path="../react-elements/name-login-btns.ts" />
/// <reference path="../ReactStore.ts" />
/// <reference path="../Server.ts" />

//------------------------------------------------------------------------------
   module debiki2.nopage {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var Button = reactCreateFactory(ReactBootstrap.Button);
var Input = reactCreateFactory(ReactBootstrap.Input);


export var NonExistingPage = createComponent({
  mixins: [debiki2.StoreListenerMixin],

  getInitialState: function() {
    return {
      store: debiki2.ReactStore.allData(),
    };
  },

  onChange: function() {
    this.setState({
      store: debiki2.ReactStore.allData(),
    });
  },

  render: function() {
    var user: User = this.state.store.user;
    if (user.isAdmin) {
      return CreateSomethingHere(this.state.store);
    }
    else {
      return LoginAndBecomeAdmin(this.state.store);
    }
  }
});



export var LoginAndBecomeAdmin = createComponent({
  render: function() {
    return (
      r.div({},
        r.h1({}, 'Nothing here, yet'),
        r.p({}, 'To configure your site and create something, register a new ' +
            'admin account with the email you specified in the configuration file: ' +
            'click the button below, then click ', r.b({}, 'Create New Account'), '.'),
        r.p({}, 'Or simply login, if you have already registered.'),
        r.br(),
        reactelements.NameLoginBtns({ title: 'Login or Register', purpose: 'LoginAsAdmin' })));
  }
});



export var CreateSomethingHere = createComponent({
  getInitialState: function() {
    return {
      createWhat: undefined,
    };
  },
  render: function() {
    var createWhat = this.state.createWhat;
    var anyCreateForumPanel = createWhat === 'Forum' ?
        CreateForumPanel(this.props) : null;

    var anyCreateEmbeddedCommentsPanel = createWhat === 'EmbeddedComments' ?
        CreateEmbeddedCommentsPanel(this.props) : null;

    return (
      r.div({},
        r.h1({}, 'Nothing here, yet'),
        r.p({}, 'Do you want to create something here?'),
        r.div({ className: 'create-what-options' },
          Button({ active: createWhat === 'Forum',
              onClick: () => this.setState({ createWhat: 'Forum' })},
              'Create a Forum'),
          Button({ active: createWhat === 'EmbeddedComments',
              onClick: () => this.setState({ createWhat: 'EmbeddedComments' })},
              'Embedded Comments')),
        anyCreateForumPanel,
        anyCreateEmbeddedCommentsPanel));
  }
});



export var CreateForumPanel = createComponent({
  getInitialState: function() {
    return {
      forumName: ''
    };
  },

  handleChange: function() {
    this.setState({
      forumName: this.refs.forumName.getValue()
    });
  },

  createForum: function() {
    var data = {
      pageRole: 'Forum',
      pageStatus: 'Published',
      pageTitle: this.state.forumName,
      pageBody: 'Forum description',
      showId: false,
      pageSlug: '',
    };
    Server.createPage(data, (newPageId: string) => {
      window.location.assign('/-' + newPageId);
    });
  },

  render: function() {
    return (
      r.div({},
        Input({ type: 'text', label: 'Forum name:', placeholder: 'Enter forum name here',
            ref: 'forumName', onChange: this.handleChange }),
        Button({ onClick: this.createForum, disabled: !this.state.forumName.length },
            'Create Forum')));
  }
});



export var CreateEmbeddedCommentsPanel = createComponent({
  render: function() {
    return r.p({}, 'Embedded comments options...');
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
