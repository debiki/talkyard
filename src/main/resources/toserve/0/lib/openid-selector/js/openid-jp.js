/*
	Simple OpenID Plugin
	http://code.google.com/p/openid-selector/
	
	This code is licensed under the New BSD License.
*/

var providers_large = {
	google : {
		name : 'Google',
		url : 'https://www.google.com/accounts/o8/id'
	},
	yahoo : {
		name : 'Yahoo',
		url : 'http://me.yahoo.com/'
	},
	aol : {
		name : 'AOL',
		label : 'AOLのスクリーンネームを記入してください。',
		url : 'http://openid.aol.com/{username}'
	},
	myopenid : {
		name : 'MyOpenID',
		label : 'MyOpenIDのユーザーネームを記入してください。',
		url : 'http://{username}.myopenid.com/'
	},
	openid : {
		name : 'OpenID',
		label : 'OpenIDを記入してください。',
		url : null
	}
};

var providers_small = {
	livejournal : {
		name : 'LiveJournal',
		label : 'LiveJournalのユーザーネームを記入してください。',
		url : 'http://{username}.livejournal.com/'
	},
	/* flickr: {
		name: 'Flickr',        
		label: 'Flickrのユーザーネームを記入してください。',
		url: 'http://flickr.com/{username}/'
	}, */
	/* technorati: {
		name: 'Technorati',
		label: 'Technoratiのユーザーネームを記入してください。',
		url: 'http://technorati.com/people/technorati/{username}/'
	}, */
	wordpress : {
		name : 'Wordpress',
		label : 'Wordpress.comのユーザーネームを記入してください。',
		url : 'http://{username}.wordpress.com/'
	},
	blogger : {
		name : 'Blogger',
		label : 'Bloggerのアカウントを記入してください。',
		url : 'http://{username}.blogspot.com/'
	},
	verisign : {
		name : 'Verisign',
		label : 'Verisignのユーザーネームを記入してください。',
		url : 'http://{username}.pip.verisignlabs.com/'
	},
	/* vidoop: {
		name: 'Vidoop',
		label: 'Vidoopのユーザーネームを記入してください。',
		url: 'http://{username}.myvidoop.com/'
	}, */
	/* launchpad: {
		name: 'Launchpad',
		label: 'Launchpadのユーザーネームを記入してください。',
		url: 'https://launchpad.net/~{username}'
	}, */
	claimid : {
		name : 'ClaimID',
		label : 'ClaimIDのユーザーネームを記入してください。',
		url : 'http://claimid.com/{username}'
	},
	clickpass : {
		name : 'ClickPass',
		label : 'ClickPassのユーザーネームを記入してください。',
		url : 'http://clickpass.com/public/{username}'
	},
	google_profile : {
		name : 'Google Profile',
		label : 'Google Profileのユーザーネームを記入してください。',
		url : 'http://www.google.com/profiles/{username}'
	}
};

openid.locale = 'jp';
openid.sprite = 'en'; // use same sprite as english localization
openid.demo_text = '今クライアントデモモードになっています。普通は次のOpenIDを出さなければいけません:';
openid.signin_text = 'ログイン';
openid.image_title = '{provider}でログイン';