library user;

import 'dart:convert';

import 'debiki_data.dart';


class User {

  DebikiData _debikiData;

  String id;
  String displayName;
  bool isAdmin;
  String country;

  User(this._debikiData, this.id, this.displayName, this.isAdmin, this.country);

  String toJsonString() {
    Map data = {
                'id': id,
                'displayName': displayName,
                'isAdmin': isAdmin,
                'country': country
    };
    return JSON.encode(data);
  }

  factory User.fromJsonMap(DebikiData debikiData, Map json) {
    return new User(debikiData, json['id'], json['displayName'], json['isAdmin'],
        json['country']);
  }

}

