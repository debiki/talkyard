package talkyard.server.parser

import com.debiki.core._
import com.debiki.core.Prelude.classNameOf
import java.util.{Map => j_Map}



object MapParSer {

  def parseSt(map: j_Map[St, AnyRef], fieldName: St): St = {
    parseOptSt(map, fieldName) getOrElse {
      throwBadInpData("TyEPARMAP0ST_", s"Field missing: '$fieldName', should be text")
    }
  }


  def parseOptSt(map: j_Map[St, AnyRef], fieldName: St): Opt[St] = {
    val value: AnyRef = map.get(fieldName)
    if (value eq null) return None
    throwBadInpDataIf(!value.isInstanceOf[St], "TyE740MGE3M",
          s"'$fieldName' is not text, but a ${classNameOf(value)}")
    Some(value.asInstanceOf[St])
  }


  def parseOptBo(map: j_Map[St, AnyRef], fieldName: St): Opt[Bo] = {
    val value: AnyRef = map.get(fieldName)
    if (value eq null) return None
    throwBadInpDataIf(!value.isInstanceOf[Bo], "TyE5WM3GM6A2",
          s"'$fieldName' is not a boolean, but a ${classNameOf(value)}")
    Some(value.asInstanceOf[Bo])
  }


  def parseInt64(map: j_Map[St, AnyRef], fieldName: St): i64 = {
    parseOptInt64(map, fieldName) getOrElse {
      throwBadInpData("TyE60RSM2", s"Field missing: '$fieldName', should be an integer")
    }
  }


  def parseOptInt64(map: j_Map[St, AnyRef], fieldName: St): Opt[i64] = {
    val value: AnyRef = map.get(fieldName)
    if (value eq null) None
    else if (value.isInstanceOf[i32]) Some(value.asInstanceOf[i32].toLong)
    else if (value.isInstanceOf[i64]) Some(value.asInstanceOf[i64])
    else if (value.isInstanceOf[i8]) Some(value.asInstanceOf[i8].toLong)
    else if (value.isInstanceOf[i16]) Some(value.asInstanceOf[i16].toLong)
    else if (value.isInstanceOf[u16]) Some(value.asInstanceOf[u16].toLong)
    else throwBadInpData("TyEJ205MM6AH",
          s"'$fieldName' is not an integer, but a ${classNameOf(value)}")
  }


  def parseNestedMap(map: j_Map[St, AnyRef], fieldName: St): j_Map[St, AnyRef] = {
    parseOptNestedMap(map, fieldName) getOrElse {
      throwBadInpData("TyEPARMAP0MAP_",
            s"Field missing: '$fieldName', should be a nested map")
    }
  }


  def parseOptNestedMap(map: j_Map[St, AnyRef], fieldName: St): Opt[j_Map[St, AnyRef]] = {
    val value: AnyRef = map.get(fieldName)
    value match {
      case null => None
      case m: j_Map[St, AnyRef] => Some(m)
      case _ =>
        throwBadInpData("TyE603MATE24",
              s"'$fieldName' is not a nested map, but a ${classNameOf(value)}")
    }
  }

}
