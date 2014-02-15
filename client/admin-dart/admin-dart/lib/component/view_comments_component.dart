library view_comments_component;

import 'package:angular/angular.dart';

import '../service/post.dart';
import '../service/topic.dart';
import '../service/user.dart';
import '../util.dart';


@NgComponent(
    selector: 'view-comments',
    templateUrl: 'packages/debiki_admin/component/view_comments_component.html',
    publishAs: 'cmp')
class ViewCommentsComponent {

  Scope _scope;
  RouteProvider _routeProvider;

  @NgOneWay('recent-posts')
  List<Post> recentPosts = [];

  @NgOneWay('recent-users')
  Map<String, User> recentUsersById = {};

  List<Post> _selectedRecentPosts = [];
  List<Post> get selectedRecentPosts => _selectedRecentPosts;

  @NgOneWay('topics-by-id')
  Map<String, Topic> allTopicsById = {};

  Map<String, Topic> _selectedTopicsById = new Map<String, Topic>();
  List<Topic> get selectedTopics => _selectedTopicsById.values.toList();

  ViewCommentsComponent(Scope this._scope, RouteProvider this._routeProvider) {
    _scope.$watchCollection('recentPosts', (newValue, oldValue) {
      _findActiveTopics();
    });
  }

  void approve(Post post) {

  }

  void reject(Post post) {

  }

  void delete(Post post) {

  }

  /**
   * Finds out which posts to show, depending on the current route,
   *
   * First finds topic ids for all topics for which comments are to be shown.
   * For example, if we're in the /forum/:forumId/recent-comments view,
   * it'll find all topics in :forumId and insert them into _selectedTopicsById.
   *
   * And then filters away all comments that don't belong to one of
   * the _selectedTopicsById.
   */
  void _findActiveTopics() {
    var anyBaseTopicId = null;
    var anyPageRole = null;
    if (_routeProvider.routeName == 'allRecentComments') {
      // Leave anyBaseTopicId and anyPageRole = null, so we'll show all recent posts.
    }
    else if (_routeProvider.routeName == 'pagesComments') {
      anyPageRole = TopicRole.Generic;
    }
    else if (_routeProvider.routeName == 'blogComments') {
      anyBaseTopicId = _routeProvider.parameters['blogId'];
    }
    else if (_routeProvider.routeName == 'forumComments') {
      anyBaseTopicId = _routeProvider.parameters['forumId'];
    }
    else {
      error('Bad route name: "${_routeProvider.routeName}" [DwE97FE3]');
    }

    print('Showing comments for base topic id: $anyBaseTopicId, page role: $anyPageRole');

    _selectedTopicsById = new Map<String, Topic>();

    for (Topic topic in allTopicsById.values) {
      if (anyPageRole == null && anyBaseTopicId == null) {
        // Include all topics.
        _selectedTopicsById[topic.id] = topic;
      }
      else if (topic.role == anyPageRole) {
        _selectedTopicsById[topic.id] = topic;
      }
      else {
        // If `anyBaseTopicId` is an ancestor page, we are to include `topic`,
        // so check all ancestors.
        Topic curTopic = topic;
        do {
          if (curTopic.id == anyBaseTopicId) {
            _selectedTopicsById[topic.id] = topic;
            break;
          }
          curTopic = allTopicsById[curTopic.anyParentPageId];
        }
        while (curTopic != null);
      }
    }

    print('Active topics ids: ${_selectedTopicsById.values.map((topic) => topic.id).toList()}');

    _selectedRecentPosts = [];
    for (Post post in recentPosts) {
      if (_selectedTopicsById[post.pageId] != null) {
        _selectedRecentPosts.add(post);
      }
    }
  }
}
