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

/// <reference path="prelude.ts" />


/* This file is available in both server and client side JS.
 * The server's API needs to be available server side too so that
 * React components can construct <a href=...> links, e.g. to load more
 * forum topics, when React runs server side.
 */
//------------------------------------------------------------------------------
   module debiki2.ServerApi {
//------------------------------------------------------------------------------


export function makeForumTopicsQueryParams(orderOffset: OrderOffset): string {
  let params = '';
  if (orderOffset.sortOrder === TopicSortOrder.BumpTime) {
    params += 'sortOrder=ByBumpTime';
  }
  else if (orderOffset.sortOrder === TopicSortOrder.CreatedAt) {
    params += 'sortOrder=ByCreatedAt';
  }
  else if (orderOffset.sortOrder === TopicSortOrder.ScoreAndBumpTime) {
    params += 'sortOrder=ByScore';
    params += '&period=' + orderOffset.period;
    if (_.isNumber(orderOffset.score)) {
      params += '&maxScore=' + orderOffset.score;
    }
    if (_.isNumber(orderOffset.scoreAlg)) {
      params += '&scoreAlg=' + orderOffset.scoreAlg;
    }
  }

  if (orderOffset.olderThan) {
    params += '&olderThan=' + orderOffset.olderThan;
  }

  /* Perhaps add back sort-by-likes later?
  else if (orderOffset.sortOrder === TopicSortOrder.LikesAndBumpTime) {
    params += 'sortOrder=ByLikes';
    if (_.isNumber(orderOffset.numLikes) && orderOffset.olderThan) {
      params += '&num=' + orderOffset.numLikes;
      params += '&olderThan=' + orderOffset.bumpedAt;
    }
  } */

  if (orderOffset.topicFilter) {
    params += '&filter=' + orderOffset.topicFilter;
  }
  return params;
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
