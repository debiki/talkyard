library debiki_data;

import 'post.dart';
import 'topic.dart';
import 'user.dart';


class DebikiData {

  Map<String, Topic> _topicsById = {};
  get topicsById => _topicsById;

  List<Post> _recentPosts = [];
  get recentPosts => _recentPosts;

  Map<String, User> _usersById = {};
  get usersById => _usersById;

}
