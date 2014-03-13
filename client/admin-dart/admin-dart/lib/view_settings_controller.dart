library view_settings_component;

import 'package:angular/angular.dart';

import 'package:debiki_admin/service/settings.dart';
import 'package:debiki_admin/service/query_service.dart';
import 'package:debiki_admin/util.dart';


@NgController(
    selector: '[settings]',
    publishAs: 'ctrl')
class ViewSettingsController {

  DebikiAdminQueryService _queryService;

  RouteProvider routeProvider;

  Settings _settings = null;
  get settings => _settings;

  ViewSettingsController(DebikiAdminQueryService this._queryService,
      RouteProvider this.routeProvider) {

    SettingsTarget target;
    if (routeProvider.routeName.contains('site')) {
      target = new SettingsTarget.site();
    }
    else if (routeProvider.routeName.contains('blog')) {
      var blogId = routeProvider.parameters['blogId'];
      target = new SettingsTarget.section(blogId);
    }
    else if (routeProvider.routeName.contains('forum')) {
      var forumId = routeProvider.parameters['forumId'];
      target = new SettingsTarget.section(forumId);
    }
    else {
      error('Bad route name: "${routeProvider.routeName}" [DwE8GK3W0]');
    }

    _queryService.loadSettings(target).then((Settings loadedSettings) {
      this._settings = loadedSettings;
    });
  }

}
