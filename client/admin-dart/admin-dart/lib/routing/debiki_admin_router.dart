library debiki_admin_routing;

import 'package:angular/angular.dart';

class DebikiAdminRouteInitializer implements RouteInitializer {


  init(Router router, ViewFactory view) {
    router.root
      ..addRoute(
          name: 'topics',
          path: '/topics',
          enter: view('view/topics.html'))
      ..addRoute(
          name: 'comments',
          path: '/comments',
          enter: view('view/comments.html'))
      ..addRoute(
          name: 'default',
          defaultRoute: true,
          enter: (_) =>
              router.go('comments', {}, replace: false));
  }

}
