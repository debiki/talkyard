/**
  * Copyright (c) 2017 Kaj Magnus Lindberg
  *
  * This program is free software: you can redistribute it and/or modify
  * it under the terms of the GNU Affero General Public License as
  * published by the Free Software Foundation, either version 3 of the
  * License, or (at your option) any later version.
  *
  * This program is distributed in the hope that it will be useful,
  * but WITHOUT ANY WARRANTY; without even the implied warranty of
  * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  * GNU Affero General Public License for more details.
  *
  * You should have received a copy of the GNU Affero General Public License
  * along with this program.  If not, see <http://www.gnu.org/licenses/>.
  */

package ed.stackdriver

import ch.qos.logback.classic.spi.{ILoggingEvent, ThrowableProxy}
import ch.qos.logback.core.{CoreConstants, LayoutBase}
import org.apache.commons.lang3.exception.ExceptionUtils
import play.api.libs.json._
import com.debiki.core.Prelude.toIso8601T


class StackdriverLayout extends LayoutBase[ILoggingEvent] {

  /** Google StackDriver wants:
    * (see: https://cloud.google.com/error-reporting/docs/formatting-error-messages )
    *
    *  {
    *    "eventTime": string,
    *    "serviceContext": {
    *      "service": string,     // Required.
    *      "version": string
    *    },
    *    "message": string,       // Required. Should contain the full exception
    *                             // message, including the stack trace.
    *    "context": {
    *      "httpRequest": {
    *        "method": string,
    *        "url": string,
    *        "userAgent": string,
    *        "referrer": string,
    *        "responseStatusCode": number,
    *        "remoteIp": string
    *      },
    *      "user": string,
    *      "reportLocation": {    // Required if no stack trace in 'message'.
    *        "filePath": string,
    *        "lineNumber": number,
    *        "functionName": string
    *      }
    *    }
    *  }
    */
  override def doLayout(event: ILoggingEvent): String = {

    /*
    var totalJson = Json.obj(
      "logName" -> "projects/talkyard/logs/theLog",
      // I don't know what this is. "resource" -> Json.obj(
      // "type" -> "ed-app")),

      "timestamp" -> toIso8601(event.getTimeStamp),
      "severity" -> event.getLevel.levelStr)

      //"insertId": string,
      //"httpRequest": {
      //  object(HttpRequest)
      //},
      //"labels": {
      //  string: string,
      //  ...
      //},
      //"operation": {
      //  object(LogEntryOperation)
      //},
      //"trace": string,
      //"sourceLocation": {
      //  object(LogEntrySourceLocation)
      //},

      // Union field payload can be only one of the following:
      //"protoPayload": {
      //  "@type": string,
      //  field1: ...,
      //  ...
      //},
      //"jsonPayload": ...,
      //"textPayload": string,
    */
    val anyThrowableProxy = event.getThrowableProxy
    val (isErrorOrWarning: Boolean, message: String) =
      anyThrowableProxy match {
        case p: ThrowableProxy =>
          (true, event.getFormattedMessage + "\n" + ExceptionUtils.getStackTrace(p.getThrowable))
        case _ =>
          if (event.getLevel.levelInt >= ch.qos.logback.classic.Level.WARN_INT)
            (true, event.getFormattedMessage)
          else
            (false, event.getFormattedMessage)
      }
    /*

    val jsonPayload =
      if (isErrorOrWarning)
        totalJson += "jsonPayload" -> makeErrorOrWarningJson(event, message)
      else
        totalJson += "textPayload" -> message

    totalJson.toString + CoreConstants.LINE_SEPARATOR
    */

    val json =
      if (isErrorOrWarning)
        makeErrorOrWarningJson(event, message)
      else
        makeNormalJson(event, message)

    json.toString + CoreConstants.LINE_SEPARATOR
  }


  def makeErrorOrWarningJson(event: ILoggingEvent, message: String): JsObject = {
    // Expensive. Not sure if can be null or empty?
    val callerData = event.getCallerData
    val reportLocationJson =
      if ((callerData ne null) && callerData.nonEmpty) {
        val stackFrame = callerData(0)
        Json.obj(
          "filePath" -> stackFrame.getFileName,
          "lineNumber" -> stackFrame.getLineNumber,
          "functionName" -> stackFrame.getMethodName,
          "className" -> stackFrame.getClassName)
      }
      else JsNull

    var json = makeKvsJson(event)
    json += "eventTime" -> JsString(toIso8601T(System.currentTimeMillis()))
    json += "message" -> JsString(message)
    json += "severity" -> JsString(event.getLevel.levelStr)
    json += "serviceContext" -> Json.obj(
       "service" -> "talkyard-app",
       // COULD read version from 'event' somehow?
       // Or update via 'sed' from inside s/bump-versions.sh? [0AMJQ2]
       "version" -> "0.0.1")
    json += "context" -> Json.obj("reportLocation" -> reportLocationJson)
    json
  }


  def makeNormalJson(event: ILoggingEvent, message: String): JsObject = {
    var json = makeKvsJson(event)
    json += "message" -> JsString(message)
    json += "severity" -> JsString(event.getLevel.levelStr)
    json
  }


  private def makeKvsJson(event: ILoggingEvent): JsObject = {
    var json = Json.obj()
    if (event.getArgumentArray ne null) {
      event.getArgumentArray.map(_ match {
        case m: net.logstash.logback.marker.ObjectAppendingMarker =>
          json += m.getFieldName -> JsString(m.toString) // FOR NOW. Later, apparently *must* use same Json builder as Logback :-( otherwise all get-value stuff = hidden, private.
        case m: net.logstash.logback.marker.SingleFieldAppendingMarker =>
          json += m.getFieldName -> JsNull
        case _ =>
        // What is this
      })
    }
    json
  }
}


