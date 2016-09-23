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
export var Button: any = makeWidget(r.button, ' btn btn-default');
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
          origProps.onClick();
        }
      };

      if (origProps.primary) {
        newProps.className = newProps.className + ' btn-primary';
      }
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
  return (
    r.li({ role: 'presentation', className: className, key: props.key },
      r.a({ role: 'button', id: props.id,
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
