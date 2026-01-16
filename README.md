<!--
Old GitHub one-line description:
- Discussion forums with Question & Answers and Team Chat features. Plus embedded comments for your blog.

Current:
- Open source StackOverflow, Slack, Discourse, Reddit, Disqus hybrid — for your online community.

Other alternatives?:
- Community software, brings together the best from StackOverflow + Slack + Reddit + Discourse.
- Online community software. Find ideas and answers together, and pick the right things
to do, to change society, or grow your startup.
-->


Talkyard
=============================

Forum software, with chat, and anonymous comments.

- Thoughtful discussions. &thinsp;Insightful comments rise to the top.
- Upvote ideas. &thinsp;Sort by votes.
- Question-Answers. &thinsp;Discuss, select an answer.
- Chat channels. &thinsp;Pretty basic features.
- Blog comments. &thinsp;Listen to your readers.

<!-- Community discussion platform, or Structured discussion platform? A/B test?
Or "Structured discussions, for your community — Talkyard brings together ..." ?
A structured discussions platform — brings together the main features from
StackOverflow, Slack, Discourse, Reddit/HackerNews, and Disqus blog comments.
 -->

<!--
Create a place to talk,
where your audience find answers to their questions, and discuss ideas.<br>
Place it at `talkyard.Your-Website.org`.

 - **Solve problems** step by step, in traditional flat forum topics.

 - **Save time.** People find help "instantly", in Question & Answers topics.
 - **Crowdsource feedback and ideas.** Discuss, upvote, choose the right things to do.
 - **Collaborate,** in team chats.
 - **Talk with your blog readers,** in embedded comments.

For your co-workers / customers /
students / volunteers /
contributors / users.

You can use Slack and Mattermost etc for day to day teamwork,
combined with Talkyard for the more important discussions
that you want to find in a nice-to-read format, months and years later.

Or use Talkyard for customer support, or for schools and students helping each other.
-->

How does it compare with other software? &thinsp;
<a href="https://business.talkyard.io/compare/">Find out here</a>.<!--
StackOverflow for Teams, Discourse, Slack, Facebook Groups, Disqus? -->  
**Self-Hosting:**&thinsp; See [talkyard-prod-one](https://github.com/debiki/talkyard-prod-one/tree/ty-prod-one-v1) <!-- Or use our hosting service: https://www.talkyard.io. -->  
**Demo:**&thinsp; https://insightful.demo.talkyard.io  
**Discussion forum:**&thinsp; https://forum.talkyard.io  
**Documentation:**&thinsp; https://docs.talkyard.io (incomplete)<!--
Features: Copy a https://www.talkyard.io/compare/(something) page and show only Ty? -->  
**Development:**&thinsp; That's this repo! See: [docs/developing-talkyard.md](./docs/developing-talkyard.md)

<!-- Immich has these links:  https://github.com/immich-app/immich
        Documentation
        About
        Installation
        Roadmap
        Demo    (although there's a Demo paragraph just below!)
        Features   (although there's a Features list just below)
        Translations
        Contributing -->


<!--
For your students / volunteers / colleagues / customers / donors /
open source users / city / community. -->


<!--
 - **Improve your API docs**, by embedding comments at the end of each docs page, to make it easy for people to ask and tell you if something is unclear.
   -->

<!-- (The staff configure the topic type just once, in a per category setting.) -->

<!--
Use Talkyard for your workplace, as a self building FAQ. Or for customer support.
Or for your teachers and students, to help each other. Or your non-profit volunteers.
Or an open source project and its users.
We'd like to build a tool tha *people who change the world or their neighborhood* can use
to solve problems and pick the right things to do. That's why we have
find-solutions Question-Answers topics, and HackerNews & Reddit type topics
where good ideas rise to the top.<! - — And you can use this tool,
for your workplace and your colleagues & customers,
or your non-profit and its volunteers,
or an open source project and its users,
or a school and its students, etc.  -->

<!--
Talkyard (formerly EffectiveDiscussions) is discussion forum software, with chat and question-answers features.
And embedded comments for static websites / blogs.
Inspired by Discourse, Slack, StackOverflow, Reddit and Hacker News, Disqus. -->


<!--
### Project size

It's sort of possible for one person to understand all of Talkyard —
as May 2021, `https://github.com/boyter/scc` says
Talkyard is 140 000  (111 359 + 32 653 = 144 012) lines of code and comments
(excluding blank lines).   **and** that was with some other changes, different branch.
Plus about 60 000 (59 425) lines test code.
Server side code complexity: 5538, client side (a React.js web app): 8478.

scc modules/ed-core/src  modules/ty-dao-rdb/src/ client/app-* client/embedded-comments/  client/serviceworker/  client/*.ts  app/  s/  Makefile to-talkyard/src/  gulpfile.js images/web/ty-lua/  images/web/*.conf  images/app/Dockerfile.*  images/rdb/

scc tests/

-->


Features
-----------


### Good comments rise to the top

Find the interesting stuff, also in big discussions.
<br/><br/>

<table><tr><td>
<img src="https://raw.githubusercontent.com/debiki/ty-media/refs/heads/p/m/9/for-docs/2017--estimate-unfamiliar-task.jpg" />
</td></tr></table>

<!-- SVG doesn't seem to work at GitHub:
<svg width="100%" height="600" xmlns="www.w3.org">
  <rect x="0" y="0" width="100%" height="100%" fill="#222" stroke="none" stroke-width="2"/>
  <image y="3%" href="... something ..." width="100%" height="94%" />
</svg> -->


<!--
![Question and Answers](https://raw.githubusercontent.com/debiki/talkyard-media/bf78d26ec3f4da976d9c694a660d40b718d86043/for-docs/2018-08-19-question-ex.jpeg "Question-Answers")
![Question and Answers](/images/web/ty-media/for-docs/2018-08-19-question-ex.jpeg?raw=true "Question-Answers") -->

<!--
![how-work-from-home-vpn-broken-borders](https://user-images.githubusercontent.com/7477359/44306101-0041eb80-a388-11e8-92e8-b8d417c47139.jpg)
-->


### Tags with values

Create your own tags with **values**, list and sort by value.

For example, a _priority_ tag: `tags:priority:desc>2 is:open`,
here: https://forum.talkyard.io/-/search?q=tags:priority:desc%3E2+is:open
<br/>
<br/>


### Upvote ideas

<table><tr><td>
<img src="https://raw.githubusercontent.com/debiki/ty-media/refs/heads/p/m/9/for-docs/upvote-ideas--aqua-planet-mind-writing-b0a--blue-marks--dimmed.png" />
</td></tr></table>
<br/>

<table><tr><td>
<img src="https://raw.githubusercontent.com/debiki/ty-media/refs/heads/p/m/9/for-docs/2026-01--upvote-ideas-settings.png" />
</td></tr></table>
<br/>


### Anonymous comments

So e.g. students can post embarassing questions. Or for anonymous feedback, etc.

<table><tr><td>
<img src="https://raw.githubusercontent.com/debiki/ty-media/refs/heads/p/m/9/for-docs/2026-01--anon-disc.png" />
</td></tr></table>
<br/>

<table><tr><td>
<img src="https://raw.githubusercontent.com/debiki/ty-media/refs/heads/p/m/9/for-docs/2026-01--anon-never-always-menu.png" />
</td></tr></table>
<br/>

<table><tr><td>
<img src="https://raw.githubusercontent.com/debiki/ty-media/refs/heads/p/m/9/for-docs/2026-01--anon-purpose-menu.png" />
</td></tr></table>
<br>


### Chat

Notifications via email, as of now.

<table><tr><td>
<!-- /images/web/ty-media/for-docs/2017-09-12-chat-ex.jpeg -->
<img src="https://raw.githubusercontent.com/debiki/ty-media/bf78d26ec3f4da976d9c694a660d40b718d86043/for-docs/2017-09-12-chat-ex.jpeg" alt="A chat channel"/>
</td></tr></table>
<br>

<!--
![ed-e2e-chat-owen-maria](https://cloud.githubusercontent.com/assets/7477359/19674424/608c49aa-9a88-11e6-8ccd-c2e7ceebd0c2.jpg)
-->

<!--
![Q&A about how to wake up on time](https://user-images.githubusercontent.com/7477359/39368115-0549fad0-4a39-11e8-9bba-703d595d2b96.jpg)
-->
<!--
Hacker News / Reddit style discussion:
![ed-discussion-semantics-of-upvote-2013](https://cloud.githubusercontent.com/assets/7477359/19650769/bea906aa-9a0a-11e6-8ea2-9ad771981f46.jpg)
-->

<!--
**Admin-getting-started guide:**

![ed-admin-intro-guide](https://cloud.githubusercontent.com/assets/7477359/19679591/99a12098-9aa2-11e6-8b65-705c2548cbea.jpg)
<br>
-->

### Users online

![ed-online-users](https://cloud.githubusercontent.com/assets/7477359/19680424/f0353f86-9aa5-11e6-84d9-94d46f228b93.jpg)
<br>


### Avoid mistakes

There's a _Disagree_ button. <!-- See if others disagree with something. so you can avoid following the wrong advice. -->

<table><tr><td>
<img src="https://raw.githubusercontent.com/debiki/ty-media/refs/heads/p/m/9/for-docs/penguins-can-fly.jpg"/>
</td></tr></table>
 
<!--
![Avoid mistakes](https://raw.githubusercontent.com/debiki/ty-media/refs/heads/p/m/9/for-docs/penguins-can-fly.jpg)
![Avoid mistakes](https://tyw-49f8.kxcdn.com/-/u/e7ef490a72/2/m/nu/zecljq7vwtuyxqfabsjwqzg6bfmyvr.jpg) -->
<br>

### Big discussions

**Find new replies** by clicking **Recent** in the sidebar,
when you return to a discussion a day later.

<!--
(But at GitHub, Reddit, HackerNews, you need to skim the whole discussion
from top to bottom to see if anything new has appeared.) -->

<table><tr><td>
<img src="https://raw.githubusercontent.com/debiki/talkyard-media/bf78d26ec3f4da976d9c694a660d40b718d86043/for-docs/2019-08-10-recent-replies-ex-anon-arw.jpg" />
</td></tr></table>

<!--
![Recent replies](https://raw.githubusercontent.com/debiki/talkyard-media/bf78d26ec3f4da976d9c694a660d40b718d86043/for-docs/2019-08-10-recent-replies-ex-anon-arw.jpg "Recent replies")
-->

**Jump to the parent comment** and back:

<!-- Doesn't work:
https://raw.githubusercontent.com/debiki/ty-media/refs/heads/p/m/9/for-docs/jump-and-save-time.mp4
<video width="500" data-height="260"
  src="https://raw.githubusercontent.com/debiki/ty-media/refs/heads/p/m/9/for-docs/jump-and-save-time.mp4"></video>
But uploading via GitHub's user interface works:  (url must be in its own paragraph)  -->

https://github.com/user-attachments/assets/fc1b34d7-75e3-4baf-95e1-8de364cdfdf2

<br/>


### Topic list

<!--
![topic-list-borders](https://user-images.githubusercontent.com/7477359/44306130-a3930080-a388-11e8-9cbc-e569f5ddb7a1.jpg)
 the old demo forum looks better? so use instead.  -->

![Topics list](https://raw.githubusercontent.com/debiki/ty-media/refs/heads/p/m/9/for-docs/2019-08-10-idea-topics-list-ex.jpg "Topics list")

<!--
![ideas-topics](https://raw.githubusercontent.com/debiki/talkyard-media/bf78d26ec3f4da976d9c694a660d40b718d86043/for-docs/2019-08-10-idea-topics-list-ex.jpg "Topics list")
-->
<!--
![ideas-topics](/images/web/ty-media/for-docs/2019-08-10-idea-topics-list-ex.jpg?raw=true "Topics list")

![ed-demo-forum-index](https://cloud.githubusercontent.com/assets/7477359/19650764/bb3a1450-9a0a-11e6-884d-d23c93476db3.jpg) -->

<br>


### Blog comments

Like Disqus — but no ads, no tracking. Configure in the Admin Area | Settings | Embedded Comments. Read more here: https://blog-comments.talkyard.io
<!--
There's a Disqus importer — talk with us [in the forum](https://www.talkyard.io/forum/) if you want to migrate from Disqus to Talkyard.
-->

<table><tr><td>
<img src="https://raw.githubusercontent.com/debiki/talkyard-media/bf78d26ec3f4da976d9c694a660d40b718d86043/for-docs/2019-02-21-blog-comments-ex-anon.jpg" />
</td></tr></table>

<!--
![blog comments](https://raw.githubusercontent.com/debiki/talkyard-media/bf78d26ec3f4da976d9c694a660d40b718d86043/for-docs/2019-02-21-blog-comments-ex-anon.jpg "Blog comments")
![blog comments](/images/web/ty-media/for-docs/2019-02-21-blog-comments-ex-anon.jpg?raw=true "Blog comments")
-->
<br>

<!-- Now implemented, see Anonymous Comments above.
### Embarrassing questions, creative ideas:

Let your students ask anonymous questions. Maybe they feel ashamed for not knowing?
— Or let your co-workers submit ideas and feedback, anonymously.
Maybe they feel worried their ideas has crossed the border from Creative to Crazy?
They can un-anonymize themselves later if they want to (per page).
(Anonymous posting first needs to be enabled, by admins.
Here you can read more: https://www.talkyard.io/-239/is-there-anonymous-messages-support-for-the-full-talkyard )

Anonymous posts has been implemented, but not code reviewed and merged.

![Post anonymously](https://raw.githubusercontent.com/debiki/talkyard-media/bf78d26ec3f4da976d9c694a660d40b718d86043/for-docs/2019-08-10-editor-post-anonymously-ex-arw.jpg "Post anonymously")
-->



Old Code
-----------------------------

Old code from before January 2015 is available here:
https://github.com/debiki/debiki-server-old.
That repo, squashed, is in this repo.



License
-----------------------------

Copyright (c) 2010-2026 Kaj Magnus Lindberg and contributors.

Talkyard is licensed under AGPLv3 or later, see LICENSE.txt.

<!-- Later, add this, but first ask someone if the wording is ok:
Starting on 2032-01-01, this specific version of Talkyard (see ./version.txt)
is also licensed under GPLv2 or later. That is, AGPLv3+ until year 2032, thereafter
dual licensed under AGPLv3+ and GPLv2+.

Note:
  - We try to bump the above GPLv2 date each year, so it's 6–7 years in the future.
  - After the above GPLv2+ date, you can *not* redistribute Talkyard under GPLv2
    — Talkyard includes Apache2 software and Apache2 is incompatible with GPLv2.
    You can, however, after the GPLv2+ date, redistribute Talkyard under GPLv3+.
-->

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
above-mentioned licence texts for more details.


