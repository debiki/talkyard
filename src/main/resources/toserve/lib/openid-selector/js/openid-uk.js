/*
	Simple OpenID Plugin
	http://code.google.com/p/openid-selector/
	
	This code is licensed under the New BSD License.
*/

var providers_large = {
	yandex : {
		name : 'Яндекс',
		url : 'http://openid.yandex.ru'
	},
	rambler : {
		name : 'Рамблер',
		url : 'http://www.rambler.ru'
	},
	google : {
		name : 'Google',
		url : 'https://www.google.com/accounts/o8/id'
	},
	yahoo : {
		name : 'Yahoo',
		url : 'http://me.yahoo.com/'
	},
	myopenid : {
		name : 'MyOpenID',
		label : 'Введіть ваше ім\'я користувача на MyOpenID.',
		url : 'http://{username}.myopenid.com/'
	}
};

var providers_small = {
	openid : {
		name : 'OpenID',
		label : 'Введіть ваш OpenID.',
		url : null
	},
	livejournal : {
		name : 'Живий Журнал',
		label : 'Введіть ваше ім\'я в Живому Журналі.',
		url : 'http://{username}.livejournal.com/'
	},
	flickr : {
		name : 'Flickr',
		label : 'Введіть ваше ім\'я на Flickr.',
		url : 'http://flickr.com/{username}/'
	},
	wordpress : {
		name : 'Wordpress',
		label : 'Введіть ваше ім\'я на Wordpress.com.',
		url : 'http://{username}.wordpress.com/'
	},
	blogger : {
		name : 'Blogger',
		label : 'Ваш Blogger аккаунт',
		url : 'http://{username}.blogspot.com/'
	},
	verisign : {
		name : 'Verisign',
		label : 'Ваше ім\'я користувача на Verisign',
		url : 'http://{username}.pip.verisignlabs.com/'
	},
	google_profile : {
		name : 'Профіль Google',
		label : 'Введіть ваше ім\'я на Google Profile',
		url : 'http://www.google.com/profiles/{username}'
	}
};

openid.locale = 'uk';
openid.sprite = 'ru'; // use same sprite as russian localization
openid.demo_text = 'В демонстраційному режимі на клієнті. Насправді пройшов би сабміт наступного OpenID:';
openid.signin_text = 'Увійти';
openid.image_title = 'увійти з {provider}';
