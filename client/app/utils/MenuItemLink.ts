/*
 * Copyright (c) 2016 Kaj Magnus Lindberg
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
/// <reference path="../ReactStore.ts" />
/// <reference path="../login/login-dialog.ts" />
/// <reference path="../page-tools/page-tools.ts" />
/// <reference path="../utils/page-scroll-mixin.ts" />
/// <reference path="../utils/scroll-into-view.ts" />
/// <reference path="../post-navigation/posts-trail.ts" />
/// <reference path="../avatar/avatar.ts" />
/// <reference path="../notification/Notification.ts" />
/// <reference path="../../typedefs/keymaster/keymaster.d.ts" />

//------------------------------------------------------------------------------
   module debiki2.utils {
//------------------------------------------------------------------------------

var r = React.DOM;


export var MenuItemLink = createComponent({
  render: function() {
    var href: string = this.props.href;

    var rememberReturnToUrl = href && href.search('/-/admin') === -1
        ? null
        : () => { sessionStorage.setItem('returnToUrl', window.location.toString()); };

    // Copy react-bootstrap's MenuItem html.
    return (
        r.li({ role: 'presentation' },
          r.a({ role: 'button', href: href, tabIndex: this.props.tabindex || -1,
              onClick: rememberReturnToUrl },
            this.props.children)));
  }
});

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
