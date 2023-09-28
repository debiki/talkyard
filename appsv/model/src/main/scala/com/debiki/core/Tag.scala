package com.debiki.core

import Prelude._


case class Tag(
  id: TagId,
  tagTypeId: TagTypeId,
  parentTagId_unimpl: Opt[TagId], //  later
  onPatId: Opt[PatId],
  onPostId: Opt[PostId],
  valType: Opt[TypeValueType],
  valInt32: Opt[i32],
  valFlt64: Opt[f64],
  valStr: Opt[St],
)(mab: MessAborter) extends MaybeValue {
  import mab.{check, abort}
  // The id is NoTagId when getting created, before has an id.
  assert(NoTagId == 0, "TyE603MESGW")
  check(id >= NoTagId, "TyE5GMRA25")
  // The tag type id must already exist.
  check(tagTypeId > NoTagTypeId, "TyE5GMRA26")
  check(parentTagId_unimpl.isEmpty, "TyE70MUGT843", "Nested tags not implemented")
  check(onPatId.isDefined != onPostId.isDefined, "TyE2J3MRD2")
  check(onPatId isNot NoUserId, "TyE9J370S7")
  check(onPostId.forall(_ >= BodyNr), "TyE9J370S8")

  // For now. Worried about how "too long" tag values could affect performance & bandwidth.
  check(valStr.forall(_.length < 70), "TyETAGVAL2LONG", s"Too long tag value string")

  _anyValueAndValueTypeErr foreach { err =>
    abort("TyETAGVALTYP02", err.toMsgCodeStr)
  }

  private def _numValFieldsSet: i32 =
    valInt32.oneIfDefined + valFlt64.oneIfDefined + valStr.oneIfDefined

  def hasValue: Bo = valType.isDefined
}


/** For when tag id not yet known (tag not yet created), and post id too might
  * not yet be known — if the-post-to-tag is being created at the same time.
  */
case class TagTypeValue(
  tagTypeId: TagTypeId,
  // parentTagId_unimpl: Opt[TagId],
  valType: Opt[TypeValueType],
  valInt32: Opt[i32],
  valFlt64: Opt[f64],
  valStr: Opt[St],
)(mab: MessAborter) extends MaybeValue {

  _anyValueAndValueTypeErr foreach { err =>
    mab.abort("TyETAGVALTYP01", err.toMsgCodeStr)
  }

  def withIdAndPostId(id: TagId, postId: PostId, mab: MessAborter): Tag =
    Tag(id = id,
          tagTypeId = tagTypeId,
          parentTagId_unimpl = None,
          onPatId = None,
          onPostId = Some(postId),
          valType = valType,
          valInt32 = valInt32,
          valFlt64 = valFlt64,
          valStr = valStr)(mab)
}

