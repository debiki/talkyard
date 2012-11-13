/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */


package object debiki {

  // For now, declare this type. In the future, I'll probably
  // create a SystemDao class, which *delegates* to a SystemDbDao,
  // but has an almost idential interface. — By using a type alias
  // right now, I'm saving myself tome time: I don't have to rename
  // lots of `SystemDao` to `SystemDbDao` (because SystemDbDao is in
  // use right now, but the code refers to SystemDao, compilation errors
  // without this alias).
  type SystemDao = com.debiki.v0.SystemDbDao

}
