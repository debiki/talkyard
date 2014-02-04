library debiki_admin_controller;

import 'package:angular/angular.dart';

import 'package:debiki_admin/service/query_service.dart';
import 'package:debiki_admin/service/topic.dart';


@NgController(
    selector: '[debiki-admin]',
    publishAs: 'ctrl')
class DebikiAdminController {

  DebikiAdminQueryService _queryService;

  Map<String, Topic> _topicsById = {};
  get allTopics => _topicsById.values.toList();

  DebikiAdminController(DebikiAdminQueryService this._queryService) {
    _loadData();
  }

  void _loadData() {
    _queryService.getAllTopics().then((Map<String, Topic> topicsById) {
      this._topicsById = topicsById;
    });
  }

}

