WxworkService = {
    serviceName: (Meteor.settings && Meteor.settings.public && Meteor.settings.public.wxworkServiceName) || 'wxwork'
};

Accounts.oauth.registerService(WxworkService.serviceName);