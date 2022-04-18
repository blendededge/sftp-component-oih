const { wrapper } = require('@blendededge/ferryman-extensions');
const { SftpPolling } = require('../utils/pollingUtil');
const Sftp = require('../Sftp');

async function process(msg, cfg, snapshot = {}, headers, tokenData = {}) {
  // eslint-disable-next-line no-param-reassign
  cfg.token = cfg.token ? cfg.token : tokenData.apiKey;
  const wrapped = wrapper(this, msg, cfg, {});

  const sftpClient = new Sftp(this.logger, cfg);
  await sftpClient.connect();
  const pollingTrigger = new SftpPolling(this.logger, wrapped, sftpClient, cfg);
  await pollingTrigger.process(cfg, snapshot);
  return sftpClient.end();
}

module.exports.process = process;
