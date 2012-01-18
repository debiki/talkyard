/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package com.debiki.v0

import Prelude._
import TemplateToExtend.ExtendParentFolderTmpl


object TemplateParams {
  val Default = TemplateParams(
    templateToExtend = Some(ExtendParentFolderTmpl),
    commentVisibility = Some(CommentVisibility.Visible)
  )
}


case class TemplateParams(
  /** Which parent template this page should be included in. */
  templateToExtend: Option[TemplateToExtend],
  /** Specifies how/if comments should be shown. */
  commentVisibility: Option[CommentVisibility]
){
  def mergeOverride(otherParams: TemplateParams) = TemplateParams(
    templateToExtend.orElse(otherParams.templateToExtend),
    commentVisibility.orElse(otherParams.commentVisibility)
  )
}


/** Utility class, useful e.g. when you parse many params but don't know
 *  exactly which, and want to construct an (immutable) TemplateParams.
 */
class TemplateParamsMutable {
  var templateToExtend: Option[TemplateToExtend] = None
  var commentVisibility: Option[CommentVisibility] = None

  def toImmutable = TemplateParams(
    templateToExtend,
    commentVisibility
  )
}


sealed abstract class TemplateToExtend


object TemplateToExtend {
  val ParamName = "extend_template"

  case object ExtendParentFolderTmpl extends TemplateToExtend {
    val ParamValue = "parent"
  }

  case object ExtendNoTemplate extends TemplateToExtend {
    val ParamValue = "none"
  }

  case class ExtendSpecificTmpl(path: String) extends TemplateToExtend

  def parse(paramValue: String): TemplateToExtend = {
    paramValue match {
      case "none" => ExtendNoTemplate
      case path =>
        // Could ensure any template contains some '/' or it's an error
        // for sure?
        // ExtendSpecificTmpl(path)
        unimplemented("Extending specific template [debiki_error_6y8Cw35]")
      //case "??what??" => ExtendParentFolderTmpl
    }
  }
}


sealed abstract class CommentVisibility


object CommentVisibility {
  val ParamName = "comment_visibility"

  case object Visible extends CommentVisibility {
    val ParamValue = "visible"
  }

  case object ShowOnClick extends CommentVisibility {
    val ParamValue = "show_on_click"
  }

  def parse(paramValue: String): CommentVisibility = {
    paramValue match {
      case Visible.ParamValue => Visible
      case ShowOnClick.ParamValue => ShowOnClick
      case "hidden" => unimplemented("comment_visibility: hidden", "DwE0Kn31")
      case x => illArgErr(
        "Bad comment_visibility value: "+ safed(x), "DwE03R24")
    }
  }
}


/** Is Default+Custom better that Option+None?
sealed abstract class ParamValue[T]
case class Default[T](value: T) extends ParamValue[T](value)
case class Custom[T](value: T) extends ParamValue[T](value)

case class TemplateParams(
  templateToExtend: ParamValue[TemplateToExtend] =
    Default(ExtendParentFolderTmpl),
  commentVisibility: ParamValue[CommentVisibility] =
    Default(CommentVisibility.Visible)
){
  def mergeOverride(otherParams: TemplateParams) = TemplateParams(
    _merge(templateToExtend, otherParams.templateToExtend),
    _merge(commentVisibility, otherParams.commentVisibility)
  )

  private def _merge[T](thisVal: ParamValue[T], otherVal: ParamValue[T]) = {
    thisVal match {
      case c: Custom[T] => c
      case d: Default[T] => otherVal // (other could be default too)
    }
  }
} */


