/* eslint-disable no-await-in-loop */
const path = require('path');
const { AttachmentProcessor } = require('../attachmentProcessor');
const Sftp = require('../Sftp');

/**
 * This method will be called from Open Integration Hub platform providing following data
 *
 * @param msg incoming message object that contains ``data`` with payload
 * @param cfg configuration that is account information and configuration field values
 */
exports.process = async function processAction(msg, cfg) {
  this.logger.info('Connecting to sftp server...');
  const sftp = new Sftp(this.logger, cfg);
  await sftp.connect();

  const result = {
    results: [],
  };
  const dir = cfg.directory || '/';
  // eslint-disable-next-line no-use-before-define
  const filename = prepareFilename(msg);
  this.logger.debug(`Prepared filename: ${filename}`);

  const isExists = await sftp.exists(dir);
  if (!isExists) {
    await sftp.mkdir(dir, true);
  }

  this.logger.info(`Found ${Object.keys(msg.attachments).length} attachments`);
  // eslint-disable-next-line no-restricted-syntax
  for (const key of Object.keys(msg.attachments)) {
    const attachment = msg.attachments[key];
    const cur = await sftp.cwd();
    // eslint-disable-next-line no-use-before-define
    const keyName = prepareKeyname(key, filename, msg);
    const targetPath = (cur.charAt(0) === '/') ? path.posix.resolve(dir, keyName) : path.resolve(dir, keyName);
    this.logger.debug('Writing attachment to targetPath');

    this.logger.debug('Getting attachment...');
    const file = await new AttachmentProcessor(this, cfg.token, cfg.attachmentServiceUrl).getAttachment(attachment.url, 'stream');
    this.logger.debug('Uploading attachment to targetPath');
    await sftp.put(file.data, targetPath, { encoding: null });
    this.logger.info('Attachment uploaded successfully');

    result.results.push({
      attachment: key,
      uploadedOn: new Date().toISOString(),
      path: targetPath,
    });
  }
  await sftp.end();
  return { data: result, attachments: {}, metadata: {} };
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
