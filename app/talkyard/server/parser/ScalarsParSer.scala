package talkyard.server.parser

import com.debiki.core._



object ScalarsParSer {

  def parseSignOnId(idMaybe: St): SsoId = {
    if (idMaybe.isEmpty) throwBadInpData("TyE5603MRE245", "Sign-On ID is empty")
    idMaybe
  }

}
