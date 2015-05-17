/**
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

//------------------------------------------------------------------------------
   module debiki2.admin {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];

var ReactBootstrap: any = window['ReactBootstrap'];
var Button = reactCreateFactory(ReactBootstrap.Button);
var ModalTrigger = reactCreateFactory(ReactBootstrap.ModalTrigger);
var Modal = reactCreateFactory(ReactBootstrap.Modal);
var Input = reactCreateFactory(ReactBootstrap.Input);

var ReactRouter = window['ReactRouter'];
var RouterNavigation = ReactRouter.Navigation;
var RouterState = ReactRouter.State;


export var AdminUserPage = createComponent({
  mixins: [RouterState, RouterNavigation],

  getInitialState: function() {
    return {
      user: null
    };
  },

  componentWillMount: function(nextProps) {
    this.loadCompleteUser();
  },

  componentWillReceiveProps: function(nextProps) {
    this.loadCompleteUser();
  },

  loadCompleteUser: function() {
    this.setState({ user: null });
    var params = this.getParams();
    Server.loadCompleteUser(params.userId, (user) => {
      if (!this.isMounted()) return;
      this.setState({
        user: user
      });
    });
  },

  publicProfileLink: function() {
    return '/-/users/#/id/' + this.state.user.id;
  },

  unsuspendUser: function() {
    Server.unsuspendUser(this.state.user.id, () => {
      this.loadCompleteUser();
    });
  },

  render: function() {
    var user: CompleteUser = this.state.user;
    if (!user)
      return r.p({}, 'Loading...');
    
    var showPublProfileButton = Button({ href: this.publicProfileLink() }, 'Show Public Profile');

    var usernameAndFullName = user.username;
    if (user.fullName) {
      usernameAndFullName += ' (' + user.fullName + ')';
    }

    var suspendedText = user.suspendedTillEpoch
        ? 'from ' + moment(user.suspendedAtEpoch).format('YYYY-MM-DD') +
            ' to ' + moment(user.suspendedTillEpoch).format('YYYY-MM-DD HH:mm') +
            ', reason: ' + user.suspendedReason
        : 'no';

    var suspendButton;
    if (user.isAdmin) {
      // Cannot suspend admins.
    }
    else if (user.suspendedTillEpoch && Date.now() <= user.suspendedTillEpoch) {
      suspendButton =
          Button({ onClick: this.unsuspendUser }, 'Unsuspend');
    }
    else {
      suspendButton =
          ModalTrigger({ modal: SuspendDialog({ user: user, reloadUser: this.loadCompleteUser }) },
            Button({}, 'Suspend'));
    }

    return (
      r.div({},
        r.div({ className: 'pull-right' },
          showPublProfileButton),

        r.p({}, 'Username: ' + usernameAndFullName),
        
        r.p({}, 'Admin: ' + user.isAdmin),

        r.p({}, 'Suspended: ' + suspendedText, suspendButton)));
  }
});


var SuspendDialog = createComponent({
  doSuspend: function() {
    var numDays = parseInt(this.refs.daysInput.getValue());
    if (isNaN(numDays)) {
      alert('Please enter a number');
      return;
    }
    var reason = this.refs.reasonInput.getValue();
    if (!reason) {
      alert("Please clarify why you're suspending this user");
      return;
    }
    if (reason.length > 255) {
      alert("At most 255 characters please");
      return;
    }
    Server.suspendUser(this.props.user.id, numDays, reason, () => {
      this.props.onRequestHide();
      this.props.reloadUser();
    });
  },

  render: function() {
    var props = $.extend({ title: 'Suspend User' }, this.props);
    return (
      Modal(props,
        r.div({ className: 'modal-body' },
          Input({ type: 'number', label: 'Suspend for how many days?', ref: 'daysInput' }),
          Input({ type: 'text', label: 'Why suspend this user?',
              help: "This will be visible to everyone, " +
              "on the user's public profile, and shown to the user when s/he tries to login. " +
              "Keep it short.", ref: 'reasonInput' })),

        r.div({ className: 'modal-footer' },
          Button({ onClick: this.doSuspend }, 'Suspend'),
          Button({ onClick: this.props.onRequestHide }, 'Cancel'))));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
