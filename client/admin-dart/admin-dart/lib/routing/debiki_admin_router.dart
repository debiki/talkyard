library debiki_admin_routing;

import 'package:angular/angular.dart';

class DebikiAdminRouteInitializer implements RouteInitializer {


  init(Router router, ViewFactory view) {
    router.root
      ..addRoute(
          name: 'allRecentTopics',
          path: '/all-recent-topics',
          enter: view('view/site/all_recent_topics.html'))
      ..addRoute(
          name: 'allRecentComments',
          path: '/all-recent-comments',
          enter: view('view/site/all_recent_comments.html'))
      ..addRoute(
          name: 'siteWideSettings',
          path: '/site-wide-settings',
          enter: view('view/site/site_wide_settings.html'))
      ..addRoute(
          name: 'siteWideSpecialContent',
          path: '/site-wide-special-content',
          enter: view('view/site/site_wide_special_content.html'))
      ..addRoute(
          name: 'pages',
          path: '/pages/',
          mount: (Route route) => route
            ..addRoute(
                name: 'pagesList',
                path: 'list',
                enter: view('view/pages/pages_list.html'))
            ..addRoute(
                name: 'pagesComments',
                path: 'recent-comments',
                enter: view('view/pages/pages_recent_comments.html'))
            ..addRoute(
                name: 'pagesSettings',
                path: 'settings',
                enter: view('view/pages/pages_settings.html'))
            ..addRoute(
                name: 'pagesDashboard',
                path: '',
                enter: view('view/pages/pages_dashboard.html')))
      ..addRoute(
          name: 'blog',
          path: '/blog/:blogId/',
          mount: (Route route) => route
            ..addRoute(
                name: 'blogPosts',
                path: 'recent-posts',
                enter: view('view/blog/blog_recent_posts.html'))
            ..addRoute(
                name: 'blogComments',
                path: 'recent-comments',
                enter: view('view/blog/blog_recent_comments.html'))
            ..addRoute(
                name: 'blogSettings',
                path: 'settings',
                enter: view('view/blog/blog_settings.html'))
            ..addRoute(
                name: 'blogDashboard',
                path: '',
                enter: view('view/blog/blog_dashboard.html')))
      ..addRoute(
          name: 'forum',
          path: '/fourm/:forumId/',
          mount: (Route route) => route
            ..addRoute(
                name: 'forumTopics',
                path: 'recent-topics',
                enter: view('view/forum/forum_recent_topics.html'))
            ..addRoute(
                name: 'forumComments',
                path: 'recent-comments',
                enter: view('view/forum/forum_recent_comments.html'))
            ..addRoute(
                name: 'forumSettings',
                path: 'settings',
                enter: view('view/forum/forum_settings.html'))
            ..addRoute(
                name: 'forumSpecialContent',
                path: 'special-content',
                enter: view('view/forum/forum_special_content.html'))
            ..addRoute(
                name: 'forumDashboard',
                path: '',
                enter: view('view/forum/forum_dashboard.html')))
      ..addRoute(
          name: 'embeddedComments',
          path: '/embedded-comments/',
          mount: (Route route) => route
            ..addRoute(
                name: 'embeddedCommentsTopics',
                path: 'recent-topics',
                enter: view('view/embedded-comments/embedded_recent_topics.html'))
            ..addRoute(
                name: 'embeddedCommentsComments',
                path: 'recent-comments',
                enter: view('view/embedded-comments/embedded_recent_comments.html'))
            ..addRoute(
                name: 'embeddedCommentsSettings',
                path: 'settings',
                enter: view('view/embedded-comments/embedded_settings.html')))
      ..addRoute(
          name: 'mainDashboard',
          path: '/',
          enter: view('view/site/site_dashboard.html'))
      ..addRoute(
          name: 'default',
          defaultRoute: true,
          enter: (_) {
              router.go('mainDashboard', {}, replace: false);
          });
  }

}
