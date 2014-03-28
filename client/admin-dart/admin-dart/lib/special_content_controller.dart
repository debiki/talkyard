library view_settings_component;

import 'package:angular/angular.dart';

import 'package:debiki_admin/service/query_service.dart';


@NgController(
    selector: '[special-content]',
    publishAs: 'ctrl')
class SpecialContentController {

  DebikiAdminQueryService _queryService;

  RouteProvider routeProvider;


  SpecialContentController(DebikiAdminQueryService this._queryService,
      RouteProvider this.routeProvider) {
  }

}
