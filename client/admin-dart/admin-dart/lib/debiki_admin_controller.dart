library debiki_admin_controller;

import 'package:angular/angular.dart';

import 'package:debiki_admin/service/post.dart';
import 'package:debiki_admin/service/query_service.dart';
import 'package:debiki_admin/service/topic.dart';
import 'package:debiki_admin/service/user.dart';


@NgController(
    selector: '[debiki-admin]',
    publishAs: 'ctrl')
class DebikiAdminController {

  DebikiAdminQueryService _queryService;

  Map<String, Topic> _topicsById = {};
  get topicsById => _topicsById;
  get allTopics => _topicsById.values.toList();

  List<Topic> _forums = [];
  get forums => _forums;

  List<Topic> _blogs = [];
  get blogs => _blogs;

  List<Topic> _pages = [];
  get pages => _pages;

  List<Topic> _embeddedTopics = [];
  get embeddedTopics => _embeddedTopics;

  List<Post> _recentPosts = new List();
  get recentPosts => _recentPosts;

  Map<String, User> _recentUsersById = {};
  get recentUsersById => _recentUsersById;
  get recentUsers => _recentUsersById.values.toList();

  DebikiAdminController(DebikiAdminQueryService this._queryService) {
    _loadData();
  }

  void _loadData() {
    _queryService.getAllTopics().then((Map<String, Topic> topicsById) {
      this._topicsById = topicsById;
      _findContentSections(topicsById.values);
    });
    _queryService.getRecentPosts().then((List<Post> posts) {
      this._recentPosts = posts;
    });
    _queryService.getRecentUsersById().then((Map<String, User> usersById) {
      this._recentUsersById = usersById;
    });
  }

  /**
   * Finds all forums, blogs, pages and embedded discussions.
   */
  void _findContentSections(Iterable<Topic> topics) {
    for (Topic topic in topics) {
      if (topic.role == TopicRole.Generic) {
        _pages.add(topic);
        continue;
      }

      if (topic.anyParentPageId != null)
        continue;

      if (topic.role == TopicRole.ForumGroup || topic.role == TopicRole.Forum) {
        _forums.add(topic);
      }
      else if (topic.role == TopicRole.Blog) {
        _blogs.add(topic);
      }
      else if (topic.role == TopicRole.EmbeddedComments) {
        _embeddedTopics.add(topic);
      }
    }
  }

  /**
   * Returns the number of different content sections, e.g. 1 if this site contains
   * only forums, but 2 if it contains both blogs and forums.
   */
  int get numDistinctContentSections {
    var num = 0;
    if (_forums.length > 0) num += 1;
    if (_blogs.length > 0) num += 1;
    if (_pages.length > 0) num += 1;
    if (_embeddedTopics.length > 0) num += 1;
    return num;
  }

}

