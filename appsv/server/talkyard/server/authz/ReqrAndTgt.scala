package talkyard.server.authz

import com.debiki.core._
import com.debiki.core.Prelude.dieIf
import debiki.EdHttp.{throwForbidden, throwForbiddenIf}


sealed trait AnyReqrAndTgt {

  /** Info about the HTTP request, e.g. ip address. */
  def browserIdData: BrowserIdData

  /** The requester is the person (or bot) sending the HTTP request.
    * None means they're a stranger (not logged in). */
  def anyReqr: Opt[Pat]

  def reqrIsAdmin: Bo = anyReqr.exists(_.isAdmin)

  def reqrIsStaff: Bo = anyReqr.exists(_.isStaff)

  /** If the request is on behalf of sbd else, then, that other person is the "target" user.
    * If the requester does things for themselves (not for sbd else), then, is None.
    * Always None if anyReqr is None (strangers can't do things for others).
    */
  def otherTarget: Opt[Pat] = None

  /** For casting the requester to admin, to invoke admin-only functions.
    * But if the requester is *not* an admin, then, this fn aborts the request,
    * the server replies Forbidden.
    */
  def denyUnlessAdmin(): AdminReqrAndTgt =
    throwForbidden("TyEREQR0ADM", "You're not admin")

  def denyUnlessStaff(): StaffReqrAndTgt =
    throwForbidden("TyEREQR0MOD", "You're not a moderator")

  /* Could create a CoreMembReqrAndTgt class?
  def denyUnlessCoreMember(): MembReqrAndTgt =
    throwForbidden("TyEREQR0CORMEMB", "You're not a core member or moderator")

  // Could create a TrustedReqrAndTgt class?
  def denyUnlessTrusted(): MembReqrAndTgt =
    throwForbidden("TyEREQR0TRUSTD", "You don't have enough permissions")
   */

  def denyUnlessMember(): MembReqrAndTgt =
    throwForbidden("TyEREQR0MEMB", "You're not a member")

  def denyUnlessLoggedIn(): ReqrAndTgt =
    throwForbidden("TyEREQR0LGI", "You're not logged in")
}


/** Requester and target.
  *
  * The requester (the participant doing the request), and the target of the request,
  * are usually the same. For example, a user configures their own settings,
  * or looks at a page, or replies to a post.
  *
  * But admins and mods can do things on behalf of others. For example, the requester
  * can be an admin, who configures notification settings for another user,
  * or for a group — that other user or group, is then the target user.
  *
  * (The browser info, e.g. ip addr, is about the requester's browser.  — The
  * target user might not be at their computer at all, or might be a bot or group.)
  *
  * (Short name: "Reqr", "Tgt", because these requester-and-target classes will be
  * frequently used — namely in *all* request handling code, eventually?)
  *
  * @tparam target — But sometimes there're many request target participants,
  *     e.g. when assignig people to a task, if assigning (or un-assigning) many.
  *     Should `target` instead be:  targets: Seq[Pat]?  [many_req_tgt_pats]
  *     and an ... "un-target", if un-assigning people too?  Let's wait.
  */
sealed trait ReqrAndTgt extends AnyReqrAndTgt {
  def anyReqr: Opt[Pat] = Some(reqr)
  def reqr: Pat
  def reqrId: PatId = reqr.id
  def reqrToWho: Who = Who(reqr.trueId2, browserIdData, reqr.isAnon)
  def target: Pat
  def targetToWho: Who = Who(target.trueId2, browserIdData, target.isAnon)
  def targetIsStaff: Bo = target.isStaff
  def targetIsCoreMember: Bo = target.isStaffOrCoreMember
  def targetIsTrusted: Bo = target.isStaffOrTrustedNotThreat
  def targetIsFullMember: Bo =
        target.isStaff || target.effectiveTrustLevel.isAtLeast(TrustLevel.FullMember)

  override def otherTarget: Opt[Pat] =
    if (target.id == reqr.id) None // not an *other* target, but the *same* as reqr
    else Some(target)

  def areNotTheSame: Bo = target.id != reqr.id
}


object ReqrAndTgt {

  def apply(reqrInf: ReqrInf, target: Pat): ReqrAndTgt = {
    this.apply(reqrInf.reqr, reqrInf.browserIdData, target = target)
  }

  def apply(reqr: Pat, browserIdData: BrowserIdData, target: Pat): ReqrAndTgt = {
    // Maybe move the checks in  UserDao._editMemberThrowUnlessSelfStaff()  to here?
    // Then, things like  [vote_as_otr], [do_as_otr]  would get checked automatically everywhere,
    // and the other  [api_do_as]  checks no longer needed?

    // Use the most specific Admin/Staff/.../ReqrAndTgt class.
    if (reqr.isAdmin) AdminReqrAndTgtClass(reqr, browserIdData, target = target)
    else if (reqr.isModerator) StaffReqrAndTgtClass(reqr, browserIdData, target = target)
    // Maybe later? Or too much boilerplate? What about template params: [T <: TrustLevel] or sth like that?
    //else if (reqr.isStaffOrCoreMember) CoreReqrAndTgt(reqr, browserIdData, target = target)
    //else if (reqr.isStaffOrTrustedNotThreat) TrustedReqrAndTgt(reqr, browserIdData, target = target)
    else if (reqr.isMember) {
      MembReqrAndTgtClass(reqr, browserIdData, target = target)
    }
    else {
      // If not a member, then, can only do things on behalf of oneself, e.g. view a page
      // or leave a comment as a Guest user.
      dieIf(target.id != reqr.id, "TyE0MEMBHASTGT")
      ReqrTgtSelf(reqr, browserIdData)
    }
  }
}


/** For verifying that the requester is an admin.
  *
  * Use in function signatures, to get a compile time guarantee that either 1)
  * the function runs and the requester is an admin, or 2) the server aborts the request
  * and replies Forbidden.
  *
  * Can be used deep in internal functions, not only at the HTTP request entrypoints.
  */
trait AdminReqrAndTgt extends ReqrAndTgt with StaffReqrAndTgt {
  override def denyUnlessAdmin(): AdminReqrAndTgt = this
}

private case class AdminReqrAndTgtClass(
  reqr: Pat,
  browserIdData: BrowserIdData,
  target: Pat,
) extends AdminReqrAndTgt {

  require(reqr.isAdmin, "TyEREQR0ADM02")
}


trait StaffReqrAndTgt extends ReqrAndTgt with MembReqrAndTgt {
  override def denyUnlessStaff(): StaffReqrAndTgt = this
}

private case class StaffReqrAndTgtClass(
  reqr: Pat,
  browserIdData: BrowserIdData,
  target: Pat,
) extends StaffReqrAndTgt {

  require(reqr.isModerator, "TyEREQR0MOD")
  // Better use the most specific Staff/AdminReqrAndTgt class.
  require(!reqr.isAdmin, "TyEREQRMEMBADM")
}


trait MembReqrAndTgt extends ReqrAndTgt {
  override def denyUnlessMember(): MembReqrAndTgt = this

  // Don't return a MembReqrAndTgt — then, someone might use denyUnlessLoggedIn() where
  // they meant to use denyUnlessMember (wouldn't be a compilation error).
  override def denyUnlessLoggedIn(): ReqrAndTgt = this
}

private case class MembReqrAndTgtClass(
  reqr: Pat,
  browserIdData: BrowserIdData,
  target: Pat,
) extends MembReqrAndTgt {

  require(reqr.isMember, "TyEREQR0MEMBR")
  // Better to use the most specific Memb/Staff/AdminReqrAndTgt class.
  require(!reqr.isStaff, "TyEREQRMEMBSTAFF")
}


/** If guest, then, can never do things on behalf of others, so there's no target.
  */
case class ReqrTgtSelf(reqr: Pat, browserIdData: BrowserIdData) extends ReqrAndTgt {
  // Should use MembReqrAndTgt etc instead, if the requester is a logged in member.
  require(!reqr.isMember, "TyEREQRMEMBSTAFF")

  def target: Pat = reqr

  // (Since there's a `reqr: Pat`, who's not a member, the requester is probably
  // logged in as a Guest, fine.)
  override def denyUnlessLoggedIn(): ReqrAndTgt = this
}


/** If the requesterer isn't logged in, e.g. viewing a page in a public forum.
  */
case class ReqrStranger(browserIdData: BrowserIdData) extends AnyReqrAndTgt {
  def anyReqr: Opt[Pat] = None
}


