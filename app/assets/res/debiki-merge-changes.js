/* Copyright (c) 2010 - 2012 Kaj Magnus Lindberg. All rights reserved. */


// Finds new/updated versions of posts/edits in newDebateHtml,
// adds them / replaces [the currently displayed but out-of-date versions].
// Highlights the changes done.
// Does not reorder elems currently shown (even if their likeability have
// changed significantly), to avoid surprising the user (by
// shuffling everything around).
// Returns the user's own new post, if any (otherwise, returns undefined).
// {{{ COULD include SHA1:s of each thread, and avoid reloading threads whose
// SHA1 is the same in the server's reply. The server need not upload
// those threads at all — that would require the server to generate
// unique replies to each client.
// The server COULD check SHA1:s from the client, and find all threads
// that has been changed (since the client got its version), and add
// all those threads in an <ul> and upload it. The client would then
// replace threads with the never versions in the <ul> — but keeping old
// subtrees whose SHA1 hadn't been changed.
// The server COULD include a <del data-what='thread-id, thread-id, ...'></del>
// but perhaps not needed — [the parent of each deleted thread] will have
// a new SHA1 and it'll be reloaded automatically.
// }}}
debiki.internal.mergeChangesIntoPage = function(newDebateHtml) {
  var d = { i: debiki.internal };
  var $ = d.i.$;

  // Need to rewrite:
  // 1. Find all new **threads** (ancestors only, don't count subthreads
  //    of new threads).
  // X. Find all recently deleted posts. Threads?! Could ignore for now?
  //    only delete threads on reload?
  // 2. Find all old edited posts.
  // 3. Find all old posts that the user has just rated.
  // 4. Init all new threads. Redraw exactly all SVG arrows?
  //    Or $drawTree for each new thread, and find the union of all
  //    their ancestor threads and redraw them.
  // Y. Also find new flags. (Could ignore for now, only show new flags
  //    on complete reload.)
  // 5. Mark edits, mark own ratings.
  var $curDebate = $('.dw-debate');
  var $newDebate = buildTagFind(newDebateHtml, '.dw-debate');
  var $myNewPost;
  $newDebate.find('.dw-t').each(function(){
      var $i = $(this);
      var parentId = $i.parents('.dw-t').attr('id');
      var $oldParent = parentId ? $curDebate.find('#'+ parentId) : $curDebate;
      var $oldThis = $curDebate.find('#'+ this.id);
      var isNewThread = $oldThis.length === 0;
      var isSubThread = !$oldParent.length;  // BUG, $oldParent might be a
      // recently added *new* thread, but if this is a sub thread of another
      // *new* thread, isSubThread should be true.
      // Effect: new sub threads aren't inited properly it seems, or inits
      // their parents many times.
      var isInline = $i.filter('.dw-i-t').length === 1;
      var $oldPost = $oldThis.children('.dw-p');
      var $newPost = $i.children('.dw-p');
      var oldDate = $oldPost.dwLastChange();
      var newDate = $newPost.dwLastChange();
      var isPostEdited = !isNewThread && newDate > oldDate;
      // You can undo changes to a post, and revert it to an earlier version,
      // too. COULD use as newDate the point in time when the post was
      // reverted, so newDate would be > oldDate. Otherwise people might
      // reply to a newer version, but then it's reverted to an old version,
      // and the *old* date wold be shown, causing confusion: the replies
      // would seemingly reply to the *old* version. For now though:
      var isPostReverted = !isNewThread && newDate < oldDate;
      // BUG: If >= 2 edits were applied at the same time, newDate won't be
      // affected if you revert just one of them, so isPostReverted will
      // be false and the changes won't take effect until after page reload.
      // (Don't fix that bug. I'll probably rewrite, so one can undo only
      // the last edit applied, and not revert, but *reverse*, other edits,
      // I mean, apply it again but "inverted" so it undoes itself. Then
      // the modification date would always increase and the bug is no more.)
      var oldRatsModTime =
          $oldPost.find('> .dw-p-hd > .dw-p-r-all').attr('data-mtime');
      var newRatsModTime =
          $newPost.find('> .dw-p-hd > .dw-p-r-all').attr('data-mtime');
      var hasNewRatings =
          (!oldRatsModTime ^ !newRatsModTime) ||
          (newRatsModTime > oldRatsModTime);
      if (isPostEdited || isPostReverted) {
        $newPost
          .replaceAll($oldPost)
          .addClass('dw-m-p-edited'); // outlines it
        // BUG? New/edited child posts aren't added? Can't simply replace
        // them with newer versions — what would then happen if the user
        // has opened an edit form for those posts?
        $newPost.each(d.i.$initPost);
      }
      else if (isNewThread && !isSubThread) {
        // (A thread that *is* a sub-thread of another new thread, is added
        // automatically when that other new thread is added.)
        // BUG: isSubThread might be false, although the thread is a sub
        // thread of a new thread. So below code is sometimes (depending on
        // which thread is first found) incorrectly run
        // on sub threads.

        // Indicate that this is a new thread.
        $i.addClass('dw-m-t-new') // outlines all posts in thread

        // Place the new thread, $i, next to the thread to the left.
        // But we need to look it up, so we get the one in the document
        // (rather than the one in the html from the server).
        var prevId = $i.prev().attr('id');
        if (prevId) {
          var $prevThread = $('#'+ prevId);
          $prevThread.after($i)
        }
        else {
          // There's no thread to the left of $i, so append $i
          // to the parent thread's .dw-res.
          var $res = $oldParent.children('.dw-res');
          if (!$res.length) {
            // This is the first reply; create the reply list.
            $res = $("<ol class='dw-res'/>").appendTo($oldParent);
          }
          $i.appendTo($res);
        }

        if (isInline) {
          // Place this inline thread inside its parent, by
          // undoing the parent's inline thread placement and doing
          // it again, with the new thread included.
          $oldParent.children('.dw-p')  // BUG $oldParent might be a new thread
            .each(d.i.$undoInlineThreads)   // (see below)
            .each(d.i.$initPost);
          // BUG: $oldParent might be a new thread, because when
          // 
          // BUG add an inline reply to an inline child post (i.e. add an
          // inline grandchild), and then $oldParent won't be redrawn.
        }
        // COULD avoid redrawing the same posts over and over again,
        // by inserting stuff to redraw in a map? and remove from the
        // map all posts whose parents are already in the map.
        // (Currently e.g. arrows from the root post are redrawn once
        // per new thread, since $drawParents is used below.)
        $i.each(d.i.SVG.$drawTree); // not $drawPost; $i might have child threads
        $newPost.each(d.i.$initPostsThread);
        // Draw arrows from the parent post to its new child post,
        // *after* $newPost has been initialized, because $newPost' size
        // changes somewhat when it's inited. If some parent is an inline
        // post, *its* parent might need to be redrawn. So redraw all parents.
        $newPost.each(d.i.SVG.$drawParents);
        if (d.i.Me.getUserId() === $newPost.dwAuthorId()) {
          $myNewPost = $newPost;
        }
      } else if (hasNewRatings) {
        // Update rating info for this post.
        // - All branches above automatically update ratings.
        // - The old post might have no rating info at all (if there were
        //   no ratings). So don't attempt to replace old elems with new
        //   ones; instead remove any old elems and append the new ones to
        //   the post creation timestamp, .dw-p-at, which exists for sure.
        // - Show() the new .dw-p-r-all, so the user notices his/her own
        //   ratings, highlighted.
        var $newHdr = $newPost.children('.dw-p-hd');
        $oldPost.children('.dw-p-hd')
            .children('.dw-p-r-top, .dw-p-r-all').remove().end()
            .children('.dw-p-at').after(
                $newHdr.children('.dw-p-r-top').show()).end()
            .append(
                $newHdr.children('.dw-p-r-all').show());
      }
      else {
        // This post has not been changed, keep it as is.
      }

      // BUG $initPost is never called on child threads (isSubThread true).
      // So e.g. the <a ... class="dw-as">React</a> link isn't replaced.
      // BUG <new-post>.click($showReplyForm) won't happen
    });

  return $myNewPost;
}


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
