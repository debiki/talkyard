library view_comments_component;

import 'package:angular/angular.dart';

import '../service/post.dart';


@NgComponent(
    selector: 'view-comments',
    templateUrl: 'packages/debiki_admin/component/view_comments_component.html',
    publishAs: 'ctrl')
class ViewCommentsComponent {

  @NgOneWay('recent-posts')
  List<Post> recentPosts;

  ViewCommentsComponent(RouteProvider routeProvider) {
  }

}
