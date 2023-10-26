const { wrapper } = require('@blendededge/ferryman-extensions');
const { SftpUpsertObject } = require('../utils/upsertUtil');
const Sftp = require('../Sftp');

/**
 * This method will be called from Open Integration Hub platform providing following data
 *
 * @param msg incoming message object that contains ``data`` with payload
 * @param cfg configuration that is account information and configuration field values
 */
exports.process = async function processAction(msg, cfg, snapshot, headers, tokenData = {}) {
  let wrapped;
  let result;
  let sftpClient;
  try {
    wrapped = await wrapper(this, msg, cfg, snapshot, headers, tokenData);
    // eslint-disable-next-line no-param-reassign
    cfg.token = cfg.token ? cfg.token : tokenData.apiKey;
    sftpClient = new Sftp(wrapped.logger, cfg);
    await sftpClient.connect();

    const upsertObjectAction = new SftpUpsertObject(wrapped.logger, sftpClient);
    result = await upsertObjectAction.process(msg, cfg, snapshot);
  } catch (e) {
    const context = wrapped || this;
    if (e.message.includes('No such file')) {
      context.emit('error', new Error(`File ${msg.data.filename} not found`));
    } else {
      context.emit('error', e);
    }
    context.logger.error(`Error in upsertObject action: ${e}`);
  } finally {
    if (sftpClient) {
      await sftpClient.end();
    }
  }
  return result;
};
