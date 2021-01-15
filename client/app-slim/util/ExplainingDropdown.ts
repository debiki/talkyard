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


/*
 * In this file: A dropdown modal with entries to select, each one has a title and
 * an explanation text.
 *
 * Hmm but I haven't yet moved all code to here. Fairly much code is still somewhere
 * inside ../forum/forum.ts instead.
 */

// (Could move to more-bundle.js — but it's nice to be able to create the menu
// items inline, directly in slim-bundle.js.)

//------------------------------------------------------------------------------
   namespace debiki2.util {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;


// COULD change to pure fn
export var ExplainingListItem = createComponent({
  displayName: 'ExplainingListItem',

  onClick: function(event) {
    const props: ExplainingListItemProps = this.props;
    event.preventDefault();
    if (props.onClick) {
      props.onClick(event);
    }
    if (props.onSelect) {
      props.onSelect(props);  // = calls onSelect(props: ExplainingTitleText)
    }
  },

  render: function() {
    const props: ExplainingListItemProps = this.props;
    const entry: ExplainingTitleText = this.props;
    const activeClass =
        props.active || _.isUndefined(props.active) && (
          props.onSelect && props.activeEventKey === props.eventKey) ?
        ' active' : '';
    const disabledClass = props.disabled ? ' c_Dis' : '';
    const subStuff = !entry.subStuff ? null :
            r.div({ className: 'esExplDrp_entry_sub' }, entry.subStuff);
    const onClick = props.disabled ? undefined : this.onClick;

    return (
      r.li({ className: 'esExplDrp_entry' + activeClass + disabledClass},
        r.a({ onClick, id: props.id, className: props.className },
          r.div({ className: 'esExplDrp_entry_title' }, entry.title),
          r.div({ className: 'esExplDrp_entry_expl' }, entry.text)),
        subStuff));
  },
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
