const { wrapper } = require('@blendededge/ferryman-extensions');
const { SftpPolling } = require('../utils/pollingUtil');
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
    const pollingTrigger = new SftpPolling(wrapped.logger, wrapped, sftpClient, cfg);
    await pollingTrigger.process(cfg, snapshot);
    const result = sftpClient.end();
    wrapped.emit('end');
    return result;
  } catch (e) {
    const context = wrapped || this;
    context.emit('error', e);
    context.logger.error(`Error in polling trigger: ${e}`);
  }
}

module.exports.process = process;
