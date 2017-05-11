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

package ed.server.security



object ReservedNames {

  /**
    * From https://ldpreload.com/blog/names-to-reserve:
    *   """Many Internet protocols make the assumption that a domain is manually managed
    *   by its owners, and in particular assume that a name like admin must have been
    *   registered or approved by the actual owners. Automatic registration breaks
    *   this assumption, and has been the source of some attacks."""
    */
  def isSubdomainReserved(subdomain: String): Boolean = isWhateverReserved(subdomain)

  def isUsernameReserved(username: String): Boolean = isWhateverReserved(username)

  private def isWhateverReserved(whatever: String): Boolean =
    allNames.contains(whatever)


  private val allNames: Set[String] =
    LongListOfNames.toLowerCase.lines
      .flatMap(
          // Remove comment lines, and trailing comments:
          _.span(_ != '#')._1.trim
          // If there're many words on one line:
          .split(" ").map(_.trim))
      .filterNot(_.isEmpty)
      .toSet

  private def LongListOfNames: String = """

#------------------------------------------------------------------------------

# https://github.com/shouldbee/reserved-usernames/blob/master/reserved-usernames.txt  as of 2017-05-11
# The MIT license: https://github.com/shouldbee/reserved-usernames/blob/master/LICENSE
# Copyright (c) 2014   (no author names specified)
0
about
access
account
accounts
activate
activities
activity
ad
add
address
adm
admin
administration
administrator
ads
adult
advertising
affiliate
affiliates
ajax
all
alpha
analysis
analytics
android
anon
anonymous
api
app
apps
archive
archives
article
asct
asset
atom
auth
authentication
avatar
backup
balancer-manager
banner
banners
beta
billing
bin
blog
blogs
board
book
bookmark
bot
bots
bug
business
cache
cadastro
calendar
call
campaign
cancel
captcha
career
careers
cart
categories
category
cgi
cgi-bin
changelog
chat
check
checking
checkout
client
cliente
clients
code
codereview
comercial
comment
comments
communities
community
company
compare
compras
config
configuration
connect
contact
contact-us
contact_us
contactus
contest
contribute
corp
create
css
dashboard
data
db
default
delete
demo
design
designer
destroy
dev
devel
developer
developers
diagram
diary
dict
dictionary
die
dir
direct_messages
directory
dist
doc
docs
documentation
domain
download
downloads
ecommerce
edit
editor
edu
education
email
employment
empty
end
enterprise
entries
entry
error
errors
eval
event
exit
explore
facebook
faq
favorite
favorites
feature
features
feed
feedback
feeds
file
files
first
flash
fleet
fleets
flog
follow
followers
following
forgot
form
forum
forums
founder
free
friend
friends
ftp
gadget
gadgets
game
games
get
gift
gifts
gist
github
graph
group
groups
guest
guests
help
home
homepage
host
hosting
hostmaster
hostname
howto
hpg
html
http
httpd
https
i
iamges
icon
icons
id
idea
ideas
image
images
imap
img
index
indice
info
information
inquiry
instagram
intranet
invitations
invite
ipad
iphone
irc
is
issue
issues
it
item
items
java
javascript
job
jobs
join
js
json
jump
knowledgebase
language
languages
last
ldap-status
legal
license
link
links
linux
list
lists
log
log-in
log-out
log_in
log_out
login
logout
logs
m
mac
mail
mail1
mail2
mail3
mail4
mail5
mailer
mailing
maintenance
manager
manual
map
maps
marketing
master
me
media
member
members
message
messages
messenger
microblog
microblogs
mine
mis
mob
mobile
movie
movies
mp3
msg
msn
music
musicas
mx
my
mysql
name
named
nan
navi
navigation
net
network
new
news
newsletter
nick
nickname
notes
noticias
notification
notifications
notify
ns
ns1
ns10
ns2
ns3
ns4
ns5
ns6
ns7
ns8
ns9
null
oauth
oauth_clients
offer
offers
official
old
online
openid
operator
order
orders
organization
organizations
overview
owner
owners
page
pager
pages
panel
password
payment
perl
phone
photo
photoalbum
photos
php
pic
pics
ping
plan
plans
plugin
plugins
policy
pop
pop3
popular
portal
post
postfix
postmaster
posts
pr
premium
press
price
pricing
privacy
privacy-policy
privacy_policy
privacypolicy
private
product
products
profile
project
projects
promo
pub
public
purpose
put
python
query
random
ranking
read
readme
recent
recruit
recruitment
register
registration
release
remove
replies
report
reports
repositories
repository
req
request
requests
reset
roc
root
rss
ruby
rule
sag
sale
sales
sample
samples
save
school
script
scripts
search
secure
security
self
send
server
server-info
server-status
service
services
session
sessions
setting
settings
setup
share
shop
show
sign-in
sign-up
sign_in
sign_up
signin
signout
signup
site
sitemap
sites
smartphone
smtp
soporte
source
spec
special
sql
src
ssh
ssl
ssladmin
ssladministrator
sslwebmaster
staff
stage
staging
start
stat
state
static
stats
status
store
stores
stories
style
styleguide
stylesheet
stylesheets
subdomain
subscribe
subscriptions
suporte
support
svn
swf
sys
sysadmin
sysadministrator
system
tablet
tablets
tag
talk
task
tasks
team
teams
tech
telnet
term
terms
terms-of-service
terms_of_service
termsofservice
test
test1
test2
test3
teste
testing
tests
theme
themes
thread
threads
tmp
todo
tool
tools
top
topic
topics
tos
tour
translations
trends
tutorial
tux
tv
twitter
undef
unfollow
unsubscribe
update
upload
uploads
url
usage
user
username
users
usuario
vendas
ver
version
video
videos
visitor
watch
weather
web
webhook
webhooks
webmail
webmaster
website
websites
welcome
widget
widgets
wiki
win
windows
word
work
works
workshop
ww
wws
www
www1
www2
www3
www4
www5
www6
www7
wwws
wwww
xfn
xml
xmpp
xpg
xxx
yaml
year
yml
you
yourdomain
yourname
yoursite
yourusername



#------------------------------------------------------------------------------

# From Wikipedia:

# Country TLDs — not needed, since website names & usernames must be sth like >= 6 and >= 3 chars.
# Anyway there's a list here:
# http://en.wikipedia.org/wiki/List_of_Internet_top-level_domains#Country_code_top-level_domains

# Top 50 languages by population
# From here: http://en.wikipedia.org/wiki/List_of_languages_by_number_of_native_speakers
chinese
mandarin
spanish
english
bengali
hindi
portuguese
russian
japanese
german
wu
javanese
korean
french
vietnamese
telugu
chinese
marathi
tamil
turkish
urdu
min-nan
jinyu
gujarati
polish
arabic
ukrainian
italian
xiang
malayalam
hakka
kannada
oriya
panjabi
sunda
panjabi
romanian
bhojpuri
azerbaijani
farsi
maithili
hausa
arabic
burmese
serbo-croatian
gan
awadhi
thai
dutch
yoruba
sindhi


#------------------------------------------------------------------------------

# http://blog.postbit.com/reserved-username-list.html   as of 2017-05-11

# Skip. Apparently everything already included above.



#------------------------------------------------------------------------------

# https://zimbatm.github.io/hostnames-and-usernames-to-reserve
# License: some open source license apparently.
# I asked here: https://github.com/zimbatm/hostnames-and-usernames-to-reserve/issues/3

## This is a list of names to reserve when building a PaaS
#
# See https://zimbatm.github.io/hostnames-and-usernames-to-reserve
#

# well-known hostnames
email
ftp
imap
mail
mx
ns0
ns1
ns2
ns3
ns4
ns5
ns6
ns7
ns8
ns9
pop
pop3
smtp
www

# admin-ish usernames
admin
administrator
domainadmin
domainadministrator
owner
root
sys
system

# rfc2142 reserved email addresses
abuse
ftp
hostmaster
info
marketing
news
noc
postmaster
sales
security
support
usenet
uucp
webmaster
www

# SSL - CA ownership verification
admin
administrator
hostmaster
info
is
it
mis
postmaster
root
ssladmin
ssladministrator
sslwebmaster
sysadmin
webmaster

# commonly-used email addresses
community
contact
mailer-daemon
mailerdaemon
me
no-reply
nobody
noreply
user
users

# commonly-used top paths
about
admin
app
blog
copyright
css
dashboard
dev
developer
developers
docs
errors
events
example
faq
faqs
features
guest
guests
help
image
images
img
js
login
logout
media
new
news
pricing
privacy
signin
signout
src
status
support
terms
tutorial
tutorials

# network
broadcasthost
localdomain
localhost

# auto-discovery
wpad
autoconfig
isatap



#------------------------------------------------------------------------------

# My own (KajMagnus) short list. License: MIT.

git
gist
everyone anyone someone anonymous anon noone identity group role who whom
he she it is hen
rubot
robot

administrator
admin
administrator
webmaster
hostmaster
postmaster
administrator
guest
mod
moderator

support
help
search
admin
chat
chatroom
room
house
building

god
satan

fuck
fucker
fucking
motherfucker
motherfucking
dick
ass
asshoole
fart
sperm
poop

internet
intranet
extranet

abuse
marketplace
event
events

forum
community
page
pages
topic
topics
forums
blog
blogs
wiki
wikis
embedded
comment
comments
post
posts
thread
threads
none
many
multiple
title
list

effective
discussion
discussions
effectivediscussion
effectivediscussions
efficient
efficientdiscussion
efficientdiscussions
debiki
kle

discourse
flarum
nodebb
phpbb
mybb
vanilla
vbulletin
disqus
livefyre
wordpress

google
apple
gmail
outlook

"""

}

