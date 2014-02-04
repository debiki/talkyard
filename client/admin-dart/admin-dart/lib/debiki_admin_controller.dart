library debiki_admin_controller;

import 'package:angular/angular.dart';

import 'package:debiki_admin/service/query_service.dart';
import 'package:debiki_admin/service/topic.dart';
import 'package:debiki_admin/service/post.dart';


@NgController(
    selector: '[debiki-admin]',
    publishAs: 'ctrl')
class DebikiAdminController {

  DebikiAdminQueryService _queryService;

  Map<String, Topic> _topicsById = {};
  get allTopics => _topicsById.values.toList();

  List<Post> _recentPosts = new List();
  get recentPosts => _recentPosts;

  DebikiAdminController(DebikiAdminQueryService this._queryService) {
    _loadData();
  }

  void _loadData() {
    _queryService.getAllTopics().then((Map<String, Topic> topicsById) {
      this._topicsById = topicsById;
    });
    _queryService.getRecentPosts().then((List<Post> posts) {
      this._recentPosts = posts;
    });
  }

}

