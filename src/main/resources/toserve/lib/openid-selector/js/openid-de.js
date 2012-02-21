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
		label : 'Bitte den AOL Benutzernamen eingeben.',
		url : 'http://openid.aol.com/{username}'
	},
	myopenid : {
		name : 'MyOpenID',
		label : 'Bitte den MyOpenID Benutzernamen eingeben.',
		url : 'http://{username}.myopenid.com/'
	},
	openid : {
		name : 'OpenID',
		label : 'Bitte OpenID eingeben.',
		url : null
	}
};

var providers_small = {
	livejournal : {
		name : 'LiveJournal',
		label : 'Bitte den LiveJournal Benutzernamen eingeben.',
		url : 'http://{username}.livejournal.com/'
	},
	/* flickr: {
		name: 'Flickr',        
		label: 'Bitte den Flickr Benutzernamen eingeben.',
		url: 'http://flickr.com/{username}/'
	}, */
	/* technorati: {
		name: 'Technorati',
		label: 'Bitte den Technorati Benutzernamen eingeben.',
		url: 'http://technorati.com/people/technorati/{username}/'
	}, */
	wordpress : {
		name : 'Wordpress',
		label : 'Bitte den Wordpress.com Benutzernamen eingeben.',
		url : 'http://{username}.wordpress.com/'
	},
	blogger : {
		name : 'Blogger',
		label : 'Ihr Blogger Konto',
		url : 'http://{username}.blogspot.com/'
	},
	verisign : {
		name : 'Verisign',
		label : 'Ihr Verisign Benutzername',
		url : 'http://{username}.pip.verisignlabs.com/'
	},
	/* vidoop: {
		name: 'Vidoop',
		label: 'Ihr Vidoop Benutzername',
		url: 'http://{username}.myvidoop.com/'
	}, */
	/* launchpad: {
		name: 'Launchpad',
		label: 'Ihr Launchpad Benutzername',
		url: 'https://launchpad.net/~{username}'
	}, */
	claimid : {
		name : 'ClaimID',
		label : 'Ihr ClaimID Benutzername',
		url : 'http://claimid.com/{username}'
	},
	clickpass : {
		name : 'ClickPass',
		label : 'Bitte den ClickPass Benutzernamen eingeben',
		url : 'http://clickpass.com/public/{username}'
	},
	google_profile : {
		name : 'Google Profile',
		label : 'Bitte den Google Profile Benutzernamen eingeben',
		url : 'http://www.google.com/profiles/{username}'
	}
};

openid.locale = 'de';
openid.sprite = 'en'; // use same sprite as english localization
openid.demo_text = 'Demo Modus. Normalerweise würde die folgende OpenID übermittelt werden:';
openid.signin_text = 'Anmelden';
openid.image_title = 'Mit {provider} anmelden';
