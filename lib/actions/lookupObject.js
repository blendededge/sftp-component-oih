const { wrapper } = require('@blendededge/ferryman-extensions');
const { SftpLookupObject } = require('../utils/lookupObjectUtil');
const Sftp = require('../Sftp');

// eslint-disable-next-line consistent-return
async function process(msg, cfg, snapshot, headers, tokenData = {}) {
  let wrapped;
  try {
    // eslint-disable-next-line no-param-reassign
    cfg.token = cfg.token ? cfg.token : tokenData.apiKey;
    wrapped = await wrapper(this, msg, cfg, snapshot, headers, tokenData);
    const sftpClient = new Sftp(wrapped.logger, cfg);
    await sftpClient.connect();
    const lookupObjectAction = new SftpLookupObject(wrapped.logger, sftpClient);
    const result = await lookupObjectAction.process(msg, cfg, snapshot);
    await sftpClient.end();
    return result;
  } catch (e) {
    const context = wrapped || this;
    context.emit('error', e);
    context.logger.error(`Error in lookupObject action: ${e}`);
  }
}

module.exports.process = process;
