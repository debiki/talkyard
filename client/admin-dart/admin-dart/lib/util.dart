import 'dart:html';


void error(String message) {
  throw new DebikiError(message);
}

class DebikiError extends Error {
  String message;
  DebikiError(String this.message);
  String toString() => message;
}


/**
 * In development mode, translates the real origin to the origin of Play Framework server
 * (Play runs on port 9000 but Dart Editor on port 3030).
 */
String get debikiServerOrigin {
  var realOrigin = window.location.origin;
  var origin = realOrigin.replaceAll('localhost:3030', 'localhost:9000');
  origin = origin.replaceAll('127.0.0.1:3030', 'localhost:9000');
  return origin;
}
