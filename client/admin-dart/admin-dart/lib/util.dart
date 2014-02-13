

void error(String message) {
  throw new DebikiError(message);
}

class DebikiError extends Error {
  String message;
  DebikiError(String this.message);
  String toString() => message;
}
