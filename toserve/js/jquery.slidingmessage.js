/**
 * Copyright (c) 2009 Henrik Joreteg
 * License: BSD style, http://projects.joreteg.com/licenses/BSD.html
 *
 * Parts copyright (c) 2012 Kaj Magnus Lindberg
 * License: BSD style.
 */
(function($) {
    jQuery.showMessage = function(message, options){

        settings = jQuery.extend({
             id: 'sliding_message_box',
             position: 'bottom',
             lineHeight: '160%',
             color: 'white',
             backgroundColor: 'rgb(143, 177, 240)',
             delay: 5000,
             speed: 500,
             fontSize: '24px'
        }, options);

        var elem = $('#' + settings.id);
        var delayed;

        // Don't restart slide in animation, if message already visible.
        if (elem.is(':visible'))
          return;

        // generate message div if it doesn't exist
        if(elem.length == 0){
            elem = $('<div></div>').attr('id', settings.id);

            elem.css({'z-index': '999',
                      'color': settings.color,
                      'background-color': settings.backgroundColor,
                      'text-align': 'center',
                      'position': 'absolute',
                      'position': 'fixed',
                      'left': '0',
                      'width': '100%',
                      'line-height': settings.lineHeight,
                      'font-size': settings.fontSize
                      });

            $('body').append(elem);
        }

        elem.html(message);
        elem.show();

        // Animate in.
        if(settings.position == 'bottom'){
            elem.css('bottom', '-' + elem.height() + 'px');
            elem.animate({bottom:'0'}, settings.speed);
        }
        else if(settings.position == 'top'){
            elem.css('top', '-' + elem.height() + 'px');
            elem.animate({top:'0'}, settings.speed);
        }

        // Animate out.
        var animOutSettings = {};
        animOutSettings[settings.position] = -elem.height();
        var animOut = function() {
            elem.animate(animOutSettings, settings.speed);
            elem.hide();
        };
        setTimeout(animOut, settings.delay);
    }
})(jQuery);

