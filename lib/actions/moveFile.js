const { wrapper } = require('@blendededge/ferryman-extensions');
const Sftp = require('../Sftp');

// eslint-disable-next-line no-unused-vars
async function process(msg, cfg, snapshot, headers, tokenData = {}) {
  let wrapped;
  try {
    // eslint-disable-next-line no-param-reassign
    cfg.token = cfg.token ? cfg.token : tokenData.apiKey;
    wrapped = await wrapper(this, msg, cfg, snapshot, headers, tokenData);
    const sftpClient = new Sftp(wrapped.logger, cfg);
    await sftpClient.connect();
    wrapped.logger.info('Start moving file...');
    await sftpClient.move(msg.data.filename, msg.data.newFilename);
    await sftpClient.end();
    await wrapped.emit('data', { data: msg.data, attachments: {}, metadata: {} });
  } catch (e) {
    const context = wrapped || this;
    context.emit('error', e);
    context.logger.error(`Error in moveFile action: ${e}`);
  }
}

module.exports.process = process;
