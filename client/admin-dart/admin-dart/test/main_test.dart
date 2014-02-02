library main_test;

import 'package:unittest/unittest.dart';
import 'package:di/di.dart';
import 'package:angular/angular.dart';
import 'package:angular/mock/module.dart';

import '../web/main.dart';

main() {
  setUp(setUpInjector);
  tearDown(tearDownInjector);

  group('debiki-admin', () {
    test('true should be true', inject((DebikiAdminController adminController) {
      expect(true, equals(true));
    }));
  });
}
