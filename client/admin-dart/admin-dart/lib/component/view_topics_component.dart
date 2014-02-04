library view_recipe_component;

import 'package:angular/angular.dart';

import '../service/topic.dart';


@NgComponent(
    selector: 'view-topics',
    templateUrl: 'packages/debiki_admin/component/view_topics_component.html',
    publishAs: 'ctrl')
class ViewTopicsComponent {

  @NgOneWay('all-topics')
  List<Topic> allTopics;

  ViewTopicsComponent(RouteProvider routeProvider) {
  }

}
