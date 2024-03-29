/* eslint-disable no-param-reassign */

const { Transform, Readable } = require('stream');
const path = require('path');
const { AttachmentProcessor } = require('@blendededge/ferryman-extensions');
const { unixTimeToIsoDate, getContentType } = require('./utils/utils');
const { MAX_FILE_SIZE, ELASTICIO_ATTACHMENT_STORAGE_SERVICE_BASE_URL } = require('./constants');

// eslint-disable-next-line
async function addAttachment(msg, cfg, name, stream, contentLength) {
  try {
    if (contentLength > MAX_FILE_SIZE) {
      throw new Error(`File size is ${contentLength} bytes, it violates the variable MAX_FILE_SIZE, which is currently set to ${MAX_FILE_SIZE} bytes`);
    }
    cfg.attachmentServiceUrl = cfg.attachmentServiceUrl ? cfg.attachmentServiceUrl : ELASTICIO_ATTACHMENT_STORAGE_SERVICE_BASE_URL;
    const mimeType = getContentType(path.extname(name));
    const result = await new AttachmentProcessor(this, cfg.token, cfg.attachmentServiceUrl).uploadAttachment(stream, mimeType);
    msg.attachments[name] = {
      url: result.config.url,
      size: contentLength,
    };
  } catch (e) {
    this.emit('error', e);
  }
}

function fillOutputBody(body, dir) {
  body.directory = dir;
  body.path = path.join(dir, body.name);
  body.modifyTime = unixTimeToIsoDate(body.modifyTime);
  body.accessTime = unixTimeToIsoDate(body.accessTime);
  return body;
}

async function uploadFromSftpToAttachment(context, cfg, body, dir) {
  const { logger, client } = context;
  const filePath = path.join(dir, body.name);
  const fileSize = body.size;
  if (fileSize > MAX_FILE_SIZE) {
    throw new Error(`File size is ${fileSize} bytes, it violates the variable MAX_FILE_SIZE, which is currently set to ${MAX_FILE_SIZE} bytes`);
  }
  const transform = new Transform({
    writableObjectMode: true,
    readableObjectMode: true,
    transform: (chunk, _, cb) => {
      cb(null, chunk);
    },
  });

  logger.info('About to start saving file');
  client.get(filePath, transform);

  const mimeType = getContentType(path.extname(body.name));

  cfg.attachmentServiceUrl = cfg.attachmentServiceUrl ? cfg.attachmentServiceUrl : ELASTICIO_ATTACHMENT_STORAGE_SERVICE_BASE_URL;
  const attachmentProcessor = new AttachmentProcessor(context, cfg.token, cfg.attachmentServiceUrl);
  const uploadResult = await attachmentProcessor.uploadAttachment(transform, mimeType);
  const attachmentUrl = uploadResult.config.url;
  logger.info('File is successfully uploaded to URL');
  const attachments = {
    [body.name]: {
      url: uploadResult.config.url,
      size: body.size,
    },
  };
  body.attachment_url = attachmentUrl;
  fillOutputBody(body, dir);
  return { data: body, attachments, metadata: {} };
}

async function uploadFromSftpToAttachmentBuffer(context, cfg, body, dir) {
  const { logger, client } = context;
  const filePath = path.join(dir, body.name);
  const fileSize = body.size;
  if (fileSize > MAX_FILE_SIZE) {
    throw new Error(`File size is ${fileSize} bytes, it violates the variable MAX_FILE_SIZE, which is currently set to ${MAX_FILE_SIZE} bytes`);
  }

  const buffer = await client.get(filePath);
  const readStream = new Readable();
  readStream.push(buffer);
  readStream.push(null);
  logger.info('About to start saving file');

  cfg.attachmentServiceUrl = cfg.attachmentServiceUrl ? cfg.attachmentServiceUrl : ELASTICIO_ATTACHMENT_STORAGE_SERVICE_BASE_URL;
  const attachmentProcessor = new AttachmentProcessor(context, cfg.token, cfg.attachmentServiceUrl);
  const mimeType = getContentType(path.extname(filePath));
  let uploadResult;
  try {
    uploadResult = await attachmentProcessor.uploadAttachment(readStream, mimeType);
  } catch (e) {
    context.logger.error('Error occurred while uploading an attachment');
    throw e;
  }
  const attachmentUrl = uploadResult.config.url;
  logger.info('File is successfully uploaded to URL');
  const attachments = {
    [body.name]: {
      url: uploadResult.config.url,
      size: body.size,
    },
  };
  body.attachment_url = attachmentUrl;
  body.directory = dir;
  body.path = filePath;
  body.modifyTime = unixTimeToIsoDate(body.modifyTime);
  body.accessTime = unixTimeToIsoDate(body.accessTime);
  return { data: body, attachments, metadata: {} };
}

exports.addAttachment = addAttachment;
exports.uploadFromSftpToAttachment = uploadFromSftpToAttachment;
exports.uploadFromSftpToAttachmentBuffer = uploadFromSftpToAttachmentBuffer;
exports.fillOutputBody = fillOutputBody;
