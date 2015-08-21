var Gifffer = function() {
    var images = [], allImages, d = document, ga = 'getAttribute', sa = 'setAttribute';
    allImages = d && d.querySelectorAll ? d.querySelectorAll('img:not(.giffferated)[src]') : []; // [kajmagnus] use src not data-gifffer. Make Giffferate safe to run many times by excluding already handled gifs
    // Find gif images only: [kajmagnus]
    for (var index = 0; index < allImages.length; ++index) {
      var image = allImages[index];
      if (/^(https?:)?\/\/.+\.gif(\?.*)?$/.test(image.src)) {
        images.push(image);
      }
    }
    var createContainer = function(w, h, el) {
        var con = d.createElement('DIV'), cls = el[ga]('class'), id = el[ga]('id');
        cls ? con[sa]('class', el[ga]('class')) : null;
        id ? con[sa]('id', el[ga]('id')) : null;
        con[sa]('style', 'position:relative;cursor:pointer;width:' + w + 'px;max-width:100%;');  // [kajmagnus] max-width, remove height
        // creating play button
        var play = d.createElement('DIV');
        play[sa]('class','gifffer-play-button');
        // [kajmagnus] use left: calc... on the next line, insetad of calculating values in JS. Tweak colors: darker circle, bright solid triangle.
        play[sa]('style', 'width:60px;height:60px;border-radius:30px;background:rgba(0, 0, 0, 0.6);position:absolute;left: calc(50% - 30px);top: calc(50% - 40px);');
        var trngl = d.createElement('DIV');
        trngl[sa]('style', 'width:0;height: 0;border-top:14px solid transparent;border-bottom:14px solid transparent;border-left:14px solid #eee;position:absolute;left:26px;top:16px;')
        play.appendChild(trngl);
        // dom placement
        con.appendChild(play);
        el.parentNode.replaceChild(con, el);
        return {c: con, p: play };
    },
    i = 0,
    imglen = images.length,
    process = function(el) {
        var url, con, c, w, h, duration,play, gif, playing = false, cc, isC, durationTimeout;
        url = el[ga]('src'); // [kajmagnus] use src not data-gifffer
        w = el[ga]('data-gifffer-width');
        h = el[ga]('data-gifffer-height');
        duration = el[ga]('data-gifffer-duration');
        el.style.display = 'block';
        c = document.createElement('canvas');
        isC = !!(c.getContext && c.getContext('2d'));
        if(w && h && isC) cc = createContainer(w, h, el);
        el.onload = function() {
            if(isC) {
                w = w || el.naturalWidth || el.width;
                h = h || el.naturalHeight || el.height;
                // creating the container
                if(!cc) cc = createContainer(w, h, el);
                con = cc.c;
                play = cc.p;
                con.addEventListener('click', function(event) {
                    event.preventDefault(); // [kajmagnus] the <img> is wrapped in an <a href...>, don't follow the link.
                                            // [kajmagnus] WOULD add a link button next to the play btn so people can still go to the source of the gif?
                                            // [kajmagnus] Well they can just right click and choose 'copy link address' for now.
                    clearTimeout(durationTimeout);
                    if(!playing) {
                        playing = true;
                        gif = d.createElement('IMG');
                        gif[sa]('class', 'giffferated'); // [kajmagnus] Make Giffferate safe to run many times by marking already processed images.
                        gif[sa]('style', 'width:' + w + 'px;max-width: 100%;');  // [kajmagnus] max-width, remove height
                        gif[sa]('data-uri', Math.floor(Math.random()*100000) + 1);
                        setTimeout(function() {
                            gif.src = url;
                        }, 0);                        
                        con.removeChild(play);
                        con.removeChild(c);
                        con.appendChild(gif);
                        if(parseInt(duration) > 0) {
                            durationTimeout = setTimeout(function() {
                                playing = false;
                                con.appendChild(play);
                                con.removeChild(gif);
                                con.appendChild(c);
                                gif = null;
                            }, duration);
                        }
                    } else {
                        playing = false;
                        con.appendChild(play);
                        con.removeChild(gif);
                        con.appendChild(c);
                        gif = null;
                    }
                });
                // canvas
                c.width = w;
                c.height = h;
                c[sa]('style', 'max-width: 100%;');  // [kajmagnus] max-width
                c.getContext('2d').drawImage(el, 0, 0, w, h);
                con.appendChild(c);
            }
        }
        el.src = url;
    }
    for(i; i<imglen; ++i) process(images[i]);
}
