const { transform } = require('@openintegrationhub/ferryman');

const authTypes = {
  NO_AUTH: 'No Auth',
  BASIC: 'Basic Auth',
  API_KEY: 'API Key Auth',
};

function getAuthFromSecretConfig(cfg, logger) {
  const {
    username, passphrase, key, headerName, secretAuthTransform,
  } = cfg;
  const returnConfig = { ...cfg };
  const { auth = {} } = returnConfig;

  // Use JSONata to populate cfg.auth object, works for all types but especially helpful for the MIXED type
  if (secretAuthTransform) {
    returnConfig.auth = transform(cfg, { customMapping: secretAuthTransform });
    logger.debug(`helpers.getAuthFromSecretConfig: after transforming auth config: ${JSON.stringify(returnConfig)}`);
    return returnConfig;
  }
  // Found username and password, authenticate with basic authentication
  if (username && passphrase) {
    auth.basic = auth.basic ? auth.basic : {};
    auth.type = authTypes.BASIC;
    auth.basic.username = username;
    auth.basic.password = passphrase;
  }
  // Found API_KEY type
  if (key) {
    auth.type = authTypes.API_KEY;
    auth.apiKey = auth.apiKey ? auth.apiKey : {};
    auth.apiKey.headerName = headerName;
    auth.apiKey.headerValue = key;
  }

  returnConfig.auth = auth;
  logger.debug(`helpers.getAuthFromSecretConfig: config object is now: ${JSON.stringify(returnConfig)}`);
  return returnConfig;
}

module.exports = {
  getAuthFromSecretConfig,
  authTypes,
};
