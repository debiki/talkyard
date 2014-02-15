library active_topics_finder;

import 'package:angular/angular.dart';

import '../service/topic.dart';
import '../util.dart';


/**
 * Finds out which topics to show, depending on the current route,
 *
 * Finds topic ids for all topics for which comments are to be shown.
 * For example, if we're in the /forum/:forumId/recent-comments view,
 * it'll find all topics in :forumId and insert them into _selectedTopicsById.
 */
abstract class ActiveTopicsFinder {

  Map<String, Topic> get allTopicsById;

  Map<String, Topic> get selectedTopicsById;

  RouteProvider get routeProvider;

  void findActiveTopics() {
    var anyBaseTopicId = null;
    var anyPageRole = null;
    if (routeProvider.routeName.contains('all')) {
      // Leave anyBaseTopicId and anyPageRole = null, so we'll show all
      // topics or all recent posts, whatever.
    }
    else if (routeProvider.routeName.contains('pages')) {
      anyPageRole = TopicRole.Generic;
    }
    else if (routeProvider.routeName.contains('blog')) {
      anyBaseTopicId = routeProvider.parameters['blogId'];
    }
    else if (routeProvider.routeName.contains('forum')) {
      anyBaseTopicId = routeProvider.parameters['forumId'];
    }
    else {
      error('Bad route name: "${routeProvider.routeName}" [DwE97FE3]');
    }

    print('Showing comments for base topic id: $anyBaseTopicId, page role: $anyPageRole');

    selectedTopicsById.clear();

    for (Topic topic in allTopicsById.values) {
      if (anyPageRole == null && anyBaseTopicId == null) {
        // Include all topics.
        selectedTopicsById[topic.id] = topic;
      }
      else if (topic.role == anyPageRole) {
        selectedTopicsById[topic.id] = topic;
      }
      else {
        // If `anyBaseTopicId` is an ancestor page, we are to include `topic`,
        // so check all ancestors.
        Topic curTopic = topic;
        do {
          if (curTopic.id == anyBaseTopicId) {
            selectedTopicsById[topic.id] = topic;
            break;
          }
          curTopic = allTopicsById[curTopic.anyParentPageId];
        }
        while (curTopic != null);
      }
    }

    print('Active topics ids: ${selectedTopicsById.values.map((topic) => topic.id).toList()}');
  }
}
