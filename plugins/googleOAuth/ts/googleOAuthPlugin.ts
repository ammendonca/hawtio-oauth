/// <reference path="googleOAuthHelpers.ts"/>

module GoogleOAuth {
  export var _module = angular.module(pluginName, []);
  var userProfile:any = undefined
  hawtioPluginLoader.addModule(pluginName);

  _module.config(['$provide', ($provide) => {
    $provide.decorator('userDetails', ['$delegate', ($delegate) => {
      if (userProfile) {
        return _.merge($delegate, userProfile, {
          username: userProfile.fullName,
          logout: () => {
            doLogout(GoogleOAuthConfig, userProfile);
          }
        });
      } else {
        return $delegate;
      }
    }]);
  }]);

  _module.config(['$httpProvider', ($httpProvider) => {
    if (userProfile && userProfile.token) {
      $httpProvider.defaults.headers.common = {
        'Authorization': 'Bearer ' + userProfile.token
      }
    }
  }]);

  _module.run(['userDetails', (userDetails) => {
    // log.debug("loaded, userDetails: ", userDetails);
  }]);

  hawtioPluginLoader.registerPreBootstrapTask((next) => {
    if (!window['GoogleOAuthConfig']) {
      log.debug("oauth disabled");
      next();
      return;
    }
    if (!GoogleOAuthConfig.clientId ||
        !GoogleOAuthConfig.redirectURI ||
        !GoogleOAuthConfig.scope ||
        !GoogleOAuthConfig.url)
    {
      log.warn("Invalid oauth config, disabled oauth");
      next();
      return;
    }
    log.debug("config: ", GoogleOAuthConfig);

    var currentURI = new URI(window.location.href);
    var authorizationCode = checkAuthorizationCode(currentURI);
    if (authorizationCode) {
      exchangeCodeForToken(GoogleOAuthConfig, authorizationCode, {
        type: 'POST',
        uri: currentURI.toString(),
      });
    } else {
      var fragmentParams = checkToken(currentURI);
      if (fragmentParams) {
        var tmp = {
          token: fragmentParams.access_token,
          expiry: fragmentParams.expires_in,
          type: fragmentParams.token_type
        }
        var uri = new URI(GoogleOAuthConfig.url);
        authenticatedHttpRequest({
          type: 'GET',
          url: uri.toString(),
        }, tmp).done((response) => {
          userProfile = {};
          _.extend(userProfile, tmp, response);
          $.ajaxSetup({
            beforeSend: (xhr) => {
              xhr.setRequestHeader('Authorization', 'Bearer ' + tmp.token);
            }
          });
        }).fail(() => {
          clearTokenStorage();
          doLogin(GoogleOAuthConfig, {
            uri: currentURI.toString()
          });
        }).always(() => {
          next();
        });
      } else {
        clearTokenStorage();
        doLogin(GoogleOAuthConfig, {
          uri: currentURI.toString()
        });
      }
    }
  });




  }
