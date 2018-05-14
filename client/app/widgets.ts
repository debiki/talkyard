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
/// <reference path="links.ts" />

//------------------------------------------------------------------------------
   namespace debiki2 {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;


export const Router: any = reactCreateFactory(
   isServerSide() ? ReactRouterDOM.StaticRouter : ReactRouterDOM.BrowserRouter);
export const Switch: any = reactCreateFactory(ReactRouterDOM.Switch);
export const Route: any = reactCreateFactory(ReactRouterDOM.Route);
export const Redirect: any = reactCreateFactory(ReactRouterDOM.Redirect);
export const Link: any = reactCreateFactory(ReactRouterDOM.Link);
export const NavLink: any = reactCreateFactory(ReactRouterDOM.NavLink);

// A react-router NavLink wrapped in a <li>.
export function LiNavLink(...propsAndContents) {
  return r.li({}, NavLink.apply(this, arguments));
}

// Redirs to path, which should be like '/some/path/', to just '/some/path' with no trailing slash.
export function RedirToNoSlash({ path }) {
  return Redirect({
    path: path,
    to: path.substr(0, path.length - 1),
    exact: true,  // so won't match if there's more stuff after the last '/'
    strict: true, // otherwise ignores the trailing '/'
  });
}

// Redirs to path + append.
export function RedirAppend({ path, append }) {
  return Redirect({
    from: path,
    to: path + append,
    exact: true,  // so won't match if there's more stuff after the last '/'
  });
}


export const PrimaryButton: any = makeWidget(r.button, ' btn btn-primary');
export const Button: any = makeWidget(r.button, ' btn btn-default');
export const PrimaryLinkButton: any = makeWidget(r.a, ' btn btn-primary');
export const LinkButton: any = makeWidget(r.a, ' btn btn-default');  // not blue [2GKR5L0]
export const ExtLinkButton: any = makeWidget(r.a, ' btn btn-default', { ext: true });
export const InputTypeSubmit: any = makeWidget(r.input, ' btn btn-primary', { type: 'submit' });


function makeWidget(what, spaceWidgetClasses: string, extraProps?) {
  return function(origProps, ...children) {
    const newProps: any = _.assign({}, origProps || {}, extraProps);
    const helpText = newProps.help;
    if (helpText) {
      // We'll show a help text <p> below the widget.
      delete newProps.help;
      newProps.key = newProps.key || 'widget';
    }
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

    // Make link buttons navigate whithin the single-page-app, no page reloads. Even if they're
    // in a different React root. But skip the admin app — it's its own SPA. [6TKQ20]
    // COULD use Link also in /-/admin sometimes, see  (5JKSW20).
    const afterClick = newProps.afterClick;
    const isExternal = newProps.ext || eds.isInEmbeddedCommentsIframe;
    delete newProps.afterClick;
    delete newProps.ext;
    if (what === r.a && !isExternal && !newProps.onClick && newProps.href.search('/-/admin/') === -1) {
      newProps.onClick = function(event) {
        event.preventDefault(); // avoids full page reload
        debiki2.page['Hacks'].navigateTo(newProps.href);
        // Some ancestor components ignore events whose target is not their own divs & stuff.
        // Not my code, cannot change that. I have in mind React-Bootstrap's Modal, which does this:
        // `if (e.target !== e.currentTarget) return; this.props.onHide();` — so onHide() never
        // gets called. But we can use afterClick: ...:
        if (afterClick) {
          afterClick();
        }
      }
    }

    const anyHelpDiv =
        helpText && r.p({ className: 'help-block', key: newProps.key + '-help' }, helpText);

    const widgetArgs = [newProps].concat(children);
    const widget = what.apply(undefined, widgetArgs);

    return anyHelpDiv ? [widget, anyHelpDiv] : widget;
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

  // If we're in the admin area, use <a href> because then the destinations are in another
  // single-page-app. And if we're in the forum app, use Link, for instant
  // within-the-SPA navigation.  (5JKSW20)
  const isInAdminArea = location.pathname.search('/-/admin/') === 0;
  const isToAdminArea = props.to.search('/-/admin/') === 0;
  const useSpaLink = isInAdminArea === isToAdminArea;

  // useSpaLink —> create a Link({ to: ... }).
  // Otherwise, create a r.a({ href: ... }).

  const linkFn = useSpaLink ? Link : r.a;
  const addrAttr = useSpaLink ? 'to' : 'href';

  const linkProps = { role: 'button', tabIndex: props.tabIndex || -1,
    target: props.target, id: props.id };
  linkProps[addrAttr] = props.to;

  return (
    r.li({ role: 'presentation', className: props.className, key: props.key },
      linkFn.apply(null, [linkProps].concat(children))));
}


export function MenuItemDivider() {
  return r.li({ role: 'separator', className: 'divider' });
}


export function UserName(props: {
    user: BriefUser, store: Store, makeLink?: boolean, onClick?: any, avoidFullName?: boolean }) {
  // Some dupl code, see discussion.ts, edit-history-dialog.ts & avatar.ts [88MYU2]
  const user = props.user;
  const showHow: ShowAuthorHow = props.store.settings.showAuthorHow;

  // (All StackExchange demo sites use ShowAuthorHow.FullNameThenUsername, so
  // only used in that if branch, below.)
  const isStackExchangeUser = user.username && user.username.search('__sx_') === 0; // [2QWGRC8P]

  const guestClass = user_isGuest(user) ? ' esP_By_F-G' : '';
  const guestMark = user_isGuest(user) ? ' ?' : '';

  let namePartOne;
  let namePartTwo;

  if (showHow === ShowAuthorHow.UsernameOnly) {
    // CLEAN_UP rename these CSS classes from ...By_F to By_1 and By_2 for part 1 (bold font)
    // and 2 (normal font) instead?
    // But for now, use By_F for the *username* just because it's bold, and By_U for the full name,
    // because it's thin.
    const username = !user.username ? null : r.span({className: 'esP_By_F'}, user.username);
    const fullName = username ? null :
        r.span({ className: 'esP_By_U' + guestClass }, user.fullName + guestMark);
    namePartOne = username;
    namePartTwo = fullName;
  }
  else if (showHow === ShowAuthorHow.UsernameThenFullName) {
    const username = !user.username ? null : r.span({className: 'esP_By_F'}, user.username + ' ');
    const skipName =
        !user.fullName || (props.avoidFullName && user.username) || user.username == user.fullName;
    const fullName = skipName ? undefined :
      r.span({ className: 'esP_By_U' + guestClass }, user.fullName + guestMark);
    namePartOne = username;
    namePartTwo = fullName;
  }
  else {
    // @ifdef DEBUG
    dieIf(showHow && showHow !== ShowAuthorHow.FullNameThenUsername, 'TyEE4KGUDQ2');
    // @endif

    const fullName: any = !user.fullName || (props.avoidFullName && user.username) ? undefined :
      r.span({ className: 'esP_By_F' + guestClass }, user.fullName + guestMark + ' ');

    const username = !user.username || isStackExchangeUser ? null :
      r.span({ className: 'esP_By_U' },
        r.span({ className: 'esP_By_U_at' }, '@'), user.username);

    namePartOne = fullName;
    namePartTwo = username;
  }

  if (!namePartOne && !namePartTwo) {
    namePartOne = "(Unknown author)";
  }

  const linkFn = <any>(props.makeLink ? r.a : r.span);
  const newProps: any = {
    className: 'dw-p-by esP_By',
  };

  let bugWrapInDiv = false;

  // Talkyard demo hack: usernames that starts with '__sx_' are of the form    [2QWGRC8P]
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
      newProps.href = linkToUserProfilePage(user);
      // BUG [7UKWBP4] workaround: embedded comments pages rendered server side, don't know
      // that they're embedded comments pages and won't prefix links with https://comments-for-.../.
      // When rendering client side, the links will get that prefix and work fine — however,
      // React decides to keep the server side link instead of the client side link,
      // when matching the server side html with the client side html.
      // The real fix is to include the comments-for-... origin server side too, but for now,
      // add a key prop so React understands it shouldn't reuse the server side link.
      if (eds.isInEmbeddedCommentsIframe) {
        bugWrapInDiv = true;
      }
    }
    if (props.onClick) {
      newProps.onClick = props.onClick;
    }
  }

  let result = linkFn(newProps, namePartOne, namePartTwo);
  if (bugWrapInDiv) {
    // React 16.2 removes span but keeps div.
    result = r.div({ style: { display: 'inline' }}, result);
  }
  return result;
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
