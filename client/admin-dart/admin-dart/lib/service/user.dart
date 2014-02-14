library user;

import 'dart:convert';


class User {
  String id;
  String displayName;
  bool isAdmin;
  String country;

  User(this.id, this.displayName, this.isAdmin, this.country);

  String toJsonString() {
    Map data = {
                'id': id,
                'displayName': displayName,
                'isAdmin': isAdmin,
                'country': country
    };
    return JSON.encode(data);
  }

  factory User.fromJsonMap(Map json) {
    return new User(json['id'], json['displayName'], json['isAdmin'],
        json['country']);
  }

}

