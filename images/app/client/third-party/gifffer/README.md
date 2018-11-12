From here: https://github.com/krasimir/gifffer

# Gifffer

---

> 1.8K JavaScript library that prevents the autoplaying of the animated Gifs.

## Usage

Include `gifffer.min.js` in your page.

```html
<script type="text/javascript" src="gifffer.min.js"></script>
```

Instead of setting `src` attribute on your image use `data-gifffer`.

```html
<img data-gifffer="image.gif" />
```

At the end, call `Gifffer();` whenever you want. For example:

```js
window.onload = function() {
    Gifffer();
}
```

Gifffer will show the controls immediately if you set `data-gifffer-width` and `data-gifffer-height` even if the image is not fully loaded.

	<img data-gifffer="image.gif" data-gifffer-width="250" data-gifffer-height="237" />

Have in mind that the library keeps the value of the `class` and `id` attributes. They are applied to the newly created element.

If you want to stop the Gif and reset it to its original position use `data-gifffer-duration` (in milliseconds).

	<img data-gifffer="image.gif" data-gifffer-duration="4000" data-gifffer-width="250" data-gifffer-height="237" /> 

## Demo

[http://work.krasimirtsonev.com/git/gifffer/example/](http://work.krasimirtsonev.com/git/gifffer/example/)

## How it works

It replaces your `<img>` tag with newly generated `<div>` that contains only the first frame (roughly) of your animated Gif. It creates a *play* button on top of it and when the element is clicked it returns the original image.

## Compatibility

Chrome, FF, Safari, Opera, IE9+

## Side effects

Your `<img>` tag is replaced by a `<div>`. Consider the fact that it is a block element.

## Inspiration

[http://stackoverflow.com/a/4276742/642670](http://stackoverflow.com/a/4276742/642670)
