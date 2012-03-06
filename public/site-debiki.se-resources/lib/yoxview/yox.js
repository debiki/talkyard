Yox = {
    // Adds a stylesheet link reference in the specified document's HEAD
    addStylesheet: function(_document, cssUrl)
    {
        var cssLink = _document.createElement("link");
        cssLink.setAttribute("rel", "Stylesheet");
        cssLink.setAttribute("type", "text/css");
        cssLink.setAttribute("href", cssUrl);
        _document.getElementsByTagName("head")[0].appendChild(cssLink);
    },
    compare: function(obj1, obj2)
    {
		if (typeof(obj1) != typeof(obj2))
			return false;
		else if (typeof(obj1) == "function")
			return obj1 == obj2;
			
        // deep-compare objects:
        function size(obj)
        {
            var size = 0;
            for (var keyName in obj)
            {
                if (keyName != null)
                    size++;
            }
            return size;
        }
        
        if (size(obj1) != size(obj2))
            return false;
            
        for(var keyName in obj1)
        {
            var value1 = obj1[keyName];
            var value2 = obj2[keyName];
            
            if (typeof value1 != typeof value2)
                return false;

            if (value1 && value1.length && (value1[0] !== undefined && value1[0].tagName))
            {
                if(!value2 || value2.length != value1.length || !value2[0].tagName || value2[0].tagName != value1[0].tagName)
                    return false;
            }
            else if (typeof value1 == 'function' || typeof value1 == 'object') {
                var equal = Yox.compare(value1, value2);
                if (!equal)
                    return equal;
            }
            else if (value1 != value2)
                return false;
        }
        return true;
    },
    hasProperties: function(obj){
        var hasProperties = false;
        for(pName in obj)
        {
            hasProperties = true;
            break;
        }
        return hasProperties;        
    },
    dataSources: [],
    fitImageSize: function(imageSize, targetSize, enlarge, isFill)
	{
		var resultSize = { width: imageSize.width, height: imageSize.height};
		if ((imageSize.width > targetSize.width) ||
		    (enlarge && imageSize.width < targetSize.width) )
		{
			resultSize.height = Math.round((targetSize.width / imageSize.width) * imageSize.height);
			resultSize.width = targetSize.width;
		}
		
		if (!isFill && resultSize.height > targetSize.height)
		{
			resultSize.width = Math.round((targetSize.height / resultSize.height) * resultSize.width);
			resultSize.height = targetSize.height;
		}
		else if (isFill && resultSize.height < targetSize.height && (targetSize.height <= imageSize.height || enlarge))
		{
			resultSize.height = targetSize.height;
			resultSize.width = Math.round((targetSize.height / imageSize.height) * imageSize.width);
		}
		
		return resultSize;
	},
	flashVideoPlayers: {
	    jwplayer: function(swfUrl, videoUrl, imageUrl, title, flashVars){
	        var returnData = {
	            swf: swfUrl || "/jwplayer/player.swf",
	            flashVars: {
    	            file: videoUrl,
	                image: imageUrl,
	                stretching: "fill",
	                title: title,
	                backcolor: "000000",
	                frontcolor: "FFFFFF"
	            }
	        }
	        $.extend(returnData.flashVars, flashVars);
	        return returnData;
	    }
	},
    getDataSourceName: function(url)
    {
        for(dataSourceIndex in Yox.Regex.data)
        {
            if(url.match(Yox.Regex.data[dataSourceIndex]))
                return dataSourceIndex;
        }
        return null;
    },
    getPath: function(pathRegex)
    {
        var scripts = document.getElementsByTagName("script");
        for(var i=0; i<scripts.length; i++)
        {
            var currentScriptSrc = scripts[i].src;
            var matchPath = currentScriptSrc.match(pathRegex);
            if (matchPath)
                return matchPath[1];
        }
        
        return null;
    },
    getTopWindow: function()
    {
        var topWindow = window;
        if (window.top)
            topWindow = window.top;
        else
        {
            while(topWindow.parent)
                topWindow = topWindow.parent;
        }
        
        return topWindow;
    },
    getUrlData: function(url)
    {
        var urlMatch = url.match(Yox.Regex.url);
        
        if (!urlMatch)
            return null;
            
        var urlData = {
            path: urlMatch[1],
            anchor: urlMatch[3]
        }
        
        if (urlMatch[2])
            urlData.queryFields = this.queryToJson(urlMatch[2]);
        
        return urlData;
    },
    hex2rgba: function(hex, alpha)
    {
        hex = parseInt(hex.replace("#", "0x"), 16);
		var r = (hex & 0xff0000) >> 16;
		var g = (hex & 0x00ff00) >> 8;
		var b = hex & 0x0000ff;
        return "rgba(" + r + ", " + g + ", " + b + ", " + (typeof(alpha) != 'undefined' ? alpha : "1") + ")";
    },
    queryToJson: function(query)
    {
        if (!query)
            return null;
            
        var queryParams = query.split("&");
        var json = {};
        for(var i=0; i < queryParams.length; i++)
        {
            var paramData = queryParams[i].split('=');
            if (paramData.length == 2)
                json[paramData[0]] = paramData[1];
        }
        return json;
    },
    loadDataSource: function(options, callback)
    {
        var dataSourceName;
        if (options.dataUrl)
        {
            dataSourceName = Yox.getDataSourceName(options.dataUrl);
            if (dataSourceName)
                $.extend(options, { dataSource: dataSourceIndex });
        }
        if (options.dataSource && !Yox.dataSources[dataSourceName])
        {
            $.ajax({
                url : options.dataFolder + options.dataSource + ".js", 
                async : false,
                dataType : "script",
                success: function(data){
                    eval(data);
                    eval ("Yox.dataSources['" + options.dataSource + "'] = new yox_" + options.dataSource + "();");                      
                    callback(Yox.dataSources[options.dataSource]);
                },
                error : function(XMLHttpRequest, textStatus, errorThrown)
                {
                    console.log(XMLHttpRequest, textStatus, errorThrown);
                }
            });
        }
        else if (callback)
            callback();
    },
    Regex: {
        data: {
            picasa: /http:\/\/(?:www\.)?picasaweb\.google\..*/i,
            flickr: /http:\/\/(?:www\.)?flickr.com/i,
            smugmug: /http:\/\/.*\.smugmug.com/i,
            youtube: /^http:\/\/(?:www\.)?youtube.com\//
        },
        flash: /^(.*\.(swf))(\?[^\?]+)?/i,
        flashvideo: /^(.*\.(flv|f4v|f4p|f4a|f4b|aac))(\?[^\?]+)?/i,
        image: /^[^\?#]+\.(?:jpg|jpeg|gif|png)$/i,
        url: /^([^#\?]*)?(?:\?([^\?#]*))?(?:#([A-Za-z]{1}[A-Za-z\d-_\:\.]+))?$/, // [0] - whole url, [1] - path, [2] - query (sans '?'), [3] - anchor
        video: {
            youtube: /.*youtube.com\/watch.*(?:v=[^&]+).*/i,
            vimeo: /vimeo.com\/\d+/i,
            hulu: /hulu.com\/watch\//i,
            viddler: /viddler.com\//i,
            flickr: /.*flickr.com\/.*/i,
            myspace: /.*vids.myspace.com\/.*/i,
            qik: /qik.com/i,
            revision3: /revision3.com/i,
            dailymotion: /dailymotion.com/i,
            "5min": /.*5min\.com\/Video/i
        }
    },
    Sprites: function(sprites, spritesImage, srcImage)
    {
        var cacheImg = new Image();
        cacheImg.src = spritesImage;
        this.spritesImage = spritesImage;
        
        var currentTop = 0;
        jQuery.each(sprites, function(i, spriteGroup){
            spriteGroup.top = currentTop;
            currentTop += spriteGroup.height;
        });

        this.getSprite = function(spriteGroup, spriteName, title)
        {
            return jQuery("<img/>", {
                src: srcImage,
                alt: spriteName,
				title: title,
                css: {
                    width: sprites[spriteGroup].width,
                    height: sprites[spriteGroup].height,
                    "background-image": "url(" + spritesImage + ")",
                    "background-repeat": "no-repeat",
                    "background-position": this.getBackgroundPosition(spriteGroup, spriteName)
                }
            });
        }
        this.getBackgroundPosition = function(spriteGroup, spriteName)
        {
            var backgroundLeft = jQuery.inArray(spriteName, sprites[spriteGroup].sprites) * (sprites[spriteGroup].width || 0);
            return "-" + backgroundLeft + "px -" + sprites[spriteGroup].top + "px";
        }
    },
    Support: {
        rgba: function()
        {
            // From http://leaverou.me/2009/03/check-whether-the-browser-supports-rgba-and-other-css3-values/
	        if(!('result' in arguments.callee))
	        {
	            var element = document.createElement('div');
		        var testColor = 'rgba(0, 0, 0, 0.5)';
		        var result = false;
		        
		        try {
			        element.style.color = testColor;
			        result = /^rgba/.test(element.style.color);
		        } catch(e) {}
		        element = null;
		        arguments.callee.result = result;
	        }
	        return arguments.callee.result;
        }
    },
    urlDataToPath: function(urlData)
    {
        var path = urlData.path ||"";
        if (urlData.queryFields && this.hasProperties(urlData.queryFields))
        {
            path += "?";
            for(field in urlData.queryFields)
            {
                path += field + "=" + urlData.queryFields[field] + "&";
            }
            path = path.substring(0, path.length-1);
        }
        if (urlData.anchor)
            path += "#" + urlData.anchor;
            
        return path;
    }
}