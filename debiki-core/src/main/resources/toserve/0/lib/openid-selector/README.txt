OVERVIEW
-------------------
This is a simple Javascript OpenID selector. It has been designed so 
that users do not even need to know what OpenID is to use it, they 
simply select their account by a recognisable logo.

USAGE
-------------------
See demo.html source

TROUBLESHOOTING
----------------------------
Please remember after you change list of providers, you must run 
generate-sprite.js <locale> to refresh sprite image

generate-sprite.js requires ImageMagick to be installed and works
only in Windows (non-Windows users must run ./generate-sprite.sh or
./generate-sprite.rb)

Before running generate-sprite.js for the first time, check its
source code and correct line 16 (var imagemagick = '<...>';) to 
point to ImageMagick install dir.

Please also remember that sprites may be reused: if two 
localizations have the same provider list that differs only in text,
it is reasonable to reuse the sprite: for example German 
localization is reusing sprite from English localization, Ukrainian 
localization is reusing sprite from Russian localization, etc.

So, if provider list in root localization changes, localizations 
that reuse the sprite must be also changed, or unlinked or relinked
to new root localization. 

HOWTO
-------------------
1. how to create new (small) provider icon
   a. launch web browser, go to http://<provider-site>/favicon.ico
      and save the image as <provider>.ico in ./images.small folder
   b. launch GIMP or Photoshop and save 16x16 rendition from the 
      icon as <provider>.ico.gif
   c. use ImageMagick command like 
      convert <provider>.ico <provider>.ico.png to convert the icon
      to PNG format (it might generate several files, just pick 16x16
      rendition and rename it as <provider>.ico.png w/o .1.)

2. how to create new (large) provider image
   a. grab provider logo image from its website
   b. resize the image not to exceed 90x30 rect
   c. save as the image as <provider>.gif in ./images.large folder

3. how to plug-in facebook provider
   put the following code in providers_large or providers_small:
   facebook = {
     name: 'Facebook',
     url: "javascript:facebook_click();"
   }
   where facebook_click is something like:
   function facebook_click() {
     $('#<id of html fbconnect element>').click();
   }
   the same mechanism also applies if you want to plug-in any oauth or
   xauth provider

LICENSE
-------------------
This code is licensed under the New BSD License.

