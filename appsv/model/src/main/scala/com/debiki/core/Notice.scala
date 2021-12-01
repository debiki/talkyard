package com.debiki.core

import play.api.libs.json.JsObject

case class Notice(
  siteId: SiteId,
  toPatId: PatId,
  noticeId: NoticeId,
  firstAt: WhenMins,
  lastAt: WhenMins,
  numTotal: i32,
  noticeData: Opt[JsObject],
) {
  // For now, admins only.
  require(toPatId == Group.AdminsId, "TyE40fMJ2W4")
  require(noticeId >= 1001, "TyE5R02MRSEG4")
  require(firstAt.millis <= lastAt.millis, "TyE70SRDE55F")
  require(numTotal >= 1, "TyE70SRDE550")
  require(noticeData.isEmpty, "TyE40fMJ25MG")
}


object Notice {
  val TwitterLoginConfigured = 1001
  val TwitterLoginUsed = 1002
}
