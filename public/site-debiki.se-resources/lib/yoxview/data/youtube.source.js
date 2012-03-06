/*!
 * Yox YouTube plugin
 * http://yoxigen.com/yoxview/
 *
 * Copyright (c) 2010 Yossi Kolesnicov
 *
 * Licensed under the MIT license.
 * http://www.opensource.org/licenses/mit-license.php
 *
 * Date: 13th November, 2010
 * Version : 1.0
 */
function yox_youtube()
{
    var $ = jQuery,
        youtubeRegex = /^http:\/\/(?:www\.)?youtube.com\//,
        self = this,
        ytRegex = {
            singleVideo: /^http:\/\/(?:www\.)?youtube.com\/watch\?v=([^\&]+)(.*)?/,
            playlist: /^http:\/\/(?:www\.)?youtube.com\/(?:view_play_list|my_playlists)\?p=([^\&]+)(.*)?/,
            user: /^http:\/\/(?:www\.)?youtube.com\/user\/([^\?]+)(?:\?(.*))?/,
            search: /^http:\/\/(?:www\.)?youtube.com\/results\?(.*)/
        };

    this.getImagesData = function(options, callback)
    {
        var defaults = {
            url: "http://gdata.youtube.com/feeds/api/videos",
            setThumbnails: true,
            setSingleAlbumThumbnails: true,
			alt: 'jsonc',
			thumbsize: 64,
			v: 2,
			format: 5,
			hqThumbnails: false,
			aspectRatio: "auto"
        },
        isSingleVideo = false,
        datasourceOptions = jQuery.extend({}, defaults, options.dataSourceOptions);

        function getDimensionsCalc(){
            var widescreenDimensions,
                defaultDimensions,            
                widescreenAspectRatio = 16/9,
                defaultIsWidescreen = false;
            
            if (!datasourceOptions.width && !datasourceOptions.height)
                datasourceOptions.width = 720;
                
            if ((datasourceOptions.height && !datasourceOptions.width) || (datasourceOptions.width && !datasourceOptions.height)){
                if (typeof(datasourceOptions.aspectRatio) === "string"){
                    if (datasourceOptions.aspectRatio === "auto")
                        datasourceOptions.aspectRatio = 4/3;
                    else{
                        var ratioValues = datasourceOptions.aspectRatio.split(":");
                        datasourceOptions.aspectRatio = parseInt(ratioValues[0], 10) / parseInt(ratioValues[1], 10);
                    }
                }
                
                defaultIsWidescreen = datasourceOptions.aspectRatio === 16/9;
                if (datasourceOptions.height){
                    widescreenDimensions = { height: datasourceOptions.height, width: datasourceOptions.height * widescreenAspectRatio };
                    if (!defaultIsWidescreen)
                        defaultDimensions = { height: datasourceOptions.height, width: datasourceOptions.height * datasourceOptions.aspectRatio };
                }
                else{
                    widescreenDimensions = { width: datasourceOptions.width, height: datasourceOptions.width / widescreenAspectRatio };
                    if (!defaultIsWidescreen)
                        defaultDimensions = { width: datasourceOptions.width, height: datasourceOptions.width / datasourceOptions.aspectRatio };
                }

            }
            
            var getDimensions = function(isWidescreen){
                return isWidescreen ? widescreenDimensions : defaultDimensions;
            }
            
            return getDimensions;
        }
        
        var feedType;
        if (options.dataUrl)
        {
            var urlMatch;    
            for (regexType in ytRegex){
                urlMatch = options.dataUrl.match(ytRegex[regexType]);
                if (urlMatch)
                {
                    feedType = regexType;
                    break;
                }
            }

            if (urlMatch){ 
                switch(feedType){
                    case "singleVideo":
                        isSingleVideo = true;
                        datasourceOptions.url += "/" + urlMatch[1];
                        break;
                    case "playlist":
                        datasourceOptions.url = "http://gdata.youtube.com/feeds/api/playlists/" + urlMatch[1];
                        break;
                    case "user":
                        datasourceOptions.url = "http://gdata.youtube.com/feeds/api/users/" + urlMatch[1] + "/uploads";
                        break;
                    default:
                        break;
                }
                
                var queryData = Yox.queryToJson(urlMatch.length == 2 ? urlMatch[1] : urlMatch[2]);
                if (queryData){
                    if (queryData.search_query){
                        queryData.q = queryData.search_query;
                        delete queryData.search_query;
                    }
                    $.extend(datasourceOptions, queryData);
                }
            }
        }

        var getDimensions = getDimensionsCalc();
        
        function getEmbedObject(embedUrl){
            var videoPanel = $("<div>", {
                className: "yoxview_element",
                html: "<object width='100%' height='100%'><param name='movie' value='" + embedUrl + "'</param><param name='allowFullScreen' value='true'></param><param name='wmode' value='transparent'></param><param name='allowScriptAccess' value='always'></param><embed src='" + embedUrl + "' type='application/x-shockwave-flash' allowfullscreen='true' allowscriptaccess='always' wmode='transparent' width='100%' height='100%'></embed></object>"
            });
            return videoPanel;
        }
        function getVideosDataFromJson(items)
        {
            var videosData = [];
            jQuery.each(items, function(i, video){
                if (feedType === "playlist")
                    video = video.video;
                
                var videoTitle = video.title;
                var videoData = {
                    thumbnailSrc: video.thumbnail[datasourceOptions.hqThumbnails ? "hqDefault" : "sqDefault"],
                    link: video.player["default"],
                    media: {
                        "element": getEmbedObject(video.content["5"] + "&fs=1&hd=1"),
                        title: videoTitle,
                        contentType: "flash",
                        elementId: video.id,
                        description: video.description
                    }
                };

                $.extend(videoData.media, getDimensions(!!video.aspectRatio && video.aspectRatio === "widescreen"));
                videosData.push(videoData);
            });
            
            return videosData;
        }
    
        var returnData = {};
        
        if (options.onLoadBegin)
            options.onLoadBegin();
            
        $.jsonp({
            url: datasourceOptions.url,
            data: datasourceOptions,
            async: false,
            callbackParameter: "callback",
            success: function(jsonData)
            {
                if ((isSingleVideo && !jsonData.data) || (!isSingleVideo && (!jsonData.data.items || jsonData.data.items.length === 0)))
                {
                    if (options.onNoData)
                        options.onNoData();
                        
                    return;
                }
                
                returnData.images = getVideosDataFromJson(isSingleVideo ? [ jsonData.data ] : jsonData.data.items);
                
                if (!isSingleVideo){
                    var dataTitle = jsonData.data.title;
                    if (dataTitle)
                        returnData.title = dataTitle;
                }
                    
                if (callback)
                    callback(returnData);

                if (options.onLoadComplete)
                    options.onLoadComplete();
            },
            error : function(xOptions, textStatus){
                if (options.onLoadError)
                    options.onLoadError("YouTube plugin encountered an error while retrieving data");
            }
        });
    }
}