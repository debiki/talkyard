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
/// <reference path="../../typedefs/jquery/jquery.d.ts" />
/// <reference path="../slim-bundle.d.ts" />
/// <reference path="../plain-old-javascript.d.ts" />

//------------------------------------------------------------------------------
   module debiki2.utils.PageUnloadAlerter {
//------------------------------------------------------------------------------

var d: any = { i: debiki.internal, u: debiki.v0.util };
var $: JQueryStatic = d.i.$;

var warningsByKey: any = {};


export function addReplaceWarning(key: string, message: string) {
  var sizeBefore = _.size(warningsByKey);
  warningsByKey[key] = message;
  var sizeAfter = _.size(warningsByKey);
  if (sizeAfter === 1 && sizeBefore === 0) {
    window.onbeforeunload = showUnloadWarning;
  }
}


export function wouldWarn(key: string): boolean {
  return !!warningsByKey[key];
}


export function removeWarning(key: string) {
  delete warningsByKey[key];
  if (_.isEmpty(warningsByKey)) {
    window.onbeforeunload = null;
  }
}


export var AlertIfLeavingRouteMixin = {
  contextTypes: {
    router: React.PropTypes.object
  },
  componentDidMount: function() {
    this.context.router.setRouteLeaveHook(this.props.route, showUnloadWarning);
  }
};


function showUnloadWarning(event: BeforeUnloadEvent) {
  var warningMessage = _.findLast(warningsByKey, () => true);
  if (!warningMessage)
    return true;

  // Dim the page, because otherwise the unload warning dialog is hard to notice.
  // Un-dim the page when the dialog closes — the setTimeout callback seems to fire when
  // the unload warning dialog closes, just what we need.
  var $overlay = $($.parseHTML('<div style="z-index:9999999;' +
    'position:fixed;top:0;bottom:0;left:0;right:0;background-color:#000;opacity:0.5;"></div>'));
  $overlay.appendTo('body');
  // No idea why, but unless $overlay.remove is wrapped in a function, it has no effect here
  // (not in Chrome 47.0.2526.106 at least).
  setTimeout(function() { $overlay.remove() }, 100);

  return warningMessage;
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
