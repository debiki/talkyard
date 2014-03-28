library special_content;

import 'dart:convert';


class SpecialContent {
  final String rootPageId;
  final String contentId;
  final String defaultText;
  String currentText;
  String newText;
  String markup;

  SpecialContent(String this.rootPageId, String this.contentId, {
        String this.defaultText: '', String this.currentText: null,
        String this.markup: '???' }) {
    if (currentText == null) {
      currentText = defaultText;
    }
    newText = currentText;
  }

  factory SpecialContent.fromJsonMap(Map json) {
    return new SpecialContent(
        json['rootPageId'],
        json['contentId'],
        defaultText: json['defaultText'],
        currentText: json['anyCustomText'],
        markup: json['markup']);
  }

  String get toJson {
    var map = {
      'rootPageId': rootPageId,
      'contentId': contentId,
      'defaultText': defaultText,
      'useDefaultText': newText == defaultText,
      'markup': markup
    };

    if (newText != defaultText)
      map['anyCustomText'] = newText;

    return JSON.encode(map);
  }
}

