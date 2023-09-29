const { wrapper } = require('@blendededge/ferryman-extensions');
const { SftpPolling } = require('../utils/pollingUtil');
const Sftp = require('../Sftp');

async function process(msg, cfg, snapshot, headers, tokenData = {}) {
  // eslint-disable-next-line no-param-reassign
  cfg.token = cfg.token ? cfg.token : tokenData.apiKey;
  const wrapped = await wrapper(this, msg, cfg, snapshot, headers, tokenData);

  const sftpClient = new Sftp(wrapped.logger, cfg);
  await sftpClient.connect();
  const pollingTrigger = new SftpPolling(wrapped.logger, wrapped, sftpClient, cfg);
  await pollingTrigger.process(cfg, snapshot);
  const result = sftpClient.end();
  wrapped.emit('end');
  return result;
}

module.exports.process = process;
