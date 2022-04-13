const { SftpLookupObject } = require('../utils/lookupObjectUtil');
const Sftp = require('../Sftp');

async function process(msg, cfg, snapshot = {}, headers, tokenData = {}) {
  cfg.token = cfg.token ? cfg.token : tokenData.apiKey;
  const sftpClient = new Sftp(this.logger, cfg);
  await sftpClient.connect();
  const lookupObjectAction = new SftpLookupObject(this.logger, sftpClient);
  const result = await lookupObjectAction.process(msg, cfg, snapshot);
  await sftpClient.end();
  return result;
}

module.exports.process = process;
