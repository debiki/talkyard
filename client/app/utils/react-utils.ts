/*
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
/// <reference path="../plain-old-javascript.d.ts" />


var reactCreateFactory = React['createFactory'];


function createComponent(componentDefinition) { // oops should obviously be named createFactory
  if (isServerSide()) {
    // The mere presence of these functions cause an unknown error when rendering
    // React-Router server side. So remove them; they're never called server side anyway.
    // The error logs the message '{}' to console.error(); no idea what that means.
    delete componentDefinition.componentWillUpdate;
    delete componentDefinition.componentWillReceiveProps;
  }
  return reactCreateFactory(React.createClass(componentDefinition));
}


function createClassAndFactory(componentDefinition) { // rename createComponent to this
  return createComponent(componentDefinition);
}


/**
 * An ISO date that shall not be converted to "X time ago" format.
 * It doesn't really do anything, but use it so that it'll be easy to find all
 * date formatting code.
 */
function dateTimeFix(isoDate: string) {
  return isoDate;
}

/**
 * Wraps the ISO8601 in a <span class="dw-ago"> so jQuery can find it and replace
 * the fixed ISO date with something like "5 hours ago" — see processTimeAgo
 * just below.  The server inculdes only ISO dates, not "x time ago", in its HTML,
 * so that it can be cached.
 */
function timeAgo(isoDate: string) {
  return r.span({ className: 'dw-ago' }, isoDate);
}

/**
 * Takes 25-30ms for 80 unprocessed comments on my computer, and 2ms for 160
 * that have been processed already.
 */
function processTimeAgo(selector?: string) {
  selector = selector || '';
  $(selector + ' .dw-ago').each(function() {
    var $this = $(this);
    if ($this.attr('title'))
      return; // already converted to "x ago" format
    var isoDate = $this.text();
    var timeAgoString = moment(isoDate).fromNow();
    $this.text(timeAgoString);
    $this.attr('title', isoDate);
  });
}


//------------------------------------------------------------------------------
   module debiki2.utils {
//------------------------------------------------------------------------------

export var createComponent = window['createComponent'];
export var createClassAndFactory = window['createClassAndFactory'];
export var reactCreateFactory = React['createFactory'];

export function makeMountNode() {
  return $('<div>').appendTo('body')[0];
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
