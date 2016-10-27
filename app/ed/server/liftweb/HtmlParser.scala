// Copied from
// https://github.com/lift/framework
// commit: 94df3305f44434f9f6c95244a25a4e803549505c
// date: Thu Apr 19 14:52:39 2012 -0500
// file: framework/core/util/src/main/scala/net/liftweb/util/HtmlParser.scala

/*
 * Copyright 2010-2011 WorldWide Conferencing, LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package ed.server.liftweb

import scala.xml.{PCData => _, _}
import parsing._
import java.io._
import nu.validator.htmlparser._
import sax.HtmlParser


object Html5 extends Html5Parser with Html5Writer

trait Html5Writer {
  /**
   * Write the attributes in HTML5 valid format
   * @param m the attributes
   * @param writer the place to write the attribute
   */
  protected def writeAttributes(m: MetaData, writer: Writer) {
    m match {
      case null => 
      case Null =>
      case md if (null eq md.value) => // issue 807. Don't do empty
      case up: UnprefixedAttribute => {
        writer.append(' ')
        writer.append(up.key)
        val v = up.value
        writer.append("=\"")
        val str = v.text
        var pos = 0
        val len = str.length
        while (pos < len) {
          str.charAt(pos) match {
            case '"' => writer.append("&quot;")
            case '<' => writer.append("&lt;")
            case c if c >= ' ' && c.toInt <= 127 => writer.append(c)
            case c if c == '\u0085' =>
              case c => {
                val str = Integer.toHexString(c)
                writer.append("&#x")
                writer.append("0000".substring(str.length))
                writer.append(str)
                writer.append(';')
              }
          }
          
          pos += 1
        }
        
        writer.append('"')          

        writeAttributes(up.next, writer)        
      }

      case pa: PrefixedAttribute => {
        writer.append(' ')
        writer.append(pa.pre)
        writer.append(':')
        writer.append(pa.key)
        val v = pa.value
        if ((v ne null) && !v.isEmpty) {
          writer.append("=\"")
          val str = v.text
          var pos = 0
          val len = str.length
          while (pos < len) {
            str.charAt(pos) match {
              case '"' => writer.append("&quot;")
              case '<' => writer.append("&lt;")
              case c if c >= ' ' && c.toInt <= 127 => writer.append(c)
              case c if c == '\u0085' =>
              case c => {
                val str = Integer.toHexString(c)
                writer.append("&#x")
                writer.append("0000".substring(str.length))
                writer.append(str)
                writer.append(';')
              }
            }

            pos += 1
          }

          writer.append('"')          
        }

        writeAttributes(pa.next, writer)        
      }
        
      case x => writeAttributes(x.next, writer)
    }
  }

  /**
   * Escape text data
   * @param str the String to escape
   * @param the place to send the escaped characters
   */
  protected def escape(str: String, sb: Writer, reverse: Boolean) {
    val len = str.length
    var pos = 0
    while (pos < len) {
      str.charAt(pos) match {
        case '<' => sb.append("&lt;")
        case '>' => sb.append("&gt;")
        case '&' => sb.append("&amp;")
        case '"' => sb.append("&quot;")
        case '\n' => sb.append('\n')
        case '\r' => sb.append('\r')
        case '\t' => sb.append('\t')
        case c   => 
          if (reverse) {
            HtmlEntities.revMap.get(c) match {
              case Some(str) => {
                sb.append('&')
                sb.append(str)
                sb.append(';')
              }
              case _ => 
                if (c >= ' ' && 
                    c != '\u0085' && 
                    !(c >= '\u007f' && c <= '\u0095')) sb.append(c)
            }
          } else {
            if (c >= ' ' && 
                c != '\u0085' && 
                !(c >= '\u007f' && c <= '\u0095')) sb.append(c)
          }
      }

      pos += 1
    }
  }

  /**
   * Convert a Node to a properly encoded Html5 String
   */
  def toString(x: Node): String = {
    val sr = new StringWriter()
    write(x, sr, false, true)
    sr.toString()
  }

  /**
   * Write the Node out as valid HTML5
   *
   * @param x the node to write out
   * @param writer the place to send the node
   * @param stripComment should comments be stripped from output?
   */
  def write(x: Node, writer: Writer, stripComment: Boolean, convertAmp: Boolean): Unit = {
    x match {
      case Text(str) => escape(str, writer, !convertAmp)

      case PCData(data) => {
        writer.append("<![CDATA[")
        writer.append(data)
        writer.append("]]>")
      }

      case scala.xml.PCData(data) => {
        writer.append("<![CDATA[")
        writer.append(data)
        writer.append("]]>")
      }

      case Unparsed(data) => writer.append(data)

      case a: Atom[_] if a.getClass eq classOf[Atom[_]] =>
        escape(a.data.toString, writer, !convertAmp)
      
      case Comment(comment) if !stripComment => {
        writer.append("<!--")
        writer.append(comment)
        writer.append("-->")
      }
      
      case er: EntityRef =>
        HtmlEntities.entMap.get(er.entityName) match {
          case Some(chr) if chr.toInt >= 128 => writer.append(chr)
          case _ => {
            val sb = new StringBuilder()
            er.buildString(sb)
            writer.append(sb)
          }
        }
      
      case x: SpecialNode => {
        val sb = new StringBuilder()
        x.buildString(sb)
        writer.append(sb)
      }
      
      case g: Group =>
        for (c <- g.nodes)
          write(c, writer, stripComment, convertAmp)
      
      case e: Elem if (null eq e.prefix) && 
      Html5Constants.nonReplaceable_?(e.label) => {
        writer.append('<')
        writer.append(e.label)
        writeAttributes(e.attributes, writer)
        writer.append(">")
        e.child match {
          case null => 
          case seq => seq.foreach {
            case Text(str) => writer.append(str)
            case pc: PCData => {
              val sb = new StringBuilder()
              pc.buildString(sb)
              writer.append(sb)
            }
            case pc: scala.xml.PCData => {
              val sb = new StringBuilder()
              pc.buildString(sb)
              writer.append(sb)
            }
            case Unparsed(text) => writer.append(text)
            case a: Atom[_] if a.getClass eq classOf[Atom[_]] =>
              writer.append(a.data.toString)

            case _ =>
          }
        }
        writer.append("</")
        writer.append(e.label)
        writer.append('>')
      }
      
      case e: Elem if (null eq e.prefix) && 
      Html5Constants.voidTag_?(e.label) => {
        writer.append('<')
        writer.append(e.label)
        writeAttributes(e.attributes, writer)
        writer.append(">")
      }
      

      /*
      case e: Elem if ((e.child eq null) || e.child.isEmpty) => {
        writer.append('<')
        if (null ne e.prefix) {
          writer.append(e.prefix)
          writer.append(':')
        }
        writer.append(e.label)
        writeAttributes(e.attributes, writer)
        writer.append(" />")
      }*/
      
      case e: Elem => {
        writer.append('<')
        if (null ne e.prefix) {
          writer.append(e.prefix)
          writer.append(':')
        }
        writer.append(e.label)
        writeAttributes(e.attributes, writer)
        writer.append(">")
        e.child.foreach(write(_, writer, stripComment, convertAmp))
        writer.append("</")
        if (null ne e.prefix) {
          writer.append(e.prefix)
          writer.append(':')
        }
        writer.append(e.label)
        writer.append('>')
      }
      
      case _ => // dunno what it is, but ignore it
    }
  }
}

object Html5Constants {
  val voidTags: Set[String] = Set("area",
                                  "base",
                                  "br",
                                  "col",
                                  "command",
                                  "embed",
                                  "hr",
                                  "img",
                                  "input",
                                  "keygen",
                                  "link",
                                  "meta",
                                  "param",
                                  "source",
                                  "wbr")

  /**
   * Is the tag a void tag?
   */
  def voidTag_?(t: String): Boolean = voidTags.contains(t.toLowerCase)

  /**
   * Is the tag a non-replaceable tag?
   */
  def nonReplaceable_?(t: String): Boolean =
    (t equalsIgnoreCase "script") ||
  (t equalsIgnoreCase "style")
}


/**
 * A utility that supports parsing of HTML5 file.
 * The Parser hooks up nu.validator.htmlparser
 * to 
 */
trait Html5Parser {
  /**
   * Parse an InputStream as HTML5.  A Full(Elem)
   * will be returned on successful parsing, otherwise
   * a Failure.
   */
  def parse(in: InputStream): Option[Elem] = {
      val hp = new HtmlParser(common.XmlViolationPolicy.ALLOW)
      hp.setCommentPolicy(common.XmlViolationPolicy.ALLOW)
      hp.setContentNonXmlCharPolicy(common.XmlViolationPolicy.ALLOW)
      hp.setContentSpacePolicy(common.XmlViolationPolicy.FATAL)
      hp.setNamePolicy(common.XmlViolationPolicy.ALLOW)
      val saxer = new NoBindingFactoryAdapter {
        /*
        override def createNode (pre: String, label: String, attrs: MetaData, scope: NamespaceBinding, children: List[Node]) : Elem = {
          if (pre == "lift" && label == "head") {
            super.createNode(null, label, attrs, scope, children)            
          } else {
            super.createNode(pre, label, attrs, scope, children)
          }
        }*/

        override def captureText(): Unit = {
          if (capture) {
            val text = buffer.toString()
            if (text.length() > 0) {
              hStack.push(createText(text))
            }
	  }
	  buffer.setLength(0)
	}
      }

      saxer.scopeStack.push(TopScope)
      hp.setContentHandler(saxer)
      val is = new InputSource(in)
      is.setEncoding("UTF-8")
      hp.parse(is)

      saxer.scopeStack.pop
      
      in.close()
      saxer.rootElem match {
        case null => None
        case e: Elem => 
          AutoInsertedBody.unapply(e) match {
            case Some(x) => Some(x)
            case _ => Some(e)
          }
        case _ => None
      }
  }

  private object AutoInsertedBody {
    def checkHead(n: Node): Boolean = 
      n match {
        case e: Elem => {
          e.label == "head" && e.prefix == null &&
          e.attributes == Null &&
          e.child.length == 0
        }
        case _ => false
      }
    
    def checkBody(n: Node): Boolean = 
      n match {
        case e: Elem => {
          e.label == "body" && e.prefix == null &&
          e.attributes == Null &&
          e.child.length >= 1 &&
          e.child(0).isInstanceOf[Elem]
        }
        case _ => false
      }
    
    def unapply(n: Node): Option[Elem] = n match {
      case e: Elem => {
        if (e.label == "html" && e.prefix == null &&
            e.attributes == Null &&
            e.child.length == 2 &&
            checkHead(e.child(0)) &&
            checkBody(e.child(1))) {
              Some(e.child(1).asInstanceOf[Elem].child(0).asInstanceOf[Elem])
            } else {
              None
            }
      }
        
      case _ => None
    }
  }

  /**
   * Parse an InputStream as HTML5.  A Full(Elem)
   * will be returned on successful parsing, otherwise
   * a Failure.
   */
  def parse(str: String): Option[Elem] =
    parse(new ByteArrayInputStream(str.getBytes("UTF-8")))
}

