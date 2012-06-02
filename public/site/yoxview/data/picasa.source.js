/*!
 * Yox Picasa plugin
 * http://yoxigen.com/yoxview/
 *
 * Copyright (c) 2010 Yossi Kolesnicov
 *
 * Licensed under the MIT license.
 * http://www.opensource.org/licenses/mit-license.php
 *
 * Date: 13th November, 2010
 * Version : 1.55
 */
function yox_picasa()
{
    var $ = jQuery;
    var picasaRegex = /http:\/\/picasaweb\.google\.\w+\/([^\/#\?]+)\/?([^\/#\?]+)?(\?([^#]*))?/
    var self = this;
    
    this.getImagesData = function(options, callback)
    {
        var defaults = {
            url: "http://picasaweb.google.com/data/feed/api/",
            setThumbnail: true,
            setSingleAlbumThumbnails: true,
            setTitle: true, // Whether to add a header with user and/or album name before thumbnails
			alt: 'json',
			thumbsize: 64
        },
        picasaThumbnailSizes = [32, 48, 64, 72, 104, 144, 150, 160],
        picasaImgMaxSizes = [94, 110, 128, 200, 220, 288, 320, 400, 512, 576, 640, 720, 800, 912, 1024, 1152, 1280, 1440, 1600],
        fromDataUrl = {};
        
        function getFeedUrl()
        {
            var feedUrl = datasourceOptions.url;
		    if (datasourceOptions.user && datasourceOptions.user != "lh")
		    {
			    feedUrl += "user/" + datasourceOptions.user;
			    if (datasourceOptions.album)
				    feedUrl += "/album/" + datasourceOptions.album;
            }
            else
			    feedUrl += "all";

            return feedUrl;
        }
        
        function picasa_getMaxSize(size, sizesArray, roundSizeUp)
        {
            size = parseInt(size);
            for(var i=sizesArray.length - 1; i >= 0; i--)
            {
                var pSize = sizesArray[i];
                if (size >= pSize)
                    return roundSizeUp 
                        ? i < sizesArray.length - 1 ? sizesArray[i + 1] : pSize
                        : pSize;
            }
            
            return size;
        }
        
        function getImagesDataFromJson(data, kind)
        {
            var entry = data.feed.entry;
            var isAlbum = kind === "album";
            var imagesData = [];
            jQuery.each(data.feed.entry, function(i, image){
                var imageTitle = isAlbum ? image.title.$t + " (" + image.gphoto$numphotos.$t + " images)" : image.summary.$t;
                
                if (!datasourceOptions.filter || imageTitle.match(datasourceOptions.filter))
                {
                    var mediaData = image.media$group.media$content[0];
                    var imageData = {
                        thumbnailSrc : image.media$group.media$thumbnail[1].url,
                        link: image.link[1].href,
                        media: {
                            src: mediaData.url,
                            title: imageTitle,
                            alt: imageTitle,
                            width: mediaData.width,
                            height: mediaData.height
                        }
                    };

                    if (isAlbum)
                        imageData.data = { album: image.gphoto$name.$t };

                    imagesData.push(imageData);
                }
            });

            if (fromDataUrl.filter)
            {
                var dataUrlObj = Yox.getUrlData(options.dataUrl);
                delete dataUrlObj.queryFields.filter;
                options.dataUrl = Yox.urlDataToPath(dataUrlObj);
            }
            if (options.dataSourceOptions && options.dataSourceOptions.filter)
                delete options.dataSourceOptions.filter;

            return imagesData;
        }
        
        if (options.dataUrl)
        {
            var urlMatch = options.dataUrl.match(picasaRegex);
            if (urlMatch && urlMatch.length > 1)
            {
                fromDataUrl.user = urlMatch[1];
                if (urlMatch[2])
                    fromDataUrl.album = urlMatch[2]
				if (urlMatch[4])
					$.extend(fromDataUrl, Yox.queryToJson(urlMatch[4]));
            }
        }

        var datasourceOptions = jQuery.extend({}, defaults, fromDataUrl, options.dataSourceOptions);
        
		if (datasourceOptions.user && !datasourceOptions.album && !datasourceOptions.q)
			datasourceOptions.thumbsize = 104;
			
        // Picasa web uses 'tags', while the API uses 'tag':
        if (datasourceOptions.tags)
            datasourceOptions.tag = datasourceOptions.tags;
            
        if (datasourceOptions.album == "")
            delete datasourceOptions.album;

        var screenSize = screen.width > screen.height ? screen.width : screen.height;
        var unknownSize = datasourceOptions.imgmax && $.inArray(datasourceOptions.imgmax, picasaImgMaxSizes) == -1 ? datasourceOptions.imgmax : null;

        // Save resources for smaller screens:
        if (!datasourceOptions.imgmax || unknownSize || screenSize < datasourceOptions.imgmax)
            datasourceOptions.imgmax = picasa_getMaxSize(unknownSize || screenSize, picasaImgMaxSizes, datasourceOptions.roundSizeUp);

        if (datasourceOptions.filter){
            if (typeof datasourceOptions.filter === "string")
                datasourceOptions.filter = new RegExp(datasourceOptions.filter, "i");
        }

        var feedUrl = getFeedUrl(datasourceOptions);
        var returnData = {};

        if (options.onLoadBegin)
            options.onLoadBegin();

        $.jsonp({
            url: feedUrl,
            async: false,
            dataType: 'jsonp',
			data: datasourceOptions,
            callbackParameter: "callback",
            success: function(data)
            {console.log(data);
                if (!data.feed.entry || data.feed.entry.length == 0)
                {
                    if (options.onNoData)
                        options.onNoData();
                        
                    return;
                }
                
                var kind = data.feed.entry[0].category[0].term.match(/.*#(.*)/)[1]; // album or photo
                if (kind === "album")
                    $.extend(returnData, {
                        title: data.feed.title.$t,
                        createGroups: true
                    });

                returnData.images = getImagesDataFromJson(data, kind);
                if (data.feed.title)
                    returnData.title = data.feed.title.$t;
                
                if (returnData.images.length > 0 && datasourceOptions.setThumbnail && !datasourceOptions.setSingleAlbumThumbnails)
                {
                    $.extend(returnData, {
                        isGroup: true,
                        link: data.feed.link[1].href,
                        thumbnailSrc: data.feed.icon.$t,
						title: data.feed.title.$t
                    });
                }
                
                if (callback)
                    callback(returnData);

                if (options.onLoadComplete)
                    options.onLoadComplete();
            },
            error : function(xOptions, textStatus){
                if (options.onLoadError)
                    options.onLoadError("Picasa plugin encountered an error while retrieving data");
            }
        });
    }
}