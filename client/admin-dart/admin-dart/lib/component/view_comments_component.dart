library view_comments_component;

import 'dart:async';
import 'package:angular/angular.dart';

import '../routing/active_topics_finder.dart';
import '../service/post.dart';
import '../service/query_service.dart';
import '../service/topic.dart';
import '../service/user.dart';


@NgComponent(
    selector: 'view-comments',
    templateUrl: 'packages/debiki_admin/component/view_comments_component.html',
    cssUrl: 'packages/debiki_admin/component/view_comments_component.css',
    publishAs: 'cmp')
class ViewCommentsComponent extends ActiveTopicsFinder {

  DebikiAdminQueryService _queryService;

  Scope _scope;
  RouteProvider routeProvider;

  @NgOneWay('recent-posts')
  List<Post> recentPosts = [];

  @NgOneWay('recent-users')
  Map<String, User> recentUsersById = {};

  List<Post> _selectedRecentPosts = [];
  List<Post> get selectedRecentPosts => _selectedRecentPosts;

  @NgOneWay('topics-by-id')
  Map<String, Topic> allTopicsById = {};

  Map<String, Topic> selectedTopicsById = new Map<String, Topic>();
  List<Topic> get selectedTopics => selectedTopicsById.values.toList();

  ViewCommentsComponent(Scope this._scope, RouteProvider this.routeProvider,
      DebikiAdminQueryService this._queryService) {
    _scope.$watchCollection('recentPosts', (newValue, oldValue) {
      findActiveTopics();
      // Filter away all comments that don't belong to one of the _selectedTopicsById.
      _selectedRecentPosts.clear();
      for (Post post in recentPosts) {
        if (selectedTopicsById[post.pageId] != null) {
          _selectedRecentPosts.add(post);
        }
      }
    });
  }

  void approve(Post post) {
    _doInlineAction(_queryService.approvePost, post, 'Approved.');
  }

  void reject(Post post) {
    _doInlineAction(_queryService.rejectPost, post, 'Rejected.');
  }

  void delete(Post post) {
    _doInlineAction(_queryService.deletePost, post, 'Deleted.');
  }

  void _doInlineAction(Future queryServiceFn(Post), Post post, String doneMessage) {
    post.approveBtnText = '';
    post.hideRejectBtn = true;
    post.hideViewSuggsLink = true;
    post.inlineMessage = 'Wait...';
    queryServiceFn(post).then((_) {
      post.inlineMessage = doneMessage;
    });
  }

}
