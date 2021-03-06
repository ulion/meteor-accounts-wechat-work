import { check } from 'meteor/check';
import { checkNpmVersions } from 'meteor/tmeasday:check-npm-versions';

checkNpmVersions({
  'wechat-oauth': '*',
  'co-wxwork-api': '*'
}, 'ulion:accounts-wechat-work');

const WeChatOAuth = require('wechat-oauth');
const {ProviderAPI, SuiteAPI} = require('co-wxwork-api');

const whitelistedFields = [
  'name',
  'mobile',
  'email',
  'gender',
  'avatar'
];

const serviceName = WxworkService.serviceName;
const serviceVersion = 2;
const serviceUrls = null;

const getServiceConfig = function() {
  let config = ServiceConfiguration.configurations.findOne({
    service: serviceName
  });
  if (!config)
    throw new ServiceConfiguration.ConfigError();
  return config;
}

const serviceHandler = Meteor.wrapAsync(function(query, callback) {
  let config = getServiceConfig();

  getTokenResponse(config, query).then(serviceData => {
    serviceData.id = serviceData.userId + '@' + serviceData.cropId;

    let fields = _.pick(serviceData, whitelistedFields);

    callback(null, {
      serviceData: serviceData,
      options: {
        profile: fields
      }
    });
  })
  .catch(callback);
});

let getTokenResponse = async function(config, query) {
  let state;
  try {
    state = OAuth._stateFromQuery(query);
  } catch (err) {
    throw new Error("Failed to extract state in OAuth callback with Wxwork: " + query.state);
  }
  let response;
  try {
    if (state.appId === config.providerId) {
      // webapp??
      response = await (await WxworkService.getProviderAPI()).getLoginInfo(query.auth_code);

      console.log('loginInfo:', response);
      /*
{ usertype: 5,
user_info:
{ userid: '...',
name: '...',
email: '...',
avatar: '...' },
corp_info: { corpid: '...' },
agent: [] }
      */
      let ret = {
        appId: state.appId,
        cropId: response.corp_info.corpid,
        userId: response.user_info.userid
      };
      let fields = _.pick(response.user_info, whitelistedFields);
      _.extend(ret, fields);
      return ret;
    }
    else if (state.appId === config.suiteId){
      // within wechat work browser
      let suiteAPI = await WxworkService.getSuiteAPI();
      let ticket = await suiteAPI.getUserIdByCode(query.code);
      response = await suiteAPI.getUserInfoByTicket(ticket.user_ticket);

      console.log('userInfo:', response);
      /*
{
   "errcode": 0,
   "errmsg": "ok",
   "corpid":"wwxxxxxxyyyyy",
   "userid":"lisi",
   "name":"李四",
   "mobile":"15913215421",
   "gender":"1",
   "email":"xxx@xx.com",
   "avatar":"http://shp.qpic.cn/bizmp/xxxxxxxxxxx/0",
   "qr_code":"https://open.work.weixin.qq.com/wwopen/userQRCode?vcode=vcfc13b01dfs78e981c"
}
      */
      let ret = {
        appId: state.appId,
        cropId: response.corpid,
        userId: response.userid
      };
      let fields = _.pick(response, whitelistedFields);
      _.extend(ret, fields);
      return ret;
    }
    else {
      throw new Error('Unknow wxwork oauth appId: ' + state.appId);
    }
  } catch (err) {
    console.warn("Failed to finish oauth handshake:", err);
    throw _.extend(new Error("Failed to complete OAuth handshake with WxworkService. " + err.message), {
      response: err.response
    });
  }
};


// register OAuth service
OAuth.registerService(serviceName, serviceVersion, serviceUrls, serviceHandler);

// retrieve credential
WxworkService.retrieveCredential = function(credentialToken, credentialSecret) {
  return OAuth.retrieveCredential(credentialToken, credentialSecret);
};

Accounts.addAutopublishFields({
  forLoggedInUser: _.map(
    // why not publish openId and unionId?
    whitelistedFields.concat(['accessToken', 'expiresAt']), // don't publish refresh token
    function(subfield) {
      return 'services.' + serviceName + '.' + subfield;
    }
  ),

  forOtherUsers: _.map(
    whitelistedFields,
    function(subfield) {
      return 'services.' + serviceName + '.' + subfield;
    })
});

let providerAPI = null;
let suiteAPI = null;

WxworkService.getProviderAPI = async function() {
  if (providerAPI) {
    return providerAPI;
  }
  let config = await getServiceConfig();
  return providerAPI = new ProviderAPI(
    config.providerId,
    OAuth.openSecret(config.secret && config.secret.providerSecret || config.providerSecret),
    WxworkService.getProviderToken,
    WxworkService.setProviderToken
  );
}

WxworkService.getSuiteAPI = async function() {
  if (suiteAPI) {
    return suiteAPI;
  }
  let config = await getServiceConfig();
  suiteAPI = new SuiteAPI(
    config.suiteId,
    OAuth.openSecret(config.secret && config.secret.suiteSecret || config.suiteSecret),
    WxworkService.getSuiteToken,
    WxworkService.setSuiteToken
  );
  suiteAPI.registerTicketHandle(WxworkService.getTicket, WxworkService.setTicket);
  return suiteAPI;
}

let wechatOAuthAPI = null;
let sessionKeys = {};

const getWeChatOAuthAPI = function() {
  if (wechatOAuthAPI) {
    return wechatOAuthAPI;
  }
  let config = getServiceConfig();

  return wechatOAuthAPI = new WeChatOAuth(
    config.miniAppId,
    OAuth.openSecret(config.secret && config.secret.miniSecret || config.miniSecret),
    // XXX: store the token somewhere, and probably also allow the project custom
    //      the token load/save handler in the project rather than in this package code.
    /* function (openid, callback) {
      // 传入一个根据openid获取对应的全局token的方法
      // 在getUser时会通过该方法来获取token
      Token.getToken(openid, callback);
    }, function (openid, token, callback) {
      // 持久化时请注意，每个openid都对应一个唯一的token!
      Token.setToken(openid, token, callback);
    }, */
    WxworkService.getToken || null,
    function(openid, token, callback) {
      sessionKeys[openid] = token;
      WxworkService.setToken && WxworkService.setToken(openid, token, callback) || callback();
    },
    true
  );
}

const miniAppServiceHandler = function(query) {
  return new Promise(function(resolve, reject) {
    getWeChatOAuthAPI().getUserByCode(query, function(err, response) {
      if (err) {
        return reject(err);
      }
      const {
        watermark,
        openId,
        unionId
      } = response;
      let serviceData = {
        appId: watermark.appid,
        sessionKey: sessionKeys[openId],
        openId,
        unionId,
        id: useUnionIdAsMainId ? unionId : openId // id is required by Meteor
      };

      let fields = _.pick(response, whitelistedFields);
      fields.nickname = response.nickName;
      fields.sex = response.gender;
      fields.headimgurl = response.avatarUrl;
      _.extend(serviceData, fields);

      resolve({
        serviceData: serviceData,
        options: {
          profile: fields
        }
      });
    });
  });
};

Meteor.methods({
  handleWeChatWorkOauthRequest: function(query) {
    // allow the client with 3rd party authorization code to directly ask server to handle it
    check(query.code, String);
    let oauthResult = serviceHandler(query);
    let credentialSecret = Random.secret();

    //let credentialToken = OAuth._credentialTokenFromQuery(query);
    let credentialToken = query.state;
    // Store the login result so it can be retrieved in another
    // browser tab by the result handler
    OAuth._storePendingCredential(credentialToken, {
      serviceName: serviceName,
      serviceData: oauthResult.serviceData,
      options: oauthResult.options
    }, credentialSecret);

    // return the credentialToken and credentialSecret back to client
    return {
      'credentialToken': credentialToken,
      'credentialSecret': credentialSecret
    };
  },
  weChatWorkMiniAppLogin: async function(query) {
    // accept wechat mini app wx.login() result 'code' and wx.getUserInfo() result iv and encryptedData
    check(query.code, String);
    check(query.encryptedData, String);
    check(query.iv, String);
    //query.state = 'wechat-mini-app';
    let oauthResult = await miniAppServiceHandler(query);
    let credentialSecret = Random.secret();

    // Use the code as token
    let credentialToken = query.code;
    // Store the login result so it can be retrieved in another
    // browser tab by the result handler
    OAuth._storePendingCredential(credentialToken, {
      serviceName: serviceName,
      serviceData: oauthResult.serviceData,
      options: oauthResult.options
    }, credentialSecret);

    // XXX: what if we directly call the login with oauth token/secret?
    //      do we need response the token/secret and let client do the oauth login call
    //      or we can directly do it here???? we need test
    /* return Meteor.call('login', {
      oauth: {
        credentialToken: credentialToken,
        credentialSecret: credentialSecret
      }
    }); */

    // return the credentialToken and credentialSecret back to client
    return {
      'credentialToken': credentialToken,
      'credentialSecret': credentialSecret
    };
  }
});
