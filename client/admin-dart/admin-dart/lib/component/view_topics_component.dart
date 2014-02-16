library view_topics_component;

import 'package:angular/angular.dart';

import '../routing/active_topics_finder.dart';
import '../service/topic.dart';
import '../util.dart';


@NgComponent(
    selector: 'view-topics',
    templateUrl: 'packages/debiki_admin/component/view_topics_component.html',
    publishAs: 'cmp')
class ViewTopicsComponent extends ActiveTopicsFinder {

  @NgOneWay('topics-by-id')
  Map<String, Topic> allTopicsById = {};

  Map<String, Topic> selectedTopicsById = {};

  List<Topic> get selectedTopics => selectedTopicsById.values.toList();

  RouteProvider routeProvider;

  String urlOf(Topic topic) => '$debikiServerOrigin/-${topic.id}';

  ViewTopicsComponent(Scope scope, RouteProvider this.routeProvider) {
    scope.$watchCollection('allTopicsById', (newValue, oldValue) {
      findActiveTopics();
    });
  }

}
