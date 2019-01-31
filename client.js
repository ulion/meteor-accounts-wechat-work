const serviceName = WxworkService.serviceName;

WxworkService.withinWeChatBrowser = (/micromessenger/i).test(navigator.userAgent);
WxworkService.withinWxworkBrowser = (/wxwork/i).test(navigator.userAgent);

WxworkService.signInMethodCfgs = {
  wxwork: {
    appIdField: 'suiteId',
    scope: 'snsapi_userinfo', // snsapi_privateinfo
    endpoint: 'https://open.weixin.qq.com/connect/oauth2/authorize',
    endpointSuffix: '&response_type=code#wechat_redirect'
  },
  webapp: {
    appIdField: 'providerId',
    endpoint: 'https://open.work.weixin.qq.com/wwopen/sso/3rd_qrConnect',
    endpointSuffix: '&usertype=member'
  }
};

// Request Wxwork credentials for the user
// @param options {optional}
// @param credentialRequestCompleteCallback {Function} Callback function to call on
//   completion. Takes one argument, credentialToken on success, or Error on
//   error.
WxworkService.requestCredential = function (options, credentialRequestCompleteCallback) {
  // support both (options, callback) and (callback).
  if (!credentialRequestCompleteCallback && typeof options === 'function') {
    credentialRequestCompleteCallback = options
    options = {}
  } else if (!options) {
    options = {}
  }

  var config = ServiceConfiguration.configurations.findOne({service: serviceName})
  if (!config) {
    credentialRequestCompleteCallback && credentialRequestCompleteCallback(
      new ServiceConfiguration.ConfigError()
    )
    return
  }

  WxworkService.signInMethod = WxworkService.withinWxworkBrowser && !!config.suiteId ? 'wxwork' : 'webapp';

  prepareLogin(launchLogin);

  function prepareLogin(callback) {
    let signInMethodCfg = WxworkService.signInMethodCfg = WxworkService.signInMethodCfgs[WxworkService.signInMethod];
    var appId = signInMethodCfg.appId = config[signInMethodCfg.appIdField];

    var credentialToken = Random.secret()
    var scope = (options && options.requestPermissions) || signInMethodCfg.scope;
    scope = _.map(scope, encodeURIComponent).join(',')
    var loginStyle = OAuth._loginStyle(serviceName, config, options)

    if (OAuth._stateParamAsync) {
      OAuth._stateParamAsync(loginStyle, credentialToken, options.redirectUrl, {appId}, (err, state) => {
        if (err) {
          console.error(err)
        } else {
          callback(signInMethodCfg, state, loginStyle, credentialToken)
        }
      })
    } else {
      var state = OAuth._stateParam(loginStyle, credentialToken, options.redirectUrl, {appId});
      callback(signInMethodCfg, state, loginStyle, credentialToken)
    }
  }

  function launchLogin (signInMethodCfg, state, loginStyle, credentialToken) {
    var loginUrl =
      signInMethodCfg.endpoint +
      '?appid=' + signInMethodCfg.appId +
      '&redirect_uri=' + encodeURIComponent(OAuth._redirectUri(serviceName, config, null, {replaceLocalhost: true})) +
      (signInMethodCfg.scope ? '&scope=' + signInMethodCfg.scope : '') +
      '&state=' + state +
      (signInMethodCfg.endpointSuffix || '')

    OAuth.launchLogin({
      loginService: serviceName,
      loginStyle: loginStyle,
      loginUrl: loginUrl,
      credentialRequestCompleteCallback: credentialRequestCompleteCallback,
      credentialToken: credentialToken
    })
  }
}

Meteor.loginWithWxwork = function (options, callback) {
  // support a callback without options
  if (!callback && typeof options === 'function') {
    callback = options
    options = null
  }

  var credentialRequestCompleteCallback = Accounts.oauth.credentialRequestCompleteHandler(callback)
  WxworkService.requestCredential(options, credentialRequestCompleteCallback)
}