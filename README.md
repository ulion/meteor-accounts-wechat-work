# ulion:accounts-wechat
Meteor accounts package for wechat work.
Because this package is generally used in China, this doc will be written in chinese.

## 简介
- 使Meteor应用支持**企业微信**登录
- 在企业微信浏览器内利用OAuth登录，在企业微信浏览器之外为扫码登录

## 用法

### 1. 添加包
```
meteor add ulion:accounts-wechat-work
meteor add service-configuration
```

### 2. 配置
server端：
```
ServiceConfiguration.configurations.upsert({
    service: Wxwork.serviceName // 可以通过Meteor.settings.public.wxworkServiceName来修改这个值
}, {
    $set: {
        appId: '...',
        secret: '...',
        mpAppId: '...',
        mpSecret: '...',
        mainId: 'unionId'
    }
});
```

### 3. 登录
client端：
```
Meteor.loginWithWxwork(function(err, res){
   ...
})
```

### Note
企业微信相关应用的授权回调域、对应Meteor应用的ROOT_URL以及用户访问该应用的实际url必须保持一致。
