library debiki_admin_controller;

import 'package:angular/angular.dart';

import 'package:debiki_admin/service/debiki_data.dart';
import 'package:debiki_admin/service/query_service.dart';
import 'package:debiki_admin/service/topic.dart';


@NgController(
    selector: '[debiki-admin]',
    publishAs: 'adminCtrl')
class DebikiAdminController {

  DebikiAdminQueryService _queryService;

  DebikiData _debikiData = new DebikiData();

  Map<String, Topic> get topicsById => _debikiData.topicsById;
  List<Topic> get allTopics => topicsById.values.toList();

  List<Topic> _forums = [];
  List<Topic> get forums => _forums;

  List<Topic> _blogs = [];
  get blogs => _blogs;

  List<Topic> _pages = [];
  get pages => _pages;

  List<Topic> _embeddedTopics = [];
  get embeddedTopics => _embeddedTopics;

  get recentPosts => _debikiData.recentPosts;

  get recentUsersById => _debikiData.usersById;
  get recentUsers => _debikiData.usersById.values.toList();

  DebikiAdminController(DebikiAdminQueryService this._queryService) {
    _loadData();
  }

  void _loadData() {
    _queryService.getDebikiData().then((DebikiData debikiData) {
      this._debikiData = debikiData;
      _findContentSections(topicsById.values);
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

      if (topic.role == TopicRole.Code) {
        // For now, ignore it. Which means _site.conf is ignored right now, fine.
        // _codePages.add(topic);
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

