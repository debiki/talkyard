/**
 * Copyright (c) 2011-2012 Kaj Magnus Lindberg (born 1979)
 */

package com.debiki.v0

import java.{util => ju}


trait PeopleTestUtils {

  def makePerson(idBase: String): (User, Identity, Login) = {
    val user = User(idBase + "id", idBase + " name", "em@a.il",
      EmailNotfPrefs.Receive)
    val idty = IdentitySimple(idBase + "Idty",
      userId = user.id, name = user.displayName)
    val login = Login(idBase + "Login",
      None, "1.2.3.4", new ju.Date(11000), idty.id)
    (user, idty, login)
  }

}


object PeopleTestUtils extends PeopleTestUtils

