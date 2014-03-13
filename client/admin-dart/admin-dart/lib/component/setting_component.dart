library text_setting_component;

import 'package:angular/angular.dart';

import 'package:debiki_admin/service/query_service.dart';
import 'package:debiki_admin/service/settings.dart';


@NgComponent(
    selector: 'setting',
    templateUrl: 'packages/debiki_admin/component/setting_component.html',
    applyAuthorStyles: true,
    publishAs: 'cmp')
class SettingComponent {

  DebikiAdminQueryService _queryService;

  @NgAttr('title')
  String title = 'Topics';

  @NgAttr('type')
  String type = '';

  @NgAttr('page-id')
  String pageId = '';

  @NgTwoWay('value')
  Setting value;

  bool get isTextSetting => value.newValue is String;
  bool get isBoolSetting => value.newValue is bool;
  bool get valueChanged => value.newValue != value.currentValue;
  bool get hasDefaultValue => value.currentValue == value.defaultValue;


  SettingComponent(DebikiAdminQueryService this._queryService) {
  }

  void save() {
    _queryService.saveTextSetting(pageId, value).then((_) {
      value.currentValue = value.newValue;
    }, onError: (x, y, z) {
      print('Error saving setting: $x, $y, $z');
      // COULD show error message somehow
    });
  }

  void cancel() {
    value.newValue = value.currentValue;
  }

  void setToDefault() {
    value.newValue = value.defaultValue;
  }
}
