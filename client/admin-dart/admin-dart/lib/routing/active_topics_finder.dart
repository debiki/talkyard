library active_topics_finder;

import '../service/topic.dart';


/**
 * Finds out which pages to show, depending on the specified root page,
 * or page role: all pages below the specified root page are shown,
 * or all pages with the specified role. For example, the root page
 * could be a forum page id, and then all topics in the forum will be shown.
 * Or the role could be 'EmbeddedComments' and then all embedded comments
 * pages will be shown.
 */
abstract class ActiveTopicsFinder {

  Map<String, Topic> get allTopicsById;

  Map<String, Topic> get selectedTopicsById;


  void findActiveTopics(String anyBaseTopicId, TopicRole anyPageRole) {
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
