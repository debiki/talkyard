package talkyard.server

import com.debiki.core._
import debiki.dao.SiteDao


package object authz {

  type ForumAuthzContext = AuthzCtxOnForum // backw compat, renaming  CLEAN_UP


  /** Helps us know if the principal may see e.g. pat's user profile or recent activity etc.
    */
  case class PatAndPrivPrefs(
    pat: Pat,
    privPrefsOfPat: MemberPrivacyPrefs,
    patsGroupIds: Vec[GroupId],
    patsGroups: Vec[Group],
    )


  object PrivPrefs {

    /** Returns the users `reqr` may list, and the users' privacy prefs.
      *
      * Maybe which privacy pref to filter on (maySeeMyProfileTrLv right now) could be a param?
      */
    def filterMayList(users: ImmSeq[User], reqr: Pat, dao: SiteDao): ImmSeq[PatAndPrivPrefs] = {
      val allGroups: Vec[Group] = dao.getAllGroups()
      val usersAndPrefs: ImmSeq[PatAndPrivPrefs] = dao.derivePrivPrefs(users, allGroups)
      val usersMayList: ImmSeq[PatAndPrivPrefs] = usersAndPrefs.filter { userPrefs =>
            val isSelf = reqr.id == userPrefs.pat.id
            val maySeeProfilePage =
                  isSelf || userPrefs.privPrefsOfPat.maySeeMyProfileTrLv.forall(
                              _.isAtMost(reqr.effectiveTrustLevel2))
            // Later, will be separate preference:  [list_membs_perm]
            val mayListUser = maySeeProfilePage
            mayListUser
          }
      usersMayList
    }
  }
}
