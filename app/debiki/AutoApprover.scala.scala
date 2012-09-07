// Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)

package debiki

import com.debiki.v0._
import controllers._
import DebikiHttp._
import Prelude._


/**
 * Analyzes a user and his/her history, and perhaps automatically approves
 * an action s/he has requested.
 */
object AutoApprover {


  def perhapsApprove(pageReq: PageRequest[_]): Option[Approval] = {
    if (pageReq.user_!.isAdmin)
      Some(Approval.AuthoritativeUser)
    else
      None
  }

}
