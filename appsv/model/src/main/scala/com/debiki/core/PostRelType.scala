/**
 * Copyright (c) 2022 Kaj Magnus Lindberg
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
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

package com.debiki.core


/** Later:  Links form post and whatever, e.g. a post is a SolutionTo a question,
 * or a post is a FlagOf another post.
 * Will be stored in a new table  post_rels_t.
 *
 * (This corresponds to edges in a graph database, from nodes of type Post.)
 */
sealed abstract class PostRelType_later(val IntVal: i32) { def toInt: i32 = IntVal }


object PostRelType_later {

  /** Higher value: 2, could mean primary answer? l means other answer that would work too?
    * Because there can be different ways to do something: More than one correct answer,
    * or more than one way to permanently power off a computer.
    */
  case object SolutionTo extends PostRelType_later(-1)

  /** Value could mean: 1 = just show small link to the reply, 2 = show excerpt of the reply,
    * 3 = show the whole reply below the multireplied-to comment.
    */
  case object MultireplyTo extends PostRelType_later(-1)

  /** Could be a bookmark post that links to a category or page or tag?
   * The text in the post works as link title; there's no {{{ <a href=...>}}}
   * in the post text itself.
   */
  case object LinkTo extends PostRelType_later(-1)

  /** Flags will be stored in the Posts table — they'll include optional text with details,
   * under revision control, so they might as well be posts and pages of type PostType.Flag
   * and PageType.Flag?  [flags_as_posts]
   */
  case object FlagOf extends PostRelType_later(-1)
}
