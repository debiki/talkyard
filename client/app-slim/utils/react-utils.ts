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

/// <reference path="../prelude.ts" />
/// <reference path="utils.ts" />

//------------------------------------------------------------------------------
   namespace debiki2 {
//------------------------------------------------------------------------------


export function createComponent(componentDefinition): any { // oops should obviously be named createFactory
  if (isServerSide()) {
    // The mere presence of these functions cause an unknown error when rendering
    // React-Router server side. So remove them; they're never called server side anyway.
    // The error logs the message '{}' to console.error(); no idea what that means.
    delete componentDefinition.UNSAFE_componentWillUpdate;
    delete componentDefinition.UNSAFE_componentWillReceiveProps;
  }
  return reactCreateFactory(createReactClass(componentDefinition));
}


export function createClassAndFactory(componentDefinition) { // rename createComponent to this NO... CLEAN_UP
  return createComponent(componentDefinition);
}


// ... let's name it "createFactory" only
export function createFactory<P, S>(compSpec: React.ComponentSpec<P, S>)
    : React.Factory<any> {
  return createComponent(compSpec);
}


export function whenMsToIsoDate(whenMs: WhenMs): string {
  return new Date(whenMs).toISOString().replace(/T/, ' ')
}

/**
 * Wraps the ISO8601 in a <span class="dw-ago"> so jQuery can find it and replace
 * the fixed ISO date with something like "5 hours ago" — see processTimeAgo
 * just below.  The server inculdes only ISO dates, not "x time ago", in its HTML,
 * so that it can be cached.
 *
 * CLEAN_UP: Nowadays, jQuery is gone.
 */
export function timeAgo(whenMs: Nr, clazz?: St, append?: St) {
  const isoDate = whenMsToIsoDate(whenMs);
  return r.span({ className: 'dw-ago ' + (clazz || '') }, isoDate, append);
}

/**
 * Like timeAgo(isoDate) but results in just "5h" instead of "5 hours ago".
 * That is, uses only one single letter, instead of many words.
 *
 * CLEAN_UP: For whatever reason, this fn is nowadays the same as timeAgo()
 * just above, minus the '-ltr' CSS class suffix.
 */
export function prettyLetterTimeAgo(whenMs: Nr, clazz?: St, append?: St) {
  const isoDate = whenMsToIsoDate(whenMs);
  return r.span({ className: 'dw-ago-ltr ' + (clazz || '') }, isoDate, append);
}

export function timeExact(whenMs: Nr, clazz?: St, append?: St) {
  return timeAgo(whenMs, clazz, append); /*
  // This no longer works, because moment.js was moved to more-bundle.js, so    [E5F29V]
  // cannot convert to e.g. "Yesterday 05:30 PM". Instead, show "4 hours ago" or sth like that.
  var isoDate = whenMsToIsoDate(whenMs);
  return r.span({ className: 'esTimeExact ' + (clazz || '') }, isoDate);
  */
}


/**
 * Replaces ISO8601 timestamps with "5 hours ago" or just "5h".
 *
 * Before when I was using moment.js: (no longer do, it's rather large)
 * Takes 25-30ms for 80 unprocessed comments on my computer, and 2ms for 160
 * that have been processed already.
 */
// COULD move to page/hacks.ts
export function processTimeAgo(selector?: string) {
  // COULD_OPTIMIZE seems is called twice? but once should be enough.

  selector = selector || '';
  const timeDoneClass = 'esTimeDone';
  const now = Date.now();

  // First handle all long version timestamps (don't end with -ltr ("letter")).
  // Result: e.g. "5 hours ago"
  const elemsLongAgoText = $all(selector + ' .dw-ago:not(.' + timeDoneClass + ')');
  _.each(elemsLongAgoText, function(elem: HTMLElement) {
    const isoDate = elem.textContent;
    const then = debiki2['isoDateStringToMillis'](isoDate); // typescript compilation error without []
    const timeAgoString = debiki.prettyDuration(then, now);
    elem.textContent = timeAgoString;
    $h.addClasses(elem, timeDoneClass);
    // But don't add any title tooltip attr, see [85YKW20] above.
  });

  // Then handle all one-letter timestamps (end with -ltr ("letter")).
  // Result: e.g. "5h" (instead of "5 hours ago").
   const elemsLetter = $all(selector + ' .dw-ago-ltr:not(.' + timeDoneClass + ')');
  _.each(elemsLetter, function(elem: HTMLElement) {
    const isoDate = elem.textContent;
    const then = debiki2['isoDateStringToMillis'](isoDate); // typescript compilation error without []
    const durationLetter = debiki.prettyLetterDuration(then, now);
    elem.textContent = durationLetter;
    // Don't add any title tooltip [85YKW20]. That's better done by the React.js components
    // that knows what this date is about, so the tooltip can be e.g. "Last edited on <date>" or
    // "Created on <date>" rather than just the date.
    $h.addClasses(elem, timeDoneClass);
  });

  // This no longer works, here in slim-bundle.js, because moment.js moved to more-bundle.js [E5F29V]
  // & all exact timestamps (end with -exact).
  // Result: e.g. "Yesterday 12:59 am", or, if today, only "13:59".
  /*
  $(selector + ' .esTimeExact:not(.' + timeDoneClass + ')').each(function() {
    var $this = $(this);
    var isoDate = $this.text();
    var m = moment(isoDate);  // or exclude Moment from default JS bundle? [6KFW02]
    var whenText;
    if (m.year() !== debiki.currentYear) {
      whenText = m.format('ll'); // e.g. "Sep 4 2015"
    }
    else if (m.isBefore(moment().startOf('day'))) {
      whenText = m.format('MMM D'); // e.g. "Sep 4"  (MMMM = September, not Sep)
    }
    else {
      whenText = m.format('LT');  // e.g. 8:30 PM
    }
    // getTimezoneOffset() returns -60 (not +60) for UTC+1. Weird. So use subtract(..).
    //m = m.subtract((new Date()).getTimezoneOffset(), 'minutes'); -- Oops not needed.
    $this.text(whenText);
    $this.addClass(timeDoneClass);
    // But don't add any title tooltip attr, see [85YKW20] above.
  });
  */
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
   namespace debiki2.utils {
//------------------------------------------------------------------------------

// Websearch for "react hooks dialog"
// Also see:
// https://codesandbox.io/s/7kxj9p9qm0?from-embed=&file=/src/Dialog/index.js
//
export function makeMountNode(): HTMLElement {  // [use_portal] instead?
  const elem = Bliss.create('div');
  document.body.appendChild(elem);
  return elem;
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
