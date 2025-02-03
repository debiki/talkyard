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

<!-- Community discussion platform, or Structured discussion platform? A/B test?
Or "Structured discussions, for your community — Talkyard brings together ..." ? -->
A structured discussions platform — brings together the main features from
StackOverflow, Slack, Discourse, Reddit/HackerNews, and Disqus blog comments.

<!--
Create a place to talk,
where your audience find answers to their questions, and discuss ideas.<br>
Place it at `talkyard.Your-Website.org`.

 - **Solve problems** step by step, in traditional flat forum topics.
-->

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

How does Talkyard compare with
StackOverflow for Teams, Discourse, Slack, Facebook Groups, Disqus?
— <a href="https://business.talkyard.io/compare/">Find out here</a> (<small>oops, link now fixed. Was browken</small>)


Using Talkyard
-----------------------------

This repo is for **development** of Talkyard. To actually *use* Talkyard:

- Install on your server, see: [talkyard-prod-one](https://github.com/debiki/talkyard-prod-one)

- Use our hosting service: https://www.talkyard.io

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

scc modules/ed-core/src  modules/ty-dao-rdb/src/ client/app-* client/embedded-comments/  client/serviceworker/  client/*.ts  app/  s/  Makefile to-talkyard/src/  gulpfile.js images/web/ed-lua/  images/web/*.conf  images/app/Dockerfile.*  images/rdb/

scc tests/

-->


<!-- Some Features -----------
- Avoid mistakes: See if people disagree.
- Anonymous questions: So people dare to ask embarassing questions, or post crazy creative ideas.
- 
- 
-->


Developing Talkyard
-----------------------------

Read about how to start a development build of Talkyard:
[docs/starting-talkyard.md](docs/starting-talkyard.md).

And how to edit the source code and see the changes:
[docs/developing-talkyard.md](docs/developing-talkyard.md)

You'll find **Docker image** build files in: <code>./images/<i>image-name</i>/</code>

You can build your own images:
[docs/building-images.md](docs/building-images.md)



Getting help
-----------------------------

[**Support forum here**](https://www.talkyard.io/forum/latest/support) (& live "demo"), at Talkyard<i></i>.io — and report bugs there too.

Also see these troubleshooting [tips.md](./docs/tips.md).



Contributing
-----------------------------

See: [CONTRIBUTING.adoc](./CONTRIBUTING.adoc). There's a CLA (Contributor License Agreement) to sign.



Technology
-----------------------------

- Client: React.js, TypeScript, Webdriver.io.
- Server: Scala and Play Framework. OpenResty, some Lua. React.js in Java's Nashorn Javascript engine.
- Databases: PostgreSQL, Redis, ElasticSearch.


<hr>

Screenshots
-----------

### Question-Answers:

The good answers surface to the top.

![Question and Answers](https://raw.githubusercontent.com/debiki/talkyard-media/bf78d26ec3f4da976d9c694a660d40b718d86043/for-docs/2018-08-19-question-ex.jpeg "Question-Answers")
<!--
![Question and Answers](/images/web/ty-media/for-docs/2018-08-19-question-ex.jpeg?raw=true "Question-Answers") -->

<!--
![how-work-from-home-vpn-broken-borders](https://user-images.githubusercontent.com/7477359/44306101-0041eb80-a388-11e8-92e8-b8d417c47139.jpg)
-->

### Avoid mistakes

See if others disagree with something, so you can avoid following the wrong advice.

<br>

![Avoid mistakes](https://tyw-49f8.kxcdn.com/-/u/e7ef490a72/2/m/nu/zecljq7vwtuyxqfabsjwqzg6bfmyvr.jpg)

<br>


### Recent replies — find them:

You leave for lunch, or go home over the night — and return to a Question-Answers topic the next day. Did someone post more replies, when you were away? You want to find and read?

You can directly find the most recent answers and replies: Open the sidebar, click the Recent tab, and find the most recent replies, click to scroll.

(But at StackOverflow, Reddit, HackerNews etc, it's hard to find them (since the discussions are threaded). You need to carefully scan the whole discussion from top to bottom.)

<br>
<br>

![Recent replies](https://raw.githubusercontent.com/debiki/talkyard-media/bf78d26ec3f4da976d9c694a660d40b718d86043/for-docs/2019-08-10-recent-replies-ex-anon-arw.jpg "Recent replies")

<!--
![Recent replies](/images/web/ty-media/for-docs/2019-08-10--recent-replies-ex-anon-arw.jpg?raw=true "Recent replies") -->

<br>

### Topic list:

<!--
![topic-list-borders](https://user-images.githubusercontent.com/7477359/44306130-a3930080-a388-11e8-9cbc-e569f5ddb7a1.jpg)
 the old demo forum looks better? so use instead.  -->

![ideas-topics](https://raw.githubusercontent.com/debiki/talkyard-media/bf78d26ec3f4da976d9c694a660d40b718d86043/for-docs/2019-08-10-idea-topics-list-ex.jpg "Topics list")
<!--
![ideas-topics](/images/web/ty-media/for-docs/2019-08-10-idea-topics-list-ex.jpg?raw=true "Topics list")

![ed-demo-forum-index](https://cloud.githubusercontent.com/assets/7477359/19650764/bb3a1450-9a0a-11e6-884d-d23c93476db3.jpg) -->

<br>

### Chat:

Notifications via email, as of now. Some time later, there'll be a PWA mobile app with push notifications.

<br>

<!--
Currently, Talkyard is a mobile friendly web app.
Within half a year or a year (today is August 2018),
the plan is that there'll be a white labelled mobile app.
Meaning, people will be able to install your community, on their mobile phones,
as a separate app with your custom icon.
Push notifications for Android
(however, initially not for iPhone — iPhone currently cannot do PWA mobile app push notifications).
-->

![chat-topic](https://raw.githubusercontent.com/debiki/talkyard-media/bf78d26ec3f4da976d9c694a660d40b718d86043/for-docs/2017-09-12-chat-ex.jpeg "A chat channel")

<!--
![chat-topic](/images/web/ty-media/for-docs/2017-09-12-chat-ex.jpeg?raw=true "A chat channel")
-->

<!--
![ed-e2e-chat-owen-maria](https://cloud.githubusercontent.com/assets/7477359/19674424/608c49aa-9a88-11e6-8ccd-c2e7ceebd0c2.jpg)
-->

<br>
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

### Users online:

![ed-online-users](https://cloud.githubusercontent.com/assets/7477359/19680424/f0353f86-9aa5-11e6-84d9-94d46f228b93.jpg)

<br>
-->

### Blog comments:

Like Disqus — but lightweight, no ads, no tracking. Configure in the Admin Area, the Settings tab, the Embedded Comments sub tab. — Read more about blog comments, and an optional hosting service, here: https://www.talkyard.io/blog-comments

There's a Disqus importer — talk with us [in the forum](https://www.talkyard.io/forum/) if you want to migrate from Disqus to Talkyard.

<br>

![blog comments](https://raw.githubusercontent.com/debiki/talkyard-media/bf78d26ec3f4da976d9c694a660d40b718d86043/for-docs/2019-02-21-blog-comments-ex-anon.jpg "Blog comments")
<!--
![blog comments](/images/web/ty-media/for-docs/2019-02-21-blog-comments-ex-anon.jpg?raw=true "Blog comments")
-->
<br>

### Embarrassing questions, creative ideas:

Let your students ask anonymous questions. Maybe they feel ashamed for not knowing?
— Or let your co-workers submit ideas and feedback, anonymously.
Maybe they feel worried their ideas has crossed the border from Creative to Crazy?
They can un-anonymize themselves later if they want to (per page).
(Anonymous posting first needs to be enabled, by admins.
Here you can read more: https://www.talkyard.io/-239/is-there-anonymous-messages-support-for-the-full-talkyard )

Anonymous posts has been implemented, but not code reviewed and merged.

<br>

![Post anonymously](https://raw.githubusercontent.com/debiki/talkyard-media/bf78d26ec3f4da976d9c694a660d40b718d86043/for-docs/2019-08-10-editor-post-anonymously-ex-arw.jpg "Post anonymously")

<hr>
<br>



Old Code
-----------------------------

Old code from before January 2015 is available here:
https://github.com/debiki/debiki-server-old.
That repo, squashed, is in this repo.



License
-----------------------------

Copyright (c) 2010-2025 Kaj Magnus Lindberg and contributors.

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


vim: list et ts=2 sw=2 tw=0 fo=r
