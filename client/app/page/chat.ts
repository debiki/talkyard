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
/// <reference path="../react-elements/name-login-btns.ts" />
// xx reference path="posts.ts" />

//------------------------------------------------------------------------------
   module debiki2.page {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var Button = reactCreateFactory(ReactBootstrap.Button);
var DropdownButton = reactCreateFactory(ReactBootstrap.DropdownButton);
var MenuItem = reactCreateFactory(ReactBootstrap.MenuItem);


export var ChatComments = createComponent({
   render: function() {
      var title = 'chat tittle';//Title(this.props); // later: only if not scrolled down too far
      var theLastComments = '';
      var newCommentInput = '';
      return (
        r.div({ className: 'esChatPage_height100' },
          title,
          theLastComments,
          newCommentInput));
   }
});


// Staying at the bottom: http://blog.vjeux.com/2013/javascript/scroll-position-with-react.html

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
