library debiki_admin_query_service;

import 'dart:async';
import 'dart:convert';
import 'dart:html';
import 'package:angular/angular.dart';

import 'debiki_data.dart';
import 'post.dart';
import 'topic.dart';
import 'user.dart';


class DebikiAdminQueryService {

  String _realOrigin = window.location.origin;

  /** Makes DartEditor connect to Play Framework on port 9000, when developing. */
  String get _origin => _realOrigin.replaceAll('localhost:3030', 'localhost:9000');

  String get _recentPostsUrl => '$_origin/?list-actions.json';
  String get _pagesUrl => '$_origin/-/list-pages?in-tree';
  String get _approvePostUrl => '$_origin/-/approve';
  String get _rejectPostUrl => '$_origin/-/reject';
  String get _deletePostUrl => '$_origin/-/delete';

  Future _loaded;

  bool _dataLoaded = false;
  DebikiData _debikiData = new DebikiData();

  Http _http;

  DebikiAdminQueryService(Http this._http) {
    _loaded = Future.wait([_loadTopics(), _loadRecentPosts()]);
  }

  Future _loadTopics() {
    return _http.get(_pagesUrl)
      .then((HttpResponse response) {
        for (Map pageJsonMap in response.data["pages"]) {
          Topic topic = new Topic.fromJsonMap(_debikiData, pageJsonMap);
          _debikiData.topicsById[topic.id] = topic;
        }
      });
  }

  Future _loadRecentPosts() {
    // Need to specicy `withCredentials` so auth cookies included in CORS request. However,
    // `withCredentials: true` can only be set with deprecated `request(..)` Http function,
    // so for now:
    return _http.request(_recentPostsUrl, withCredentials: true) // .get(_recentPostsUrl)
      .then((HttpResponse response) {
        // `data` is a String here, but a json Map in _loadTopics, perhaps the reason is
        // that I have to use `request` here not `get`?
        // Also remove leading ")]}',\n", 6 chars.
        Map json = JSON.decode(response.data.substring(6));
        for (Map postsJsonMap in json["actions"]) { // response.data["actions"]) {
          Post post = new Post.fromJsonMap(_debikiData, postsJsonMap);
          _debikiData.recentPosts.add(post);
        }
        for (Map userJsonMap in json["users"]) {
          User user = new User.fromJsonMap(_debikiData, userJsonMap);
          _debikiData.usersById[user.id] = user;
        }
      });
  }

  Future<DebikiData> getDebikiData() {
    if (!_dataLoaded) {
      return _loaded.then((_) {
        _dataLoaded = true;
        return _debikiData;
      });
    }
    return new Future.value(_debikiData);
  }

  Future approvePost(Post post) {
    return _http.request(
        _approvePostUrl, withCredentials: true, method: 'POST',
        requestHeaders: {
          'Content-Type': 'application/json',
          'X-XSRF-TOKEN': 'CorsFromDartEditor'
        },
        sendData: _postToJson(post));
  }

  Future rejectPost(Post post) {
    /*
  api.reject = !(actions, onSuccess) ->
    $http.post '/-/reject', actionsToJsonObjs(actions)
        .success onSuccess
     */
    return null;
  }

  Future deletePost(Post post) {
    return null;
  }

  String _postToJson(Post post) {
    return '[{ "pageId": "${post.pageId}", "actionId": "${post.id}" }]';
  }

}
