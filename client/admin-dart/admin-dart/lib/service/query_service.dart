library debiki_admin_query_service;

import 'dart:async';
import 'dart:convert';
import 'dart:html';
import 'package:angular/angular.dart';

import 'debiki_data.dart';
import 'settings.dart';
import 'post.dart';
import 'topic.dart';
import 'user.dart';
import '../util.dart';


class DebikiAdminQueryService {

  String get _origin => debikiServerOrigin;
  String get _recentPostsUrl => '$_origin/?list-actions.json';
  String get _pagesUrl => '$_origin/-/list-pages?in-tree';
  String get _approvePostUrl => '$_origin/-/approve';
  String get _rejectPostUrl => '$_origin/-/reject';
  String get _deletePostUrl => '$_origin/-/delete';
  String get _loadSiteSettingsUrl => '$_origin/-/load-site-settings';
  String get _loadSectionSettingsUrl => '$_origin/-/load-section-settings';
  String get _saveSettingUrl => '$_origin/-/save-setting';

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
        print('Loaded num topics: ${_debikiData.topicsById.values.length}');
        print('Loaded num posts: ${_debikiData.recentPosts.length}');
        print('Loaded num users: ${_debikiData.usersById.values.length}');
        return _debikiData;
      });
    }
    return new Future.value(_debikiData);
  }

  Future approvePost(Post post) {
    return _doSomethingWithPost(post, _approvePostUrl);
  }

  Future rejectPost(Post post) {
    return _doSomethingWithPost(post, _rejectPostUrl);
  }

  Future deletePost(Post post) {
    error("Unimplemented [DwE254FGU9]");
  }

  Future _doSomethingWithPost(Post post, String actionUrl) {
    return _http.request(
        actionUrl, withCredentials: true, method: 'POST',
        requestHeaders: {
          'Content-Type': 'application/json',
          'X-XSRF-TOKEN': 'CorsFromDartEditor'
        },
        sendData: _postToJson(post));
  }

  String _postToJson(Post post) {
    return '[{ "pageId": "${post.pageId}", "actionId": "${post.id}" }]';
  }

  Future<Settings> loadSettings(SettingsTarget settingsTarget) {
    var url;
    if (settingsTarget.pageId != null) {
      url = "$_loadSectionSettingsUrl?rootPageId=${settingsTarget.pageId}";
    }
    else {
      error('Unimplemented [DwE52FH435]');
    }
    return _http.request(url, withCredentials: true) // .get(_recentPostsUrl)
        .then((HttpResponse response) {
      // `data` is a String here, but a json Map in _loadTopics, perhaps the reason is
      // that I have to use `request` here not `get`?
      // Also remove leading ")]}',\n", 6 chars.
      Map json = JSON.decode(response.data.substring(6));
      return new Settings.fromJsonMap(settingsTarget, json);
    });
  }

  Future saveTextSetting(String pageId, Setting value) {
    return _http.request(
        _saveSettingUrl, withCredentials: true, method: 'POST',
        requestHeaders: {
          'Content-Type': 'application/json',
          'X-XSRF-TOKEN': 'CorsFromDartEditor'
        },
        sendData: value.toJson);
  }
}
