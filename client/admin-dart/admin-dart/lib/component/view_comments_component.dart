library view_comments_component;

import 'dart:async';
import 'package:angular/angular.dart';

import 'package:debiki_admin/service/debiki_data.dart';
import 'package:debiki_admin/service/query_service.dart';
import '../routing/active_topics_finder.dart';
import '../service/post.dart';
import '../service/topic.dart';
import '../service/user.dart';


@NgComponent(
    selector: 'view-comments',
    templateUrl: 'packages/debiki_admin/component/view_comments_component.html',
    cssUrl: 'packages/debiki_admin/component/view_comments_component.css',
    applyAuthorStyles: true,
    publishAs: 'cmp')
class ViewCommentsComponent extends ActiveTopicsFinder {

  DebikiAdminQueryService _queryService;

  @NgAttr('root-page-id')
  String rootPageId;

  @NgAttr('page-role')
  String pageRole;

  Scope _scope;
  RouteProvider routeProvider;

  List<Post> _recentPosts = [];
  Map<String, User> _recentUsersById = {};

  List<Post> _selectedRecentPosts = [];
  List<Post> get selectedRecentPosts => _selectedRecentPosts;

  Map<String, Topic> allTopicsById = null;

  Map<String, Topic> selectedTopicsById = new Map<String, Topic>();
  List<Topic> get selectedTopics => selectedTopicsById.values.toList();

  ViewCommentsComponent(Scope this._scope, RouteProvider this.routeProvider,
      DebikiAdminQueryService this._queryService) {
    _queryService.getDebikiData().then((DebikiData debikiData) {
      allTopicsById = debikiData.topicsById;
      _recentUsersById = debikiData.usersById;
      _recentPosts = debikiData.recentPosts;
      findActiveTopics(rootPageId, new TopicRole.fromString(pageRole));
      // Filter away all comments that don't belong to one of the _selectedTopicsById.
      _selectedRecentPosts.clear();
      for (Post post in _recentPosts) {
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
