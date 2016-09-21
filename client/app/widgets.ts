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
   module debiki2 {
//------------------------------------------------------------------------------

var r = React.DOM;

export var ReactCSSTransitionGroup = isServerSide() ? null :
    reactCreateFactory(React.addons.CSSTransitionGroup);

export var PrimaryButton: any = makeWidget(r.button, ' btn btn-primary');
export var NormalButton: any = makeWidget(r.button, ' btn btn-default');
export var Button = NormalButton;


function makeWidget(what, spaceWidgetClasses: string) {
  return function(props, ...children) {
    var props2 = _.assign({}, props || {});
    props2.className = (props.className || '') + spaceWidgetClasses;
    var args = [props2].concat(children);
    return what.apply(undefined, args);
  }
}


export function MenuItem(props, ...children) {
  return (
    r.li({ role: 'presentation', className: props.wrapperClassName, key: props.key },
      r.a({ role: 'button', className: props.className, id: props.id,
          onClick: props.onClick || props.onSelect, tabIndex: props.tabindex || -1 },
        children)));
}


export function MenuItemLink(props, ...children) {
  return (
    r.li({ role: 'presentation', className: props.className },
      r.a({ role: 'button', href: props.href, tabIndex: props.tabindex || -1,
          target: props.target },
        children)));
}


export function MenuItemDivider() {
  return r.li({ role: 'separator', className: 'divider' });
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
