library page_settings;

import 'package:debiki_admin/util.dart';


class Setting<T> {
  final T defaultValue;
  T currentValue;
  T newValue;

  Setting(T this.defaultValue, { T this.currentValue: null }) {
    if (currentValue == null) {
      currentValue = defaultValue;
    }
    newValue = currentValue;
  }

  String get toJson {
    return 'Boo hooo';
  }
}


class SettingsTarget {
  final String type;
  final String pageId;
  final String roleId;

  SettingsTarget(String this.type, String this.pageId, String this.roleId);

  factory SettingsTarget.site() {
    return new SettingsTarget('SiteSettings', null, null);
  }

  factory SettingsTarget.section(String pageId) {
    return new SettingsTarget('SectionSettings', pageId, null);
  }

  factory SettingsTarget.page(String pageId) {
    return new SettingsTarget('PageSettings', pageId, null);
  }

  factory SettingsTarget.role(String roleId) {
    return new SettingsTarget('PageSettings', null, roleId);
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
        title: _makeSetting(json, 'title'),
        description: _makeSetting(json, 'description'),
        horizontalComments: _makeSetting(json, 'horizontalComments'));
  }

  static Setting _makeSetting(Map jsonMap, String settingName) {
    // ? SHOULD change from currentValue to anyAssignedValue which might be null.
    var jsonSetting = jsonMap[settingName];
    errorIf(jsonSetting == null, "No such setting: `$settingName' [DwEKf980]");
    return new Setting(
        jsonSetting['defaultValue'],
        currentValue: jsonSetting['anyAssignedValue']);
  }

}
