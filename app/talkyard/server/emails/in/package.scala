package talkyard.server.emails

import com.debiki.core._


package object in {


  case class ParsedReplyEmail(
    messageId: St,
    dateText: St,
    mailboxHash: St,
    sentToAddr: St,
    //sentToName: St,
    //sentToHash: St,
    sentFromAddr: St,
    //sentFromName: St,
    //sentFromHash: St,
    replyTo: St,
    subject: St,
    htmlBody: Opt[St],
    textBody: Opt[St],
    strippedReplyText: Opt[St],
    seemsLikeSpam: Opt[Bo],
    spamScore: Opt[f32],
    attachments: ImmSeq[ParsedAttachment],
    )

  case class ParsedAttachment(
    name: St,  // file name, e.g. "myimage.png"
    contentBase64: St,
    contentType: St,  // e.g. "image/png"
    contentLength: i32,
    contentId: St, // e.g. "myimage.png@01CE7342.75E71F80" — what's that?
    )

}
