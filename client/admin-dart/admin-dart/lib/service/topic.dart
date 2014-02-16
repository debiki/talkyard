library Topic;

import 'dart:convert';

import 'debiki_data.dart';


class Topic {

  DebikiData _debikiData;

  String id;
  String path;
  String status;
  TopicRole role;
  String anyParentPageId;
  String anyTitle;
  String anyEmbeddingPageUrl;

  Topic(this._debikiData, this.id, this.path, this.status, this.role,
      this.anyParentPageId, this.anyTitle, this.anyEmbeddingPageUrl);

  String toJsonString() {
    Map data = {
                'id': id,
                'path': path,
                'status': status,
                'role': role,
                'parentPageId': anyParentPageId,
                'title': anyTitle,
                'embeddingPageUrl': anyEmbeddingPageUrl
    };
    return JSON.encode(data);
  }

  factory Topic.fromJsonMap(DebikiData debikiData, Map json) {
    return new Topic(debikiData, json['id'], json['path'], json['status'],
        new TopicRole.fromString(json['role']),
         json['parentPageId'], json['title'], json['embeddingPageUrl']);
  }

  String get prettyTitle {
    if (anyTitle != null) return anyTitle;
    return "(Unnamed page)";
  }
}


class TopicRole {
  static const Generic = const TopicRole._('Generic');
  static const Code = const TopicRole._('Code');
  static const EmbeddedComments = const TopicRole._('EmbeddedComments');
  static const Blog = const TopicRole._('Blog');
  static const BlogPost = const TopicRole._('BlogPost');
  static const ForumGroup = const TopicRole._('ForumGroup');
  static const Forum = const TopicRole._('Forum');
  static const ForumTopic = const TopicRole._('ForumTopic');
  static const WikiMainPage = const TopicRole._('WikiMainPage');
  static const WikiPage = const TopicRole._('WikiPage');

  static get values => [
      Generic, Code, EmbeddedComments,
      Blog, BlogPost,
      ForumGroup, Forum, ForumTopic,
      WikiMainPage, WikiPage];

  final String value;

  const TopicRole._(this.value);

  factory TopicRole.fromString(String string) {
    switch (string) {
      case 'Generic': return TopicRole.Generic; break;
      case 'Code': return TopicRole.Code; break;
      case 'EmbeddedComments': return TopicRole.EmbeddedComments; break;
      case 'Blog': return TopicRole.Blog; break;
      case 'BlogPost': return TopicRole.BlogPost; break;
      case 'ForumGroup': return TopicRole.ForumGroup; break;
      case 'Forum': return  TopicRole.Forum; break;
      case 'ForumTopic': return TopicRole.ForumTopic; break;
      case 'WikiMainPage': return TopicRole.WikiMainPage; break;
      case 'WikiPage': return TopicRole.WikiPage; break;
    }
  }

  String toString() => this.value;
}


