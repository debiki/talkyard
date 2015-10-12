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

var BodyId = 1;

enum PinPageWhere {
  InCategory = 1,
  Globally = 3,
}


enum PageRole {
  HomePage = 1,
  WebPage = 2,  // rename to Info?
  Code = 3,
  SpecialContent = 4,
  EmbeddedComments = 5,
  Blog = 6,
  Forum = 7,
  About = 9,
  Question = 10,
  Problem = 14,
  Idea = 15,
  ToDo = 13,
  MindMap = 11,
  Discussion = 12,
  Critique = 16, // [plugin]
}


enum PostType {
  Normal = 1,
  Flat = 2,
  StaffWiki = 11,
  CommunityWiki = 12,
}

