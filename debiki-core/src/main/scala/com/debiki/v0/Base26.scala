// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package com.debiki.v0

import com.debiki.v0.Prelude._

object Base26 {

  private val zero = 'a'

  private def checkRange(c: Char, str: String) {
    val i = c - zero
    illegalArgIf(i < 0 || i >= 26,
                 "Base 26 character not between 'a' and 'z' "+
                 "[char int value: "+ c.toInt +"]"+
                 (if (str ne null) " [safe-text: "+ safe(str) +"]" else ""))
  }

  def toInt(n26: Char): Int = {
    checkRange(n26, null)
    n26 - 'a'
  }

  def toInt(n26: String): Int = {
    require(!n26.isEmpty, "Base 26 string not empty")
    // fromInt(2147483647) is "gytisyx", 7 chars. Avoid overflow by
    // refusing to convert anything > 6 chars.
    require(n26.length <= 6, "Base 26 string length max 6 characters")
    var total = 0
    var mult = 1
    for (i <- (n26.length - 1) to 0 by -1) {
      val c = n26(i)
      checkRange(c, n26)
      total += (c - zero) * mult
      mult *= 26
    }
    total
  }

  def fromInt(num: Int): String = {
    require(num >= 0)
    var repr26 = ""
    var left = num
    do {
      val remainder = left % 26
      left /= 26
      repr26 = ('a' + remainder).asInstanceOf[Char] + repr26
      // println("rem "+ remainder +"  repr26 "+ repr26 +" left "+ left)
    } while (left > 0)
    repr26
  }

  def after(n26: String): String = fromInt(toInt(n26) + 1)

}
