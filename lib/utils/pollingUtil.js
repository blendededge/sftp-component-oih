/* eslint-disable no-await-in-loop */
const { PollingTrigger } = require('@elastic.io/oih-standard-library/lib/triggers/getNewAndUpdated');

const { getDirectory } = require('./utils');
const { uploadFromSftpToAttachment } = require('../attachments');

class SftpPolling extends PollingTrigger {
  constructor(logger, context, client, cfg) {
    super(logger, context);
    this.client = client;
    this.cfg = cfg;
  }

  async getObjects(objectType, startTime, endTime, cfg) {
    const formattedStartTime = new Date(startTime);
    const formattedEndTime = new Date(endTime);
    const fileList = await this.client.list(cfg.directory);
    return fileList
      .filter((file) => file.type === '-')
      .filter((file) => new Date(file.modifyTime) >= formattedStartTime)
      .filter((file) => new Date(file.modifyTime) < formattedEndTime);
  }

  async emitIndividually(files) {
    this.logger.debug('Start emitting data');

    if (files.length === 0) {
      this.logger.debug('Have not found files in the directory');
      return;
    }
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      try {
        this.logger.debug('Processing file');
        const attachmentResult = await uploadFromSftpToAttachment(this, file, this.cfg.directory);
        const resultMessage = {
          attachments: {},
          data: {},
          metadata: {},
        };
        Object.assign(resultMessage, attachmentResult);
        this.logger.debug('Emitting new message');
        await this.context.emit('data', resultMessage);
      } catch (e) {
        await this.context.emit('error', e);
      }
    }
    this.logger.debug('Finished emitting data');
  }

  async emitAll(results) {
    this.logger.debug('Start emitting data');
    if (results === null || results === undefined || results.length === 0) {
      this.logger.trace('Not emitting result with empty data');
      return;
    }

    const resultMessage = { data: { results: [] }, attachments: {}, metadata: {} };
    for (let i = 0; i < results.length; i += 1) {
      const file = results[i];

      try {
        this.logger.debug('Processing file');
        const attachmentResult = await uploadFromSftpToAttachment(this, file, this.cfg.directory);
        resultMessage.attachments[file.name] = {
          url: attachmentResult.config.url,
          size: file.size,
        };

        resultMessage.data.results.push(this.prepareMessageDescription(file));
      } catch (e) {
        // eslint-disable-next-line no-await-in-loop
        await this.context.emit('error', e);
      }
    }

    this.logger.trace('Emitting new message');
    await this.context.emit('data', resultMessage);
    this.logger.debug('Finished emitting data');
  }

  // eslint-disable-next-line class-methods-use-this
  prepareMessageDescription(file) {
    const dir = getDirectory(this.cfg);
    return {
      type: file.type,
      filename: file.name,
      size: file.size,
      modifyTime: new Date(file.modifyTime).toISOString(),
      accessTime: new Date(file.accessTime).toISOString(),
      directory: dir,
      path: `${dir}/${file.name}`,
    };
  }
}

exports.SftpPolling = SftpPolling;
