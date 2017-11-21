// From: https://github.com/Cap32/tiny-querystring
// Downloaded on 2017-11-21 like so:  wget https://unpkg.com/tiny-querystring/dist/tiny-querystring.umd.js
// Copyright: Christopher Peng, https://github.com/Cap32
// License: MIT
// I (KajMagnus) made some changes, also MIT licensed, see "[KajMagnus]".

(function (global, factory) {
	if (typeof define === "function" && define.amd) {
		define(['exports'], factory);
	} else if (typeof exports !== "undefined") {
		factory(exports);
	} else {
		var mod = {
			exports: {}
		};
		factory(mod.exports);
		// [KajMagnus]
		// No:
		// global.tinyQuerystring = mod.exports;
		// Instead:
		global.parseQueryString = mod.exports.parse;
		global.stringifyQueryString = mod.exports.stringify;
	}
})(this, function (exports) {
	'use strict';

	exports.__esModule = true;
	exports.parse = parse;
	exports.stringify = stringify;
	function parse(str) {
		return (str + '').replace(/\+/g, ' ').split('&').filter(function (item) {
			return !/^\s*$/.test(item);
		}).reduce(function (obj, item, index) {
			var ref = item.split('=');
			var key = ref[0] || '';
			// [KajMagnus] Drop any '?' in case it's part of the query string.
			if (key[0] === '?') key = key.substr(1);
			var val = decodeURIComponent(ref[1] || '');
			var prev = obj[key];
			obj[key] = prev === undefined ? val : [].concat(prev, val);
			return obj;
		}, {});
	};

	function stringify(obj) {
		return Object.keys(obj || {}).reduce(function (arr, key) {
			var val = obj[key];
			if (val instanceof Array) {
				val = val.join('&' + key + '=');
			}
			arr.push(key + '=' + val);
			return arr;
		}, []).join('&').replace(/\s/g, '+');
	};
});
