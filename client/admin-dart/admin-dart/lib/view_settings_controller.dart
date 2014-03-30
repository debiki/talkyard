library view_settings_component;

import 'package:angular/angular.dart';

import 'package:debiki_admin/service/settings.dart';
import 'package:debiki_admin/service/query_service.dart';


@NgController(
    selector: '[settings]',
    publishAs: 'ctrl')
class ViewSettingsController extends NgAttachAware {

  DebikiAdminQueryService _queryService;

  // I have no idea why, but @NgAttr = "{{forum.id}}" doesn't work, rootPageId always
  // becomes = "". But @NgOneWayOneTime = "fourm.id" works:
  @NgOneWayOneTime('root-page-id')
  String rootPageId;

  RouteProvider routeProvider;

  Settings _settings = null;
  get settings => _settings;

  ViewSettingsController(DebikiAdminQueryService this._queryService,
      RouteProvider this.routeProvider) {
  }


  void attach() {
    SettingsTarget target;
    if (rootPageId == null) {
      target = new SettingsTarget.site();
    }
    else {
      target = new SettingsTarget.section(rootPageId);
    }
    _queryService.loadSettings(target).then((Settings loadedSettings) {
      this._settings = loadedSettings;
    });
  }

}
