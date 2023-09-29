const { wrapper } = require('@blendededge/ferryman-extensions');
const { SftpDelete } = require('../utils/deleteUtil');
const Sftp = require('../Sftp');

async function process(msg, cfg, snapshot, headers, tokenData = {}) {
  const wrapped = await wrapper(this, msg, cfg, snapshot, headers, tokenData);
  // eslint-disable-next-line no-param-reassign
  cfg.token = cfg.token ? cfg.token : tokenData.apiKey;
  const sftpClient = new Sftp(wrapped.logger, cfg);
  await sftpClient.connect();
  const deleteAction = new SftpDelete(wrapped.logger, sftpClient);
  return deleteAction.process(msg, cfg, snapshot);
}

module.exports.process = process;
