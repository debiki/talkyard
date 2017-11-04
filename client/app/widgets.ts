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

/// <reference path="prelude.ts" />

//------------------------------------------------------------------------------
   namespace debiki2 {
//------------------------------------------------------------------------------

const r = React.DOM;

declare const ReactRouter: any;
export const Route: any = reactCreateFactory(ReactRouter.Route);
export const IndexRoute: any = reactCreateFactory(ReactRouter.IndexRoute);
export const Redirect: any = reactCreateFactory(ReactRouter.Redirect);
export const DefaultRoute: any = reactCreateFactory(ReactRouter.DefaultRoute);

export const PrimaryButton: any = makeWidget(r.button, ' btn btn-primary');
export const Button: any = makeWidget(r.button, ' btn btn-default');
export const PrimaryLinkButton: any = makeWidget(r.a, ' btn btn-primary');
export const LinkButton: any = makeWidget(r.a, ' btn btn-default');  // not blue [2GKR5L0]
export const InputTypeSubmit: any = makeWidget(r.input, ' btn btn-primary', { type: 'submit' });


function makeWidget(what, spaceWidgetClasses: string, extraProps?) {
  return function(origProps, ...children) {
    var newProps = _.assign({}, origProps || {}, extraProps);
    newProps.className = (origProps.className || '') + spaceWidgetClasses;

    // Prevent automatic submission of Button when placed in a <form>.
    // And, if primary button, add Bootstrap's primary button color class.
    if (what === r.button || what === r.input && extraProps.type === 'submit') {
      newProps.onClick = function(event) {
        if (origProps.disabled) {
          event.preventDefault();
          event.stopPropagation();
        }
        if (origProps.onClick) {
          event.preventDefault();
          origProps.onClick(event);
        }
        // else: Don't prevent-default; instead, submit form.
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


export function UserName(
    props: { user: BriefUser, makeLink?: boolean, onClick?: any, avoidFullName?: boolean }) {
  // Some dupl code, see discussion.ts, edit-history-dialog.ts & avatar.ts [88MYU2]
  const user = props.user;
  const isStackExchangeUser = user.username && user.username.search('__sx_') === 0; // [2QWGRC8P]

  const guestClass = user_isGuest(user) ? ' esP_By_F-G' : '';
  const guestMark = user_isGuest(user) ? '? ' : '';
  let fullName: any = !user.fullName || (props.avoidFullName && user.username) ? undefined :
    r.span({ className: 'esP_By_F' + guestClass }, user.fullName + ' ' + guestMark);
  const username = !user.username || isStackExchangeUser ? null :
    r.span({ className: 'esP_By_U' },
      r.span({ className: 'esP_By_U_at' }, '@'), user.username);

  if (!fullName && !username) {
    fullName = "(Unknown author)";
  }


  const linkFn = <any>(props.makeLink ? r.a : r.span);
  const newProps: any = {
    className: 'dw-p-by esP_By',
  };

  // EffectiveDiscussions demo hack: usernames that starts with '__sx_' are of the form    [2QWGRC8P]
  // '__sx_[subdomain]_[user-id]' where [subdomain] is a StackExchange subdomain, and
  // [user-id] is a StackExchange user id. In this way, we can link & attribute comments
  // directly to people at StackExchange, as required by StackOverflow's CC-By license.
  if (isStackExchangeUser) {
    const subdomainAndIdStr = user.username.substr(5, 9999);
    const array = subdomainAndIdStr.split('_');
    const subdomain = array[0];
    const userId = array[1];
    newProps.target = '_blank';
    newProps.href = subdomain === 'so'
        ? `https://stackoverflow.com/users/${userId}`
        : `https://${subdomain}.stackexchange.com/users/${userId}`;
  }
  else {
    if (props.makeLink) {
      newProps.href = '/-/users/' + user.id;
    }
    if (props.onClick) {
      newProps.onClick = props.onClick;
    }
  }

  return linkFn(newProps, fullName, username);
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
