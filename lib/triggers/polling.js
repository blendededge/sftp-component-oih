const { SftpPolling } = require('../utils/pollingUtil');
const Sftp = require('../Sftp');

async function process(msg, cfg, snapshot = {}, headers, tokenData = {}) {
  cfg.token = cfg.token ? cfg.token : tokenData.apiKey;
  const sftpClient = new Sftp(this.logger, cfg);
  await sftpClient.connect();
  const pollingTrigger = new SftpPolling(this.logger, this, sftpClient, cfg);
  await pollingTrigger.process(cfg, snapshot);
  return sftpClient.end();
}

module.exports.process = process;
