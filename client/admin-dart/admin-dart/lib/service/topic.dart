library Topic;

import 'dart:convert';

class Topic {
  String id;
  String path;
  String status;
  String role;

  Topic(this.id, this.path, this.status, this.role);

  String toJsonString() {
    Map data = {
                'id': id,
                'path': path,
                'status': status,
                'role': role
    };
    return JSON.encode(data);
  }

  factory Topic.fromJsonMap(Map json) {
    return new Topic(json['id'], json['path'], json['status'], json['role']);
  }

}