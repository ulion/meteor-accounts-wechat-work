Package.describe({
    name: 'ulion:accounts-wechat-work',
    version: '0.1.0',
    summary: 'meteor accounts package for wechat work',
    git: 'https://github.com/ulion/meteor-accounts-wechat-work',
    documentation: 'README.md'
});

Package.onUse(function (api) {
    api.versionsFrom('1.2.1');
    api.use('ecmascript');
    api.use('underscore');
    api.use('random');
    api.use('service-configuration');
    api.use('accounts-base');
    api.use('oauth');
    api.use('oauth2');
    api.use('accounts-oauth');
    api.use('http', 'server');
    api.use('templating', 'client');
    api.use('tmeasday:check-npm-versions@0.3.2');

    api.imply('accounts-base');

    api.addFiles('common.js');
    api.addFiles('client.js', 'client');
    api.addFiles('server.js', 'server');

    api.addFiles('wechat_configure.html', 'client');
    api.addFiles('wechat_configure.js', 'client');
    api.addFiles('wechat_login_button.css', 'client');

    api.export('WxworkService')
});

/*
// this dependency is optional, only if the cordova wechat plugin is installed and mobileAppId is configured.
Cordova.depends({
    'cordova-plugin-wechat': '2.3.0'
});
*/
