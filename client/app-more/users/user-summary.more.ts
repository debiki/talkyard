/**
 * Copyright (C) 2017 Kaj Magnus Lindberg
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

/// <reference path="../more-prelude.more.ts" />
/// <reference path="../../../node_modules/moment/moment.d.ts" />
declare var moment: any;  // ??? moment.d.ts doesn't work in this file, weird.

//------------------------------------------------------------------------------
   namespace debiki2.users {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;


export const UserSummary = createFactory({
  displayName: 'UserSummary',

  render: function() {
    const stats: UserStats = this.props.stats;
    if (!stats)
      return r.p({}, "This user's statistics is not publicly visible.");

    function mkStat(val: Nr | NU, text: St | RElm, isDuration?: Bo): RElm | N {
      if (!isVal(val)) return null;
      const valStr = isDuration ? moment.duration({ seconds: val }).humanize() : val;
      return r.li({ className: 's_UP_Stats_Stat' }, valStr, text);
    }

    return (
     r.div({ className: 's_UP_Act_Stats' },
       r.h2({}, "Statistics"),
       r.ul({},
         mkStat(stats.numDaysVisited, " days visited"),
         mkStat(stats.numSecondsReading, " spent reading", true),
         mkStat(userStats_totalNumPostsRead(stats), " posts read"),
         mkStat(stats.numLikesGiven, " likes given"),
         mkStat(stats.numLikesReceived, " likes received"),
         mkStat(stats.numChatTopicsCreated + stats.numDiscourseTopicsCreated, " topics created"),
         mkStat(stats.numDiscourseRepliesPosted, " replies posted"),
         mkStat(stats.numChatMessagesPosted, " chat messages posted"),
         !stats.numSolutionsProvided ? null : mkStat(
              stats.numSolutionsProvided,
              rFr({}, " solutions ", r.span({ className: 'icon-ok-circled' }))))));
  }
});




//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
