library special_content_component;

import 'package:angular/angular.dart';

import 'package:debiki_admin/service/query_service.dart';
import 'package:debiki_admin/service/special_content.dart';


@NgComponent(
    selector: 'special-content',
    templateUrl: 'packages/debiki_admin/component/special_content_component.html',
    applyAuthorStyles: true,
    publishAs: 'cmp')
class SpecialContentComponent extends NgAttachAware {

  DebikiAdminQueryService _queryService;

  @NgAttr('title')
  String title = '';

  @NgAttr('type')
  String type = '';

  @NgAttr('root-page-id')
  String rootPageId = '';

  @NgAttr('content-id')
  String contentId = '';

  SpecialContent content;

  bool get valueChanged => content.newText != content.currentText;
  bool get hasDefaultValue => content.currentText == content.defaultText;


  SpecialContentComponent(DebikiAdminQueryService this._queryService) {
  }

  void attach() {
    if (rootPageId == null)
      rootPageId = '';

    _queryService.loadSpecialContent(rootPageId, contentId).then((SpecialContent content) {
      this.content = content;
    });
  }

  void save() {
    _queryService.saveSpecialContent(content).then((_) {
      content.currentText = content.newText;
    }, onError: (x) {
      print('Error saving content: $x');
      // COULD show error message somehow
    });
  }

  void cancel() {
    content.newText = content.currentText;
  }

  void setToDefault() {
    content.newText = content.defaultText;
  }
}
