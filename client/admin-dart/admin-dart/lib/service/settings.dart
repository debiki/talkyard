library page_settings;

import 'dart:convert';

import 'package:debiki_admin/util.dart';


class Setting<T> {
  final SettingsTarget target;
  final String name;
  final T defaultValue;
  T currentValue;
  T newValue;

  Setting(SettingsTarget this.target, String this.name, T this.defaultValue, {
        T this.currentValue: null }) {
    if (currentValue == null) {
      currentValue = defaultValue;
    }
    newValue = currentValue;
  }

  String get toJson {
    return JSON.encode({
      'type': target.type,
      'pageId': target.pageId,
      'name': name,
      'newValue': newValue
    });
  }
}


class SettingsTarget {
  final String type;
  final String pageId;

  SettingsTarget(String this.type, String this.pageId);

  factory SettingsTarget.site() {
    return new SettingsTarget('WholeSite', null);
  }

  factory SettingsTarget.section(String pageId) {
    return new SettingsTarget('PageTree', pageId);
  }

  factory SettingsTarget.page(String pageId) {
    return new SettingsTarget('SinglePage', pageId);
  }

}


class Settings {

  final SettingsTarget target;

  Setting<String> title;
  Setting<String> description;
  //String imageUrl;
  //String faviconUrl;
  Setting<bool> horizontalComments;

  Settings(SettingsTarget this.target, {
    this.title: null,
    this.description: null,
    this.horizontalComments: null
  });

  factory Settings.fromJsonMap(SettingsTarget target, Map json) {
    return new Settings(
        target,
        title: _makeSetting(target, 'title', json),
        description: _makeSetting(target, 'description', json),
        horizontalComments: _makeSetting(target, 'horizontalComments', json));
  }

  static Setting _makeSetting(
        SettingsTarget target, String name, Map valueMap) {
    // ? SHOULD change from currentValue to anyAssignedValue which might be null.
    var jsonSetting = valueMap[name];
    errorIf(jsonSetting == null, "No such setting: `$name' [DwEKf980]");
    return new Setting(
        target,
        name,
        jsonSetting['defaultValue'],
        currentValue: jsonSetting['anyAssignedValue']);
  }

}
