const { SftpUpsertObject } = require('../utils/upsertUtil');
const Sftp = require('../Sftp');

/**
 * This method will be called from Open Integration Hub platform providing following data
 *
 * @param msg incoming message object that contains ``data`` with payload
 * @param cfg configuration that is account information and configuration field values
 */
exports.process = async function processAction(msg, cfg, snapshot = {}, headers, tokenData = {}) {
  // eslint-disable-next-line no-param-reassign
  cfg.token = cfg.token ? cfg.token : tokenData.apiKey;
  const sftpClient = new Sftp(this.logger, cfg);
  await sftpClient.connect();

  let result;
  try {
    const upsertObjectAction = new SftpUpsertObject(this.logger, sftpClient);
    result = await upsertObjectAction.process(msg, cfg, snapshot);
  } finally {
    await sftpClient.end();
  }
  return result;
};
