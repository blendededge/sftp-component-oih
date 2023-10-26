const { wrapper } = require('@blendededge/ferryman-extensions');
const { SftpDelete } = require('../utils/deleteUtil');
const Sftp = require('../Sftp');

// eslint-disable-next-line consistent-return
async function process(msg, cfg, snapshot, headers, tokenData = {}) {
  let wrapped;
  try {
    wrapped = await wrapper(this, msg, cfg, snapshot, headers, tokenData);
    // eslint-disable-next-line no-param-reassign
    cfg.token = cfg.token ? cfg.token : tokenData.apiKey;
    const sftpClient = new Sftp(wrapped.logger, cfg);
    await sftpClient.connect();
    const deleteAction = new SftpDelete(wrapped.logger, sftpClient);
    return deleteAction.process(msg, cfg, snapshot);
  } catch (e) {
    const context = wrapped || this;
    context.emit('error', e);
    context.logger.error(`Error in delete action: ${e}`);
  }
}

module.exports.process = process;
