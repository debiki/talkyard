library debiki_admin;

import 'package:angular/angular.dart';
import 'package:perf_api/perf_api.dart';
//import 'package:angular_ui/angular_ui.dart';   <-- no, then lots of weird errors
import 'package:angular_ui/tabs/tabset.dart'; // <-- that's all that's needed right now

import 'package:debiki_admin/debiki_admin_controller.dart';
import 'package:debiki_admin/view_settings_controller.dart';
import 'package:debiki_admin/component/view_topics_component.dart';
import 'package:debiki_admin/component/view_comments_component.dart';
import 'package:debiki_admin/component/setting_component.dart';
import 'package:debiki_admin/component/special_content_component.dart';
import 'package:debiki_admin/routing/debiki_admin_router.dart';
import 'package:debiki_admin/service/query_service.dart';


// Temporary, please follow https://github.com/angular/angular.dart/issues/476
/* @MirrorsUsed(
    targets: const[
      'debiki_admin',
      'debiki_admin_controller',
      'view_topics_component',
      'view_comments_component'],
    override: '*') */
//import 'dart:mirrors';


class DebikiAdminModule extends Module {
  DebikiAdminModule() {
    install(new TabsModule());

    type(DebikiAdminController);
    type(DebikiAdminQueryService);
    type(ViewTopicsComponent);
    type(ViewCommentsComponent);
    type(ViewSettingsController);
    type(SettingComponent);
    type(SpecialContentComponent);
    value(RouteInitializerFn, debikiAdminRouteInitializer);
    factory(NgRoutingUsePushState, (_) => new NgRoutingUsePushState.value(false));
    type(Profiler, implementedBy: Profiler); // comment out to enable profiling
  }
}


main() {
  ngBootstrap(module: new DebikiAdminModule());
}

