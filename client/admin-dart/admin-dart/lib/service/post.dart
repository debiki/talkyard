library Post;

import 'dart:convert';

class Post {

  int id;
  String type;
  String pageId;
  String loginId;
  String userId;
  String status;
  String unapprovedText;
  String approvedText;
  DateTime createdAt;
  int numHandledFlags;
  int numPendingFlags;
  int numPendingEditSuggestions;

  Post(this.id, this.type, this.pageId, this.loginId, this.userId,
      this.status, this.unapprovedText, this.approvedText,
      this.createdAt, this.numHandledFlags, this.numPendingFlags,
      this.numPendingEditSuggestions);

  String toJsonString() {
    Map data = {
                'id': id,
                'type': type,
                'pageId': pageId,
                'loginId': loginId,
                'userId': userId,
                'status': status,
                'unapprovedText': unapprovedText,
                'approvedText': approvedText,
                'createdAt': createdAt.toString(),  // not cdati
                'numHandledFlags': numHandledFlags,
                'numPendingFlags': numPendingFlags,
                'numPendingEditSuggestions': numPendingEditSuggestions
    };
    return JSON.encode(data);
  }

  factory Post.fromJsonMap(Map json) {
    return new Post(
        int.parse(json['id']), json['type'], json['pageId'], json['loginId'], json['userId'],
        json['status'], json['unapprovedText'], json['approvedText'],
        DateTime.parse(json['cdati']), json['numHandledFlags'], json['numPendingFlags'],
        json['numPendingEditSuggestions']);
  }

}
