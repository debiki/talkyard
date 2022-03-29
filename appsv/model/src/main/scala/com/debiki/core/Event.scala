/**
  * Copyright (c) 2022 Kaj Magnus Lindberg
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

package com.debiki.core

import com.debiki.core.Prelude._


sealed abstract class EventType(val IntVal: i32) { def toInt: i32 = IntVal }

object EventType {
  def fromInt(value: i32): Opt[EventType] = Some(value match {
    case PageEventType.PageCreated.IntVal => PageEventType.PageCreated
    case PageEventType.PageUpdated.IntVal => PageEventType.PageUpdated
    case PostEventType.PostCreated.IntVal => PostEventType.PostCreated
    case PostEventType.PostUpdated.IntVal => PostEventType.PostUpdated
    case PatEventType.PatCreated.IntVal => PatEventType.PatCreated
    //se PatEventType.PatUpdated.IntVal => PatEventType.PatUpdated
    case _ => return None
  })
}


/** An event in Talkyard, e.g. a new or updated page or post, or a new user.
  * An IRL (in-real-life) get together event, can be  IrlEvent instead, or
  * Happening or Meeting or RealEvent?
  */
sealed abstract class Event {
  def id: EventId
  def when: When
  def eventType: EventType
}



sealed abstract class PageEventType(IntVal: i32) extends EventType(IntVal)

object PageEventType {
  case object PageCreated extends PageEventType(3001)  // 3nnn, see [event_id_nrs]
  case object PageUpdated extends PageEventType(3002)
  // PageDeleted? No, that'd be a deletedStatus field change, and a PageUpdated sub event.
  // But this, yes:
  //case object PageHardDeleted extends PageEventType(300n)
  // — because thereafter there are no fields; it's gone.

  // These will be subtypes of PageUpdated events instead:
  // PageDeleted, PageUndeleted, PageClosed, PageReopened, PageAnswered ...
  // — see AuditLogEntryType. Let's reuse it, and rename to ... Page/Post/Pat EventSubtype?
}

case class PageEvent(
  when: When,
  eventType: PageEventType,
  // subTypes: ImmSeq[PageEventSubtype],
  underlying: AuditLogEntry) extends Event {

  def id: EventId = underlying.id
  def pageId: PageId = underlying.pageId getOrDie s"Page event $id has no page id [TyEEV0PAGEID]"
}



sealed abstract class PostEventType(IntVal: i32) extends EventType(IntVal)

object PostEventType {
  case object PostCreated extends PostEventType(4001)  // 4001 — see [event_id_nrs]
  case object PostUpdated extends PostEventType(4002)
}

case class PostEvent(
  when: When,
  eventType: PostEventType,
  //subTypes: ImmSeq[PostEventSubtype],
  underlying: AuditLogEntry) extends Event {

  def id: EventId = underlying.id
  def postId: PostId = underlying.postId getOrDie s"Post event $id has no post id [TyEEV0POSTID]"
}



sealed abstract class PatEventType(IntVal: i32) extends EventType(IntVal)

object PatEventType {
  case object PatCreated extends PatEventType(10001)  // 10 001 — see [event_id_nrs]
  //se object PatUpdated extends PatEventType(10002)  // later
}

case class PatEvent(
  when: When,
  eventType: PatEventType,
  //subTypes: ImmSeq[PatEventSubtype],
  underlying: AuditLogEntry) extends Event {

  def id: EventId = underlying.id
  def patId: PatId = underlying.targetUserId getOrElse underlying.doerId
}



object Event {

  val RelevantAuditLogEntryTypes: Vec[AuditLogEntryType] = Vec(
        AuditLogEntryType.NewPage,
        AuditLogEntryType.PageAnswered,
        AuditLogEntryType.PageUnanswered,
        AuditLogEntryType.PagePlanned,
        AuditLogEntryType.PageStarted,
        AuditLogEntryType.PageDone,
        AuditLogEntryType.PageReopened,
        AuditLogEntryType.PageClosed,
        AuditLogEntryType.UndeletePage,
        AuditLogEntryType.DeletePage,

        AuditLogEntryType.NewReply,
        AuditLogEntryType.NewChatMessage,
        AuditLogEntryType.EditPost,
        AuditLogEntryType.ChangePostSettings,
        // MovePost — hmm, should this be a new webhook event?
        // Or just a PostUpdated event, and sub type MovePost,
        // with a new page id and parent post nr?

        AuditLogEntryType.CreateUser,
        )


  def fromAuditLogItem(logEntry: AuditLogEntry): Opt[Event] = {
    val when = When.fromDate(logEntry.doneAt)

    // ----- Pages

    val PET = PageEventType

    val pageEventType: Opt[PageEventType] = logEntry.didWhat match {
      case AuditLogEntryType.NewPage =>
        Some(PET.PageCreated)

      case AuditLogEntryType.PageAnswered
         | AuditLogEntryType.PageUnanswered
         | AuditLogEntryType.PagePlanned
         | AuditLogEntryType.PageStarted
         | AuditLogEntryType.PageDone
         | AuditLogEntryType.PageReopened
         | AuditLogEntryType.PageClosed
         | AuditLogEntryType.DeletePage
         | AuditLogEntryType.UndeletePage =>
        Some(PET.PageUpdated)

      // Later, with subtypes:
      // case AuditLogEntryType.PageDone =>
      //   Vec(PET.PageClosed, PET.PageDone)
      // ...

      case _ =>
        None
    }

    pageEventType foreach { evType =>
      return Some(PageEvent(when = when, evType, logEntry))
    }

    // ----- Posts

    val postEventType: Opt[PostEventType] = logEntry.didWhat match {
      case AuditLogEntryType.NewChatMessage | AuditLogEntryType.NewReply =>
        Some(PostEventType.PostCreated)
      case AuditLogEntryType.EditPost
           | AuditLogEntryType.ChangePostSettings =>
           // + MovePost etc ...
        Some(PostEventType.PostUpdated)
      case _ =>
        None
    }

    postEventType foreach { evType =>
      return Some(PostEvent(when = when, evType, logEntry))
    }

    // ----- Pats

    val patEventType: Opt[PatEventType] = logEntry.didWhat match {
      case AuditLogEntryType.CreateUser =>
        Some(PatEventType.PatCreated)
      case _ =>
        None
    }

    patEventType foreach { evType =>
      return Some(PatEvent(when = when, evType, logEntry))
    }

    None

    /*
    val resultBuilder = Vec.newBuilder[Event]
    if (postEventSubtypes.nonEmpty) {
      resultBuilder ++= ... map PostEvent(when = when, postEventType, logEntry)
    }
    if (pageEventSubtypes.nonEmpty) {
      resultBuilder ++= ... map PageEvent(when = when, pageEventType, logEntry)
    }
    resultBuilder.result  */
  }
}