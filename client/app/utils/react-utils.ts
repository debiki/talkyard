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
/// <reference path="../prelude.ts" />


var reactCreateFactory = React['createFactory'];
var isServerSide = debiki2.isServerSide;


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
function timeAgo(isoDate: string, clazz?: string) {
  return r.span({ className: 'dw-ago ' + (clazz || '') }, isoDate);
}

/**
 * Like timeAgo(isoDate) but results in just "5h" instead of "5 hours ago".
 * That is, uses only one single letter, instead of many words.
 */
function prettyLetterTimeAgo(isoDate: string, clazz?: string) {
  return r.span({ className: 'dw-ago-ltr ' + (clazz || '') }, isoDate);
}

function timeExact(isoDate: string, clazz?: string) {
  return r.span({ className: 'esTimeExact ' + (clazz || '') }, isoDate);
}


/**
 * Replaces ISO8601 timestamps with "5 hours ago" or just "5h".
 *
 * Before when I was using moment.js: (no longer do, it's rather large)
 * Takes 25-30ms for 80 unprocessed comments on my computer, and 2ms for 160
 * that have been processed already.
 */
// COULD move to page/hacks.ts
function processTimeAgo(selector?: string) {
  selector = selector || '';
  var timeDoneClass = 'esTimeDone';
  // First handle all long version timestamps (don't end with -ltr ("letter")).
  // Result: e.g. "5 hours ago"
  $(selector + ' .dw-ago:not(.' + timeDoneClass + ')').each(function() {
    var $this = $(this);
    var isoDate = $this.text();
    var timeAgoString = moment(isoDate).fromNow();
    $this.text(timeAgoString);
    $this.addClass(timeDoneClass);
    // But don't add any title tooltip attr, see [85YKW20] above.
  });

  // Then handle all one-letter timestamps (end with -ltr ("letter")).
  // Result: e.g. "5h" (instead of "5 hours ago").
  $(selector + ' .dw-ago-ltr:not(.' + timeDoneClass + ')').each(function() {
    var $this = $(this);
    var isoDate = $this.text();
    var then = moment(isoDate).valueOf();
    var now = Date.now();
    var durationLetter = debiki.prettyLetterDuration(then, now);
    $this.text(durationLetter);
    // Don't add any title tooltip [85YKW20]. That's better done by the React.js components
    // that knows what this date is about, so the tooltip can be e.g. "Last edited on <date>" or
    // "Created on <date>" rather than just the date.
    $this.addClass(timeDoneClass);
  });

  // & all exact timestamps (end with -exact).
  // Result: e.g. "Yesterday 12:59 am", or, if today, only "13:59".
  $(selector + ' .esTimeExact:not(.' + timeDoneClass + ')').each(function() {
    var $this = $(this);
    var isoDate = $this.text();
    var when = moment(isoDate);
    var includeDay = when.isBefore(moment().startOf('day'));
    // getTimezoneOffset() returns -60 (not +60) for UTC+1. Weird. So use subtract(..).
    //when = when.subtract((new Date()).getTimezoneOffset(), 'minutes'); -- Oops not needed.
    var dayHourMinute = includeDay ? when.calendar() : when.format('LT');
    $this.text(dayHourMinute);
    $this.addClass(timeDoneClass);
    // But don't add any title tooltip attr, see [85YKW20] above.
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
