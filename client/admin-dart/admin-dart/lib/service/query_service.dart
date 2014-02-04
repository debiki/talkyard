library debiki_admin_query_service;

import 'dart:async';
import 'package:angular/angular.dart';

import 'topic.dart';


class DebikiAdminQueryService {

  String _pagesUrl = 'http://localhost:9000/-/list-pages?in-tree';

  Future _loaded;

  Map<String, Topic> _topicsCache;

  Http _http;

  DebikiAdminQueryService(Http this._http) {
    _loaded = Future.wait([_loadPages()]);
  }

  Future _loadPages() {
    return _http.get(_pagesUrl)
      .then((HttpResponse response) {
        _topicsCache = new Map();
        for (Map pageJsonMap in response.data["pages"]) {
          Topic topic = new Topic.fromJsonMap(pageJsonMap);
          _topicsCache[topic.id] = topic;
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

}
