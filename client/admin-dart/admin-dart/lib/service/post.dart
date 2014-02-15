library Post;

import 'dart:convert';

import 'debiki_data.dart';
import 'user.dart';


class Post {

  DebikiData _debikiData;

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

  get showNewFlagsLink => false;
  get showOldFlagsLink => false;
  get showViewSuggsLink => false;
  get showRejectBtn => false;
  get showDeleteBtn => false;
  get approveBtnText => 'TODO(approveBtnText)';
  get prettyFlags => 'TODO(prettyFlags)';
  get description => 'TODO(description)';
  get url => 'TODO(url)';
  get textOrDiff => 'TODO(textOrDiff)';
  get inlineMessage => 'TODO(inlineMessage)';
  get pagePath => 'TODO(pagePath)';

  String get userDisplayName {
    User user = _debikiData.usersById[userId];
    return user != null ? user.displayName : '?';
  }

  Post(this._debikiData, this.id, this.type, this.pageId, this.loginId, this.userId,
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

  factory Post.fromJsonMap(DebikiData debikiData, Map json) {
    return new Post(debikiData,
        int.parse(json['id']), json['type'], json['pageId'], json['loginId'], json['userId'],
        json['status'], json['unapprovedText'], json['approvedText'],
        DateTime.parse(json['cdati']), json['numHandledFlags'], json['numPendingFlags'],
        json['numPendingEditSuggestions']);
  }

}
