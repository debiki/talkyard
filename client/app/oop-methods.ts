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
/// <reference path="utils/utils.ts" />
/// <reference path="store-getters.ts" />
/// <reference path="../typedefs/lodash/lodash.d.ts" />


/* Object Oriented Programming methods, like so: className_methodName(instance, args...),
 * just like in C.
 *
 * Some classes/things have lots of methods and have been broken out to separate files,
 * e.g. store-methods.ts.
 */

//------------------------------------------------------------------------------
   module debiki2 {
//------------------------------------------------------------------------------


export function topic_lastActivityAtMs(topic: Topic): number {
   return topic.bumpedAtMs || topic.createdAtMs;
}


/** Returns < 0, or > 0, or === 0, if t should be listed before t2, after t2, or if same position.
  */
export function topic_sortOrderBasedOnLatestActivity(t: Topic, t2: Topic, categoryId: CategoryId)
      : number {
  if (t.pinWhere === PinPageWhere.Globally && t2.pinWhere === PinPageWhere.Globally) {
    if (t.pinOrder !== t2.pinOrder) {
      return t.pinOrder - t2.pinOrder; // lowest first
    }
  }
  else if (t.pinWhere === PinPageWhere.Globally) {
    return -1;
  }
  else if (t2.pinWhere === PinPageWhere.Globally) {
    return +1;
  }

  var pin1stInCategory = t.pinWhere === PinPageWhere.InCategory && t.categoryId === categoryId;
  var pin2ndInCategory = t2.pinWhere === PinPageWhere.InCategory && t2.categoryId === categoryId;
  if (pin1stInCategory && pin2ndInCategory) {
    if (t.pinOrder !== t2.pinOrder) {
      return t.pinOrder - t2.pinOrder; // lowest first
    }
  }
  else if (pin1stInCategory) {
    return -1;
  }
  else if (pin2ndInCategory) {
    return +1;
  }

  return topic_lastActivityAtMs(t2) - topic_lastActivityAtMs(t);
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
