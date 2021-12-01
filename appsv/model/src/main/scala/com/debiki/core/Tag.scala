package com.debiki.core

import Prelude._


case class TagType(
  id: TagTypeId,
  canTagWhat: i32,
  urlSlug_unimpl: Opt[St], // later
  dispName: St,
  createdById: PatId,
)(mab: MessAborter) {
  import mab.check
  // The id is NoTagTypeId when getting created, before has an id.
  assert(NoTagTypeId == 0, "TyE603MESGW")
  check(id >= NoTagTypeId, "TyE4MR507")
  check(urlSlug_unimpl.isEmpty, "TyE70MUGT842", "Tag url slugs not implemented")
  check(dispName.isTrimmedNonEmpty, "TyE06MWEP3")
  check(canTagWhat == TagType.CanTagAllPats || canTagWhat == TagType.CanTagAllPosts,
        "TyE4062MW5", s"canTagWhat must be ${TagType.CanTagAllPats} or ${
        TagType.CanTagAllPosts}")
}


case class Tag(
  id: TagId,
  tagTypeId: TagTypeId,
  parentTagId_unimpl: Opt[TagId], //  later
  onPatId: Opt[PatId],
  onPostId: Opt[PostId],
)(mab: MessAborter) {
  import mab.check
  // The id is NoTagId when getting created, before has an id.
  assert(NoTagId == 0, "TyE603MESGW")
  check(id >= NoTagId, "TyE5GMRA25")
  // The tag type id must already exist.
  check(tagTypeId > NoTagTypeId, "TyE5GMRA26")
  check(parentTagId_unimpl.isEmpty, "TyE70MUGT843", "Nested tags not implemented")
  check(onPatId.isDefined != onPostId.isDefined, "TyE2J3MRD2")
  check(onPatId isNot NoUserId, "TyE9J370S7")
  check(onPostId.forall(_ >= BodyNr), "TyE9J370S8")
}


object TagType {
  val CanTagAllPats = 7
  val CanTagAllPosts = 56
}
