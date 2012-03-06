/*!
 * Yox Flickr plugin
 * http://yoxigen.com/yoxview/
 *
 * Copyright (c) 2010 Yossi Kolesnicov
 *
 * Licensed under the MIT license.
 * http://www.opensource.org/licenses/mit-license.php
 *
 * Date: 17th July, 2010
 * Version : 1.6
 */
function yox_flickr()
{
    var $ = jQuery,
        flickrUrl = "http://www.flickr.com/",
        flickrApiUrl = "http://api.flickr.com/services/rest/",
        yoxviewFlickrApikey = "cd6c91f9721f34ead20e6ebe03dd5871",
        flickrUserIdRegex = /\d+@N\d+/,
	    flickrUrlRegex = /http:\/\/(?:www\.)?flickr\.com\/(\w+)\/(?:([^\/]+)\/(?:(\w+)\/?(?:([^\/]+)\/?)?)?)?(?:\?(.*))?/,
        self = this,
        fixedOptions = {
            api_key: yoxviewFlickrApikey,
            format: 'json'
        };
        
    this.getImagesData = function(options, callback)
    {
        var defaults = {
            imageSize: "medium", // medium/large/original, for large, your images in Flickr must be 1280 in width or more. For original, you must allow originals to be downloaded
            thumbsize: "smallSquare",
            setThumbnail: true,
            setSinglePhotosetThumbnails: true,
            setTitle: true,
            method: 'flickr.photosets.getList',
            extras: 'description'
        };

		var requireLookup = true;
		var lookupData = {
			method: "flickr.urls.lookupUser",
			onData: function(data)
			{
				return {
					user_id: data.user.id,
					username: data.user.username._content
				};
			}
		};
		
		var fromDataUrl = {};

        if (options.dataUrl)
        {
            var urlMatch = options.dataUrl.match(flickrUrlRegex);
            var queryData;
            if (urlMatch[5])
            {
                queryData = Yox.queryToJson(urlMatch[5]);
		        $.extend(fromDataUrl, queryData);
		    }
            if (urlMatch && urlMatch.length > 1)
            {
				if (urlMatch[1] == "search")
				{
					fromDataUrl.method = "flickr.photos.search";
					fromDataUrl.text = queryData.q;
					if (queryData.w)
					{
						queryData.w = queryData.w.replace("%40", "@");
						if (queryData.w.match(flickrUserIdRegex))
							fromDataUrl.user_id = queryData.w;
					}
					if (!queryData || !queryData.sort)
					    fromDataUrl.sort = "relevance";
					    
					requireLookup = false;
				}
				else
				{
					switch(urlMatch[3])
					{
						case undefined:
							fromDataUrl.method = "flickr.people.getPublicPhotos";
							break;
						case "sets":
							$.extend(fromDataUrl, {
								method: urlMatch[4] || options.dataSourceOptions.photoset_id ? "flickr.photosets.getPhotos" : "flickr.photosets.getList",
								photoset_id: urlMatch[4]
							});
							break;
						case "galleries":
							$.extend(fromDataUrl, {
								method: urlMatch[4] ? "flickr.galleries.getPhotos" : "flickr.galleries.getList",
								gallery_id: urlMatch[4]
							});
							if (urlMatch[4])
							{
								requireLookup = true;
								lookupData = {
									method: "flickr.urls.lookupGallery",
									onData: function(data)
									{
										return {
											gallery_id: data.gallery.id,
											title: data.gallery.title
										};
									}
								};
							}
							break;
						case "collections":
							$.extend(fromDataUrl, {
								method: "flickr.collections.getTree",
								collection_id: urlMatch[4]
							});
							break;
						default:
							fromDataUrl.method = "flickr.photos.search";
							break;
					}
					$.extend(fromDataUrl, {
						username: urlMatch[2],
						type: urlMatch[3]
					});
				}
            }
        }
		
        var datasourceOptions = jQuery.extend({}, defaults, fromDataUrl, options.dataSourceOptions, fixedOptions);
		
        datasourceOptions.media = "photos";
        if (datasourceOptions.user && datasourceOptions.photoset_id)
            datasourceOptions.method = "flickr.photosets.getPhotos";

        var screenSize = screen.width > screen.height ? screen.width : screen.height;
        
        // Save resources for smaller screens:
        if (!datasourceOptions.imageSize || (screenSize.width <= 800 && datasourceOptions.imageSize != "medium"))
            datasourceOptions.imageSize = "medium";

		if (requireLookup)
		{
			$.jsonp({
				url: flickrApiUrl,
				async: false,
				dataType: 'jsonp',
				data: $.extend({ url: options.dataUrl, method: lookupData.method }, fixedOptions),
				callbackParameter: "jsoncallback",
				success: function(data)
				{
					$.extend(datasourceOptions, lookupData.onData(data));
					getData();
				}
			});
		}
		else
			getData();
		
		function getData()
		{
			var returnData = {};
			
			if (options.onLoadBegin)
				options.onLoadBegin();

			$.jsonp({
				url: flickrApiUrl,
				async: false,
				dataType: 'jsonp',
				data: datasourceOptions,
				callbackParameter: "jsoncallback",
				success: function(data)
				{console.log(data);
					returnData.images = self.getImagesDataFromJson(data, datasourceOptions);
					
					if (data.photosets || data.collections)
						$.extend(returnData, {
							createGroups: true
						});
						
					if (returnData.images.length > 0 && ((datasourceOptions.setThumbnail && !datasourceOptions.setSinglePhotosetThumbnails) || options.isSingleLink))
					{
						$.extend(returnData, {
							isGroup: true,
							link: getPhotosetUrl(data.photoset.owner, data.photoset.id),
							thumbnailSrc: options.isSingleLink ? undefined : getImageUrl(data.photoset.photo[0], flickrImageSizes[datasourceOptions.thumbsize]),
							title: "None"
						});
					}
				
					if (callback)
						callback(returnData);

					if (options.onLoadComplete)
						options.onLoadComplete();
				},
				error : function(xOptions, textStatus){
					if (options.onLoadError)
						options.onLoadError("Flickr plugin encountered an error while retrieving data");
				}
			});
		}
    }
	
	
    var flickrImageSizes = {
        smallSquare : "_s", // 75x75
        thumbnail : "_t", // 100px
        small : "_m", // 240px
        medium : "", // 500px
        large : "_b", // 1024px
        original : "_o"
    };
    function getImageUrl(photoData, size)
    {
        return "http://farm" + photoData.farm + ".static.flickr.com/" + photoData.server + "/" + (photoData.primary || photoData.id) + "_" + photoData.secret + size + ".jpg";
    }
    function getPhotosetUrl(userid, photosetId)
    {
         return prepareUrl(flickrUrl + "photos/" + userid + "/sets/" + photosetId + "/");
    }
    // makes sure a string can be used as a Flickr url
    function prepareUrl(url)
    {
        return url.replace(/\s/g, "_");
    }
    this.getImagesDataFromJson = function(data, datasourceOptions)
    {
		var isPhotos = data.photoset || data.photos;
		var photos;
		if (isPhotos)
			photos = data.photoset ? data.photoset.photo : data.photos.photo;
		else if (data.photosets)
			photos = data.photosets.photoset;
		else if (data.collections)
			photos = data.collections.collection[0].set;
			
		var imagesData = [];
		var inSet = data.photoset ? "/in/set-" + data.photoset.id : "";
		
		// Photos:
		if (photos)
		{
			var thumbSuffix = flickrImageSizes[datasourceOptions.thumbsize];
			var imageSuffix = flickrImageSizes[datasourceOptions.imageSize];
			
			jQuery.each(photos, function(i, photo){
				var imageData = {
					thumbnailSrc : getImageUrl(photo, thumbSuffix),
					link: prepareUrl(flickrUrl + "photos/" + (photo.owner || datasourceOptions.user_id) + "/" + photo.id + inSet),
					media: {
						src: getImageUrl(photo, imageSuffix),
						title: isPhotos ? photo.title : photo.title._content + (!isPhotos ? " (" + photo.photos + " images)" : ""),
						alt: photo.title._content || photo.title,
						description: photo.description ? photo.description._content : undefined
					}
				};
				
				if (!isPhotos)
					imageData.data = { photoset_id: photo.id };
					
				imagesData.push(imageData);
			});
		}
		
		return imagesData;
    }
}