const { wrapper } = require('@blendededge/ferryman-extensions');
const { SftpLookupObject } = require('../utils/lookupObjectUtil');
const Sftp = require('../Sftp');

async function process(msg, cfg, snapshot, headers, tokenData = {}) {
  // eslint-disable-next-line no-param-reassign
  cfg.token = cfg.token ? cfg.token : tokenData.apiKey;
  const wrapped = await wrapper(this, msg, cfg, snapshot, headers, tokenData);
  const sftpClient = new Sftp(wrapped.logger, cfg);
  await sftpClient.connect();
  const lookupObjectAction = new SftpLookupObject(wrapped.logger, sftpClient);
  const result = await lookupObjectAction.process(msg, cfg, snapshot);
  await sftpClient.end();
  return result;
}

module.exports.process = process;
