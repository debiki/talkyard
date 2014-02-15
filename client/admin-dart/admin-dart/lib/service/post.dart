library Post;

import 'dart:convert';

//import '../diff-match-patch/DiffMatchPatch.dart';
import '../util.dart';
import 'debiki_data.dart';
import 'topic.dart';
import 'user.dart';


/**
 * Is e.g. a comment, or a page title or page body or forum topic.
 *
 * Could perhaps split into class Post and class PostView, the former would
 * contain domain model data, the latter would contain view related methods
 * but no domain model data.
 */
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

  bool showViewSuggsLink = false;
  bool showRejectBtn = false;
  bool showDeleteBtn = false;
  String approveBtnText = '';
  get prettyFlags => 'TODO(prettyFlags)';

  String _inlineMessage = '';
  get inlineMessage => _inlineMessage;

  String get pagePath {
    Topic topic = _debikiData.topicsById[pageId];
    return topic != null ? topic.path : '(new page)';
  }

  String get userDisplayName {
    User user = _debikiData.usersById[userId];
    return user != null ? user.displayName : '?';
  }

  Post(this._debikiData, this.id, this.type, this.pageId, this.loginId, this.userId,
      this.status, this.unapprovedText, this.approvedText,
      this.createdAt, this.numHandledFlags, this.numPendingFlags,
      this.numPendingEditSuggestions) {

    if (numHandledFlags == null)
      numHandledFlags = 0;

    if (numPendingFlags == null)
      numPendingFlags = 0;

    if (numPendingEditSuggestions == null)
      numPendingEditSuggestions = 0;

    switch (status) {
      case 'NewPrelApproved':
      case 'EditsPrelApproved':
        approveBtnText = 'Okay';
        showRejectBtn = true;
        showViewSuggsLink = false;
        break;
      case 'New':
      case 'NewEdits':
        approveBtnText = 'Approve';
        showRejectBtn = true;
        showViewSuggsLink = false;
        break;
      default:
        showViewSuggsLink = numPendingEditSuggestions > 0;
        break;
    }
  }

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

  String get url {
    var queryStr = id == 65502 ? '?view=template' : '';
    var postPath = '/-$pageId$queryStr#post-$id';
    return postPath;
  }

  bool get showNewFlagsLink => numPendingFlags > 0;
  bool get showOldFlagsLink => numHandledFlags > 0;

  String get description {
    var what;
    switch(id) {
      case 65501: what = 'Page title'; break;
      case 65502: what = 'Page'; break;
      case 65503: what = 'Page config'; break;
      default: what = 'Comment'; break;
    }
    var text;
    switch (status) {
      case 'New': text = 'New ${what}'; break; // COULD to lowercase
      case 'NewPrelApproved': text = 'New ${what}, prel. approved'; break; // COULD lowercase
      case 'Approved': text = what; break;
      case 'Rejected': text = '$what, rejected'; break;
      case 'EditsRejected': text = '$what, edits rejected'; break;
      case 'NewEdits': text = '$what, edited'; break;
      case 'EditsPrelApproved': text = '$what, edits prel. approved'; break;
      default: text = '$what, ${status}'; break;
    }
    return text;
  }

  String get textOrDiff {
    var text = '';
    switch (status) {
      case 'New':
        text = _escapeHtml(unapprovedText);
        break;
      case 'NewPrelApproved':
      case 'Approved':
        text = _escapeHtml(approvedText);
        break;
      case 'Rejected':
        // Sometimes `unapprovedText` is undefined, nevertheless the post was rejected.
        text = unapprovedText != null ? unapprovedText : approvedText;
        text = _escapeHtml(text);
        break;
      case 'EditsRejected':
      case 'EditsPrelApproved':
      case 'NewEdits':
        text = _htmlDiffOfApprovedAndUnapproved();
        break;
      default:
        error('[DwE38RUJ0]');
    }
    return text;
  }

  String _htmlDiffOfApprovedAndUnapproved() {
    return 'TODO(diff)';
    //DiffMatchPatch dmp;
    //var diff = dmp.diff_main(approvedText, unapprovedText);
    // Could use: `diff_cleanupSemantic diff` instead, but that sometimes
    // result in the diff algorithm sometimes replacing too much old text.
    //dmp.diff_cleanupEfficiency(diff);
    //return diff.toString();
    //htmlString = d.i.prettyHtmlFor(diff);
    //htmlString
  }

  /**
   * COULD move to util.dart?
   */
  String _escapeHtml(String html) {
    return html;
    // TODO:
    //html.replace(/&/g, "&amp;")
    //.replace(/</g, "&lt;")
    //.replace(/>/g, "&gt;")
    // Could also replace ' and " if needs to escape attribute value.
  }

}
