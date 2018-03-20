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

/// <reference path="../slim-bundle.d.ts" />

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

    return (
     r.div({ className: 's_UP_Stats' },
       r.h2({}, "Statistics"),
       r.ul({},
         r.li({ className: 's_UP_Stats_Stat' },
           stats.numDaysVisited + " days visited"),
         r.li({ className: 's_UP_Stats_Stat' },
           moment.duration({ seconds: stats.numSecondsReading }).humanize() + " spent reading"),
         r.li({ className: 's_UP_Stats_Stat' },
           userStats_totalNumPostsRead(stats) + " posts read"),
         r.li({ className: 's_UP_Stats_Stat' },
           stats.numLikesGiven + " likes given"),
         r.li({ className: 's_UP_Stats_Stat' },
           stats.numLikesReceived + " likes received"),
         r.li({ className: 's_UP_Stats_Stat' },
           (stats.numChatTopicsCreated + stats.numDiscourseTopicsCreated) + " topics created"),
         r.li({ className: 's_UP_Stats_Stat' },
           stats.numDiscourseRepliesPosted + " replies posted"),
         r.li({ className: 's_UP_Stats_Stat' },
           stats.numChatMessagesPosted + " chat messages posted"),
         !stats.numSolutionsProvided ? null : r.li({ className: 's_UP_Stats_Stat' },
           stats.numSolutionsProvided + " solutions ",
             r.span({ className: 'icon-ok-circled' })))));
  }
});




//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
