library view_topics_component;

import 'package:angular/angular.dart';

import 'package:debiki_admin/service/debiki_data.dart';
import 'package:debiki_admin/service/query_service.dart';
import '../routing/active_topics_finder.dart';
import '../service/topic.dart';
import '../util.dart';


@NgComponent(
    selector: 'view-topics',
    templateUrl: 'packages/debiki_admin/component/view_topics_component.html',
    publishAs: 'cmp')
class ViewTopicsComponent extends ActiveTopicsFinder {

  DebikiAdminQueryService _queryService;

  Map<String, Topic> allTopicsById = {};

  Map<String, Topic> selectedTopicsById = {};

  List<Topic> get selectedTopics => selectedTopicsById.values.toList();

  RouteProvider routeProvider;

  String urlOf(Topic topic) => '$debikiServerOrigin/-${topic.id}';

  ViewTopicsComponent(RouteProvider this.routeProvider,
      DebikiAdminQueryService this._queryService) {
    _queryService.getDebikiData().then((DebikiData debikiData) {
      allTopicsById = debikiData.topicsById;
      findActiveTopics();
    });
  }

}
