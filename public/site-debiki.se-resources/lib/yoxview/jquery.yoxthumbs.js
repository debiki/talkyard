/*!
 * jquery.yoxthumbs
 * jQuery thumbnails plugin
 * http://yoxigen.com/
 *
 * Copyright (c) 2010 Yossi Kolesnicov
 *
 * Date: 13th November, 2010
 * Version : 0.95
 */
(function($){
    $.fn.yoxthumbs = function(opt) {
		if (this.length == 0)
            return this;
			
        if (typeof(opt) != 'string')
        {
            var defaults = {
                target: null, // an yoxview instance
                selectedThumbnailClassName : "selected",
                thumbsOpacityFadeTime: 300,
                thumbsOpacity : undefined,
                prevBtn: undefined,
                nextBtn: undefined,
                onClick: undefined,
                images: undefined,
                enableOnlyMedia: false // If set to true, YoxThumbs is enabled only for links whose HREF is to an image or other supported media.
            };
            
            var options = $.extend(defaults, opt);
            var $this = $(this);
            $this.data("yoxthumbs", new YoxThumbs($this, options));
            return this;
        }
        else
        {
            var instance = $(this).data("yoxthumbs");
            if (instance)
            {
                if ($.isFunction(instance[opt]))
                    instance[opt].apply(instance, Array.prototype.slice.call(arguments, 1));
                else
                    return instance[opt];
            }
            return this;
        }
    };
    function YoxThumbs(container, options)
    {
        var self = this,
            prevBtn = options.prevBtn,
            nextBtn = options.nextBtn,
            viewIndex = container.data("yoxview") ? container.data("yoxview").viewIndex : undefined,
            $ = jQuery,
		    containerIsAnchor = container[0].tagName == "A",
		    shortenFunctions = {};
			
		this.thumbnails = [];

        (function setShortenFunctions(){
            $.each(["title", "description"], function(i, fieldName){
                var maxLength = options[fieldName + "MaxLength"];
                shortenFunctions[fieldName] = function(str){
                    return !maxLength || str.length <= maxLength ? str : str.substr(0, maxLength) + (options.addEllipsis !== false ? "&hellip;" : "");
                };
            });
        })();
        
        // If images data has been specified, create the thumbnails:
        if (options.images)
            $.each(options.images, function(i, imageData){
                container.append(createThumbnail(imageData));
            });

        var currentImageIndex = 0,
		    foundThumbnails = containerIsAnchor ? container : container.find("a:has(img)");
		    
        $.each(foundThumbnails, function(i, thumbnail)
        {
            var $thumbnail = $(thumbnail);
            var addThumb = true;
            if (options.enableOnlyMedia)
            {
                if (!thumbnail.href.match(Yox.Regex.image))
                {
                    var isData = false;
                    for(dataProvider in Yox.Regex.data)
                    {
                        if (thumbnail.href.match(Yox.Regex.data[dataProvider]))
                        {
                            isData = true;
                            break;
                        }
                    }
                    if (!isData)
                    {
                        var isVideo = false;
                        for(videoProvider in Yox.Regex.video)
                        {
                            if (thumbnail.href.match(Yox.Regex.video[videoProvider]))
                            {
                                isVideo = true;
                                break;
                            }
                        }
                        if (!isVideo)
                            addThumb = false;
                    }
                }
            }
            
            if (addThumb)
            {
                $thumbnail.data("yoxthumbs", $.extend({imageIndex: currentImageIndex++}, $thumbnail.data("yoxthumbs")));
                self.thumbnails.push($thumbnail);
            }
        });

        if (options.thumbsOpacity)
        {
            this.thumbnails.css("opacity", options.thumbsOpacity);
            container.delegate("a:has(img)", "mouseenter.yoxthumbs", function(e){
                if (self.currentSelectedIndex === undefined || 
                    $(e.currentTarget).data("yoxthumbs").imageIndex != self.currentSelectedIndex){
                    $(e.currentTarget).stop().animate({opacity: 1}, options.thumbsOpacityFadeTime);
                }
            })
            .delegate("a:has(img)", "mouseout.yoxthumbs", function(e){
                if (self.currentSelectedIndex === undefined || 
                    $(e.currentTarget).data("yoxthumbs").imageIndex != self.currentSelectedIndex)
                    $(e.currentTarget).stop().animate({opacity: options.thumbsOpacity}, options.thumbsOpacityFadeTime);
            });
        }
        if (options.onClick)
        {
			if (containerIsAnchor)
				container.bind("click.yoxthumbs", function(e){
					options.onClick(e);
					return false;
				});
			else
				container.delegate("a:has(img)", "click.yoxthumbs", function(e){
				    if (!$(e.currentTarget).data("yoxthumbs"))
				        return true;
				        
					options.onClick(e);
					return false;
				});
        }

        function createThumbnail(imageData, viewIndex)
        {
            var thumbnail = $("<a>", {
                href: imageData.link,
                className: options.thumbnailsClass || "yoxthumbs_thumbnail"
            });
            
            var thumbImage = jQuery("<img>", {
                src : imageData.thumbnailSrc,
                alt : imageData.media.alt,
                title : imageData.media.title
            });

            if (imageData.data)
                thumbnail.data("yoxthumbs", imageData.data);
                
            if (imageData.thumbnailDimensions)
                thumbImage.css({
                    "width": imageData.thumbnailDimensions.width,
                    "height" : imageData.thumbnailDimensions.height
                });
            thumbImage.appendTo(thumbnail);
            
            if (options.setTitles && imageData.media.title){
                $(options.titlesElement || "<span>", {
                    html: shortenFunctions.title(imageData.media.title),
                    className: options.titlesClass
                }).appendTo(thumbnail);
            }
            
            if (options.setDescriptions && imageData.media.description){
                $(options.descriptionsElement || "<div>", {
                    html: shortenFunctions.description(imageData.media.description),
                    className: options.descriptionsClass
                }).appendTo(thumbnail);
            }
            
            return thumbnail;
        }
        
        // Selects a thumbnail
        this.select = function(thumbIndex)
        {
            if (this.currentSelectedIndex === undefined || this.currentSelectedIndex != thumbIndex)
            {
                var currentThumbnail = this.thumbnails.eq(thumbIndex);
                var yoxslider = container.data("yoxslide");
                if (yoxslider)
                    yoxslider.show(currentThumbnail);

                // Remove selection from previous thumbnail:
                if (this.currentSelectedIndex !== undefined)
                {
                    var previousSelectedThumbnail = this.thumbnails.eq(this.currentSelectedIndex);
                    previousSelectedThumbnail.removeClass(options.selectedThumbnailClassName);
                    if (options.thumbsOpacity)
                        previousSelectedThumbnail.animate({opacity: options.thumbsOpacity}, options.thumbsOpacityFadeTime);
                        
                }
                
                currentThumbnail.addClass(options.selectedThumbnailClassName);
                if (options.thumbsOpacity)
                    currentThumbnail.animate({opacity: 1}, options.thumbsOpacityFadeTime);
                                        
                this.currentSelectedIndex = thumbIndex;
            }
        }
        this.unload = function(dataKey)
        {
            $.each(this.thumbnails, function(i, thumbnail)
            {
                $(thumbnail).removeData("yoxthumbs");
                if (dataKey)
                    $(thumbnail).removeData(dataKey);
            });
            container.undelegate("a:has(img)", "click.yoxthumbs");
            container.find(".yoxthumbs_thumbnail").remove();
            if (containerIsAnchor)
                container.unbind(".yoxthumbs");
        }
    }
})(jQuery);