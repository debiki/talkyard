/**
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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

/// <reference path="ForumApp.ts" />

//------------------------------------------------------------------------------
   module forum {
//------------------------------------------------------------------------------


export class QueryService {

  public loadTopics(categoryId: string): Topic[] {
    var t = new Topic();
    t.id = '123abc';
    t.title = 'Topic Title';
    t.url = '/nowhere';
    t.categoryId = '123abcCategoryId';
    t.subCategoryId = '123abcSubCategoryId';
    t.numPosts = 10;
    t.numLikes = 3;
    t.numWrongs = 1;
    t.firstPostAt = new Date(2014, 4, 3);
    t.lastPostAt = new Date(2014, 4, 7);
    var t2 = new Topic();
    t2.id = '567def';
    t2.title = 'Another Topic Title';
    t2.url = '/really-nowhere';
    t2.categoryId = '456defCategoryId';
    t2.subCategoryId = '456defSubCategoryId';
    t2.numPosts = 38;
    t2.numLikes = 9;
    t2.numWrongs = 4;
    t2.firstPostAt = new Date(2014, 2, 1);
    t2.lastPostAt = new Date(2014, 4, 9);
    return [t, t2];
  }

}


forum.forumApp.service('QueryService', QueryService);

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: et ts=2 sw=2 tw=0 fo=tcqwn list
