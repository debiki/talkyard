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

//------------------------------------------------------------------------------
   module forum {
//------------------------------------------------------------------------------


export class Category {

  pageId: string;
  name: string;
  slug: string;
  recentTopics: Topic[] = [];


  constructor(private forumData: ForumData) {
  }


  public static fromJson(forumData: ForumData, json): Category {
    var c = new Category(forumData);
    c.pageId = json.pageId;
    c.name = json.name;
    c.slug = json.slug;
    for (var i = 0; i < (json.recentTopics || []).length; ++i) {
      var topicJson = json.recentTopics[i];
      var topic = Topic.fromJson(forumData, topicJson);
      c.recentTopics.push(topic);
    }
    return c;
  }

  // ?? which one of: ??
  // anyParentCategoryId: string;
  // subCategories: Category[];
  // subCategoryIds: string[];
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: et ts=2 sw=2 tw=0 fo=tcqwn list
