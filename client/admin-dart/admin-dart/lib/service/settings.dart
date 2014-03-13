library page_settings;


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
        title: json['title'],
        description: json['description'],
        horizontalComments: json['horizontalComments']);
  }

}
