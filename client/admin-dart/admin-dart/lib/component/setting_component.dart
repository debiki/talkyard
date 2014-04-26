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

  @NgAttr('page-id')
  String pageId = '';

  @NgTwoWay('setting')
  Setting setting;

  /** If a text setting should use a multiline editor, i.e. a <textarea> not an <input>. */
  @NgOneWay('multiline')
  bool multiline = false;


  bool get isTextSetting => setting.newValue is String;
  bool get isBoolSetting => setting.newValue is bool;
  bool get valueChanged => setting.newValue != setting.currentValue;
  bool get hasDefaultValue => setting.currentValue == setting.defaultValue;


  SettingComponent(DebikiAdminQueryService this._queryService) {
  }

  void save() {
    _queryService.saveSetting(setting).then((_) {
      setting.currentValue = setting.newValue;
    }, onError: (x) {
      print('Error saving setting: $x');
      // COULD show error message somehow
    });
  }

  void cancel() {
    setting.newValue = setting.currentValue;
  }

  void setToDefault() {
    setting.newValue = setting.defaultValue;
  }
}
