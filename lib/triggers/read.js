const { wrapper } = require('@blendededge/ferryman-extensions');
const { Readable } = require('stream');
const Sftp = require('../Sftp');
const attachments = require('../attachments');
const { MAX_FILE_SIZE, ELASTICIO_ATTACHMENT_STORAGE_SERVICE_BASE_URL } = require('../constants');
const handleError = require('../utils/handleErrors');
const { getAuthFromSecretConfig } = require('../utils/retrieveSecrets');

const PROCESSED_FOLDER_NAME = '.oih_processed';

function isDirectory(obj) {
  return obj.type === 'd';
}

function filterFilesByPattern(list, pattern) {
  const files = list.filter((item) => !isDirectory(item) && item.size <= MAX_FILE_SIZE);
  const regExp = new RegExp(pattern || '');
  return files.filter((file) => regExp.test(file.name));
}

async function moveFile(sftp, dir, fileName, newFileName) {
  const fromPath = Sftp.createPath(dir, fileName);
  const toPath = Sftp.createPath(dir, `${PROCESSED_FOLDER_NAME}/${newFileName}`);

  const path = Sftp.createPath(dir, PROCESSED_FOLDER_NAME);
  const pathExists = await sftp.exists(path);
  if (!pathExists) {
    await sftp.mkdir(path, true);
  }
  await sftp.move(fromPath, toPath);
}

async function createMessageForFile(cfg, sftp, dir, file) {
  const fileName = file.name;
  const newFileName = `${fileName}_${new Date().getTime()}`;

  const msg = {
    data: {
      filename: fileName,
      size: file.size,
    },
    attachments: {},
    metadata: {},
  };
  this.logger.info('Moving file into staging folder');
  await moveFile.call(this, sftp, dir, fileName, newFileName);
  this.logger.info('Reading file into read stream');
  const buffer = await sftp.get(Sftp.createPath(dir, `${PROCESSED_FOLDER_NAME}/${newFileName}`));
  const readStream = new Readable();
  readStream.push(buffer);
  readStream.push(null);
  await attachments.addAttachment.call(this, msg, cfg, fileName, readStream, file.size);
  return msg;
}

async function readFiles(cfg, sftp, dir, files) {
  // eslint-disable-next-line no-restricted-syntax
  for (const file of files) {
    this.logger.info('Processing file');
    // eslint-disable-next-line no-await-in-loop
    const msg = await createMessageForFile.call(this, cfg, sftp, dir, file);
    // eslint-disable-next-line no-await-in-loop
    await this.emit('data', msg);
  }
}
// eslint-disable-next-line
exports.process = async function process(msg, cfg, snapshot, headers, tokenData = {}) {
  // eslint-disable-next-line no-param-reassign
  cfg.token = cfg.token ? cfg.token : tokenData.apiKey;
  const wrapped = await wrapper(this, msg, cfg, snapshot, headers, tokenData);
  try {
    const cfgWithSecret = getAuthFromSecretConfig(cfg, wrapped.logger);
    const sftp = new Sftp(wrapped.logger, cfgWithSecret);
    await sftp.connect();
    let dir = cfg.directory || '/';
    if (dir.charAt(0) !== '/') {
      dir = `/${dir}`;
    }

    wrapped.logger.info('Finding files in directory');
    const list = await sftp.list(dir, new RegExp(cfg.pattern || ''));
    wrapped.logger.debug('Found files: %s', Object.keys(list.filter((item) => item.type === '-')).length);
    const files = await filterFilesByPattern(list, cfg.pattern);
    wrapped.logger.debug('Files that match filter: %s', Object.keys(files.map((file) => file.name)).length);

    // eslint-disable-next-line no-param-reassign
    cfg.attachmentServiceUrl = cfg.attachmentServiceUrl ? cfg.attachmentServiceUrl : ELASTICIO_ATTACHMENT_STORAGE_SERVICE_BASE_URL;
    await readFiles.call(wrapped, cfg, sftp, dir, files);
    await sftp.end();
    await wrapped.emit('end');
  } catch (e) {
    return handleError(wrapped, e, cfg);
  }
};
