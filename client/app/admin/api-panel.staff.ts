/*
 * Copyright (c) 2018 Kaj Magnus Lindberg
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

/// <reference path="../slim-bundle.d.ts" />
/// <reference path="../editor-bundle-already-loaded.d.ts" />
/// <reference path="oop-method.staff.ts" />


//------------------------------------------------------------------------------
   namespace debiki2.admin {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;



export const ApiPanel = createFactory({
  displayName: 'ApiPanel',

  getInitialState: function() {
    return {};
  },

  componentDidMount: function() {
    Server.listApiSecrets(secrets => {
      if (this.isGone) return;
      this.setState({ secrets });
    });
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  createSecret: function() {
    Server.createApiSecret(secret => {
      if (this.isGone) return;
      const secrets = [secret, ...this.state.secrets];
      this.setState({ secrets });
    });
  },

  render: function() {
    if (!this.state.secrets)
      return r.p({}, "Loading...");

    const store: Store = this.props.store;

    let elems = this.state.secrets.map((apiSecret: ApiSecret, index: number) => {
      return ApiSecretItem({ index, apiSecret });
    });

    const elemsList = elems.length
        ? r.table({ className: 's_A_Api_SecrT' },
            r.thead({},
              r.th({}, "Nr"),
              r.th({}, "For user"),
              r.th({}, "Created"),
              r.th({}, "Deleted"),
              r.th({}, "Capabilities"),
              r.th({}, "Value and actions")),
            r.tbody({},
              elems))
        : r.p({ className: 'e_NoApiSecrets' }, "No API secrets.");

    const createSecretButton = Button({ onClick: this.createSecret }, "Create new secret");

    return (
      r.div({ className: 's_A_Api' },
        r.h3({}, "API Secrets"),
        r.p({}, "Recent first."),
        elemsList,
        createSecretButton));
  }
});



const ApiSecretItem = createComponent({
  displayName: 'ApiSecretItem',

  getInitialState: function() {
    return {
      showValue: false,
    };
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  deleteSecret: function() {
    const secret: ApiSecret = this.props.apiSecret;
    Server.deleteApiSecrets([secret.nr], () => {
      // For now: Needs to refresh page to view deleted status.
    });
  },

  render: function() {
    const secret: ApiSecret = this.props.apiSecret;
    // Don't show secrets that still works, unless one clicks Show — so less risk that they get exposed.
    const shallShow = this.state.showValue || secret.isDeleted;
    const secretKeyOrShowButton = shallShow ? secret.secretKey :
        Button({ onClick: () => this.setState({ showValue: true }) }, "Show");

    const deleteButton = secret.isDeleted ? null :
      Button({ onClick: this.deleteSecret }, "Delete");

    return r.tr({ key: this.props.index },
      r.td({}, secret.nr),
      r.td({}, "Any"),  // currently may call API using any user id
      r.td({}, timeExact(secret.createdAt)),
      r.td({}, secret.isDeleted ? rFragment("Yes, ", timeExact(secret.deletedAt)) : "No"),
      r.td({}, "Do anything"), // secret.secretType is always for any user
      r.td({}, deleteButton, secretKeyOrShowButton));
  }
});



//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
