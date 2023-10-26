/* eslint-disable no-await-in-loop */
const { wrapper } = require('@blendededge/ferryman-extensions');
const path = require('path');
const { AttachmentProcessor } = require('@blendededge/ferryman-extensions');
const Sftp = require('../Sftp');
const { ELASTICIO_ATTACHMENT_STORAGE_SERVICE_BASE_URL } = require('../constants');
const handleError = require('../utils/handleErrors');
const { getAuthFromSecretConfig } = require('../utils/retrieveSecrets');

/**
 * This method will be called from Open Integration Hub platform providing following data
 *
 * @param msg incoming message object that contains ``data`` with payload
 * @param cfg configuration that is account information and configuration field values
 */
// eslint-disable-next-line no-unused-vars
exports.process = async function processAction(msg, cfg, snapshot, headers, tokenData = {}) {
  let wrapped;
  try {
    // eslint-disable-next-line no-param-reassign
    cfg.token = cfg.token ? cfg.token : tokenData.apiKey;
    wrapped = await wrapper(this, msg, cfg, snapshot, headers, tokenData);
    wrapped.logger.info('Connecting to sftp server...');
    const cfgWithSecret = getAuthFromSecretConfig(cfg, wrapped.logger);
    const sftp = new Sftp(wrapped.logger, cfgWithSecret);
    await sftp.connect();

    const result = {
      results: [],
    };
    const dir = cfg.directory || '/';
    // eslint-disable-next-line no-use-before-define
    const filename = prepareFilename(msg);
    wrapped.logger.debug(`Prepared filename: ${filename}`);

    const isExists = await sftp.exists(dir);
    if (!isExists) {
      await sftp.mkdir(dir, true);
    }

    wrapped.logger.info(`Found ${Object.keys(msg.attachments).length} attachments`);

    // eslint-disable-next-line no-param-reassign
    cfg.attachmentServiceUrl = cfg.attachmentServiceUrl ? cfg.attachmentServiceUrl : ELASTICIO_ATTACHMENT_STORAGE_SERVICE_BASE_URL;

    // eslint-disable-next-line no-restricted-syntax
    for (const key of Object.keys(msg.attachments)) {
      const attachment = msg.attachments[key];
      const cur = await sftp.cwd();
      // eslint-disable-next-line no-use-before-define
      const keyName = prepareKeyname(key, filename, msg);
      const targetPath = (cur.charAt(0) === '/') ? path.posix.resolve(dir, keyName) : path.resolve(dir, keyName);
      wrapped.logger.debug('Writing attachment to targetPath');

      wrapped.logger.debug('Getting attachment...');
      const file = await new AttachmentProcessor(wrapped, cfg.token, cfg.attachmentServiceUrl).getAttachment(attachment.url, 'stream');
      wrapped.logger.debug('Uploading attachment to targetPath');
      await sftp.put(file.data, targetPath, { encoding: null });
      wrapped.logger.info('Attachment uploaded successfully');

      result.results.push({
        attachment: key,
        uploadedOn: new Date().toISOString(),
        path: targetPath,
      });
    }
    await sftp.end();
    wrapped.emit('data', { data: result, attachments: {}, metadata: {} });
    return wrapped.emit('end');
  } catch (e) {
    const context = wrapped || this;
    return handleError(context, e, cfg, 'write');
  }
};

function prepareFilename(msg) {
  if (msg.data.filename) {
    if (Object.keys(msg.attachments).length > 1) {
      return msg.data.filename.split('.')[0];
    }
    return msg.data.filename;
  }
  return null;
}

function prepareKeyname(key, filename, msg) {
  if (filename) {
    if (Object.keys(msg.attachments).length > 1) {
      return `${filename}_${key}`;
    }
    return filename;
  }
  return key;
}
