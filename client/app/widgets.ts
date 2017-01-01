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

/// <reference path="../typedefs/react/react.d.ts" />
/// <reference path="prelude.ts" />

//------------------------------------------------------------------------------
   namespace debiki2 {
//------------------------------------------------------------------------------

var r = React.DOM;

var ReactRouter = window['ReactRouter'];
export var Route = reactCreateFactory(ReactRouter.Route);
export var IndexRoute = reactCreateFactory(ReactRouter.IndexRoute);
export var Redirect = reactCreateFactory(ReactRouter.Redirect);
export var DefaultRoute = reactCreateFactory(ReactRouter.DefaultRoute);

export var PrimaryButton: any = makeWidget(r.button, ' btn btn-primary');
export var Button: any = makeWidget(r.button, ' btn btn-default');
export var PrimaryLinkButton: any = makeWidget(r.a, ' btn btn-primary');
export var LinkButton: any = makeWidget(r.a, ' btn btn-default');
export var InputTypeSubmit: any = makeWidget(r.input, ' btn btn-primary', { type: 'submit' });


function makeWidget(what, spaceWidgetClasses: string, extraProps?) {
  return function(origProps, ...children) {
    var newProps = _.assign({}, origProps || {}, extraProps);
    newProps.className = (origProps.className || '') + spaceWidgetClasses;

    // Prevent automatic submission of Button when placed in a <form>.
    // And, if primary button, add Bootstrap's primary button color class.
    if (what === r.button || what === r.input && r.type === 'submit') {
      newProps.onClick = function(event) {
        event.preventDefault();
        if (origProps.disabled) {
          event.stopPropagation();
        }
        if (origProps.onClick) {
          origProps.onClick(event);
        }
      };

      if (origProps.primary) {
        newProps.className = newProps.className + ' btn-primary';
      }
      // Don't do this inside the above `if`; that won't work if `.primary` is undef/false.
      delete newProps.primary;
    }

    var args = [newProps].concat(children);
    return what.apply(undefined, args);
  }
}


export function MenuItem(props, ...children) {
  var className = props.className || '';
  if (props.active) {
    className += ' active';
  }
  // Don't do  r.a(props, children)  because that'd result in an """an array or iterator
  // should have a unique "key" prop""" React.js warning.
  var linkProps = { role: 'button', id: props.id,
    onClick: props.onClick || props.onSelect, tabIndex: props.tabIndex || -1 };
  return (
    r.li({ role: 'presentation', className: className, key: props.key },
      r.a.apply(null, [linkProps].concat(children))));

}


export function MenuItemLink(props, ...children) {
  // Don't do  r.a(props, children)  because that'd result in an """an array or iterator
  // should have a unique "key" prop""" React.js warning.
  var linkProps = { role: 'button', href: props.href, tabIndex: props.tabIndex || -1,
    target: props.target, id: props.id };
  return (
    r.li({ role: 'presentation', className: props.className, key: props.key },
      r.a.apply(null, [linkProps].concat(children))));
}


export function MenuItemDivider() {
  return r.li({ role: 'separator', className: 'divider' });
}


export function UserName(props: { user: BriefUser, makeLink?: boolean, onClick?: any }) {
  // Some dupl code, see discussion.ts, edit-history-dialog.ts & avatar.ts [88MYU2]
  let user = props.user;
  var guestClass = user_isGuest(user) ? ' esP_By_F-G' : '';
  var guestMark = user_isGuest(user) ? '? ' : '';
  var fullName = !user.fullName ? undefined :
    r.span({ className: 'esP_By_F' + guestClass }, user.fullName + ' ' + guestMark);
  var username = !user.username ? null :
    r.span({ className: 'esP_By_U' },
      r.span({ className: 'esP_By_U_at' }, '@'), user.username);

  if (!fullName && !username) {
    fullName = '(Unknown author)';
  }


  let linkFn = props.makeLink ? 'a' : 'span';
  let newProps: any = {
    className: 'dw-p-by esP_By',
  };

  if (props.makeLink) {
    newProps.href = '/-/users/' + user.id;
  }

  if (props.onClick) {
    newProps.onClick = props.onClick;
  }

  return r[linkFn](newProps, fullName, username);
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
