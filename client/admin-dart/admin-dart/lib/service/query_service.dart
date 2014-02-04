library debiki_admin_query_service;

import 'dart:async';
import 'package:angular/angular.dart';
import 'dart:convert';

import 'topic.dart';
import 'post.dart';


class DebikiAdminQueryService {

  String _recentPostsUrl = "http://localhost:9000/?list-actions.json";
  String _pagesUrl = 'http://localhost:9000/-/list-pages?in-tree';

  Future _loaded;

  Map<String, Topic> _topicsCache;
  List<Post> _recentPostsCache;

  Http _http;

  DebikiAdminQueryService(Http this._http) {
    _loaded = Future.wait([_loadTopics(), _loadRecentPosts()]);
  }

  Future _loadTopics() {
    return _http.get(_pagesUrl)
      .then((HttpResponse response) {
        _topicsCache = new Map();
        for (Map pageJsonMap in response.data["pages"]) {
          Topic topic = new Topic.fromJsonMap(pageJsonMap);
          _topicsCache[topic.id] = topic;
        }
      });
  }

  Future _loadRecentPosts() {
    // Need to specicy `withCredentials` so auth cookies included in CORS request. However,
    // `withCredentials: true` can only be set with deprecated `request(..)` Http function,
    // so for now:
    return _http.request(_recentPostsUrl, withCredentials: true) // .get(_recentPostsUrl)
      .then((HttpResponse response) {
        _recentPostsCache = new List();
        // `data` is a String here, but a json Map in _loadTopics, perhaps the reason is
        // that I have to use `request` here not `get`?
        // Also remove leading ")]}',\n", 6 chars.
        Map json = JSON.decode(response.data.substring(6));
        for (Map postsJsonMap in json["actions"]) { // response.data["actions"]) {
          Post post = new Post.fromJsonMap(postsJsonMap);
          _recentPostsCache.add(post);
        }
      });
  }

  Future<Map<String, Topic>> getAllTopics() {
    if (_topicsCache == null) {
      return _loaded.then((_) {
        return _topicsCache;
      });
    }
    return new Future.value(_topicsCache);
  }

  Future<List<Post>> getRecentPosts() {
    if (_recentPostsCache == null) {
      return _loaded.then((_) {
        return _recentPostsCache;
      });
    }
    return new Future.value(_recentPostsCache);
  }
}
