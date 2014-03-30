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
    applyAuthorStyles: true,
    publishAs: 'cmp')
class ViewTopicsComponent extends ActiveTopicsFinder {

  DebikiAdminQueryService _queryService;

  @NgAttr('root-page-id')
  String rootPageId;

  @NgAttr('page-role')
  String pageRole;

  @NgAttr('title')
  String title = 'Topics';

  @NgOneWay('show-topic-titles')
  bool showTopicTitles = true;

  Map<String, Topic> allTopicsById = {};

  Map<String, Topic> selectedTopicsById = {};

  List<Topic> _selectedTopics;
  List<Topic> get selectedTopics => _selectedTopics;

  RouteProvider routeProvider;

  String urlOf(Topic topic) {
    if (topic.anyEmbeddingPageUrl != null)
      return topic.anyEmbeddingPageUrl;
    else
      return '$debikiServerOrigin/-${topic.id}';
  }

  ViewTopicsComponent(RouteProvider this.routeProvider,
      DebikiAdminQueryService this._queryService) {
    _queryService.getDebikiData().then((DebikiData debikiData) {
      allTopicsById = debikiData.topicsById;
      findActiveTopics(rootPageId, new TopicRole.fromString(pageRole));
      _selectedTopics = selectedTopicsById.values.toList();
    });
  }

}
