library debiki_admin;

import 'package:angular/angular.dart';
import 'package:perf_api/perf_api.dart';

// Temporary, please follow https://github.com/angular/angular.dart/issues/476
@MirrorsUsed(targets: const['debiki_admin'], override: '*')
import 'dart:mirrors';


@NgController(
    selector: '[debiki-admin]',
    publishAs: 'ctrl')
class DebikiAdminController {
}


class DebikiAdminModule extends Module {
  DebikiAdminModule() {
    type(DebikiAdminController);
    type(Profiler, implementedBy: Profiler); // comment out to enable profiling
  }
}


main() {
  ngBootstrap(module: new DebikiAdminModule());
}

