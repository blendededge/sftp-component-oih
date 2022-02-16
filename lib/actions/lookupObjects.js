/* eslint-disable no-underscore-dangle, camelcase, no-param-reassign */
const mapLimit = require('async/mapLimit');
const componentLogger = require('@elastic.io/component-commons-library/lib/logger/logger').getLogger();
const { LookupObjects } = require('@elastic.io/oih-standard-library/lib/actions/lookupObjects');
const {
  FETCH_ALL,
  FETCH_PAGE,
  EMIT_INDIVIDUALLY,
  BEHAVIOUR,
} = require('../constants');

const { uploadFromSftpToAttachment, fillOutputBody } = require('../attachments');
const Sftp = require('../Sftp');
const { ConditionResolver, CONDITIONS_LIST, isNumberInInterval } = require('../utils');
const { lookupObjectsFetchPage, lookupObjectsEmitIndividually, lookupObjectsFetchAll } = require('../metadata/outputMetadata');

const { DIR, ELASTICIO_ATTACHMENT_STORAGE_SERVICE_BASE_URL } = require('../constants');

const DATE_FIELDS = ['modifyTime', 'accessTime'];

let sftpClient;

class LookupFiles extends LookupObjects {
  constructor(logger, context, client) {
    super(logger, context);
    this.client = client;
  }

  wrapToMessageEmitIndividually(body) {
    const message = {
      attachments: {},
      data: {},
      metadata: {},
    };
    if (body.attachments) {
      message.attachments = body.attachments;
      delete body.attachments;
    }
    message.data = body;
    this.logger.debug('Emitting message');
    return message;
  }

  wrapToMessageFetchAll(body) {
    const message = {
      attachments: {},
      data: {},
      metadata: {},
    };
    body.results.forEach((field) => {
      if (field.attachments) {
        Object.assign(message.attachments, JSON.parse(JSON.stringify(field.attachments)));
        delete field.attachments;
      }
    });
    message.data = body;
    this.logger.debug('Emitting message');
    return message;
  }

  wrapToMessageFetchPage(body) {
    const message = {
      attachments: {},
      data: {},
      metadata: {},
    };
    body.results.forEach((field) => {
      if (field.attachments) {
        Object.assign(message.attachments, body.attachments);
        delete field.attachments;
      }
    });
    message.data = body;
    this.logger.debug('Emitting message');
    return message;
  }

  // eslint-disable-next-line no-unused-vars,max-len
  async getObjectsByCriteria(objectType, criteria, msg, cfg) {
    const listOfFiles = await this.client.list(msg.data[DIR]);
    if (listOfFiles.length === 0) {
      this.logger.info('Have not found files by provided path');
      return listOfFiles;
    }
    const conditionResolver = new ConditionResolver(this.logger);
    const filteredList = listOfFiles
      .filter((item) => conditionResolver.processConditions(msg.data, item, { dateFields: DATE_FIELDS }))
      .filter(((item) => item.type === '-'));
    this.logger.debug('Applied filter conditions');

    if (cfg.uploadFilesToAttachments === 'No') {
      return filteredList.map((item) => fillOutputBody(item, msg.data[DIR]));
    }

    cfg.attachmentServiceUrl = cfg.attachmentServiceUrl ? cfg.attachmentServiceUrl : ELASTICIO_ATTACHMENT_STORAGE_SERVICE_BASE_URL;

    const uploadResult = await mapLimit(filteredList, 20, async (file) => {
      const { data, attachments } = await uploadFromSftpToAttachment(this, cfg, file, msg.data[DIR]);
      data.attachments = attachments;
      return data;
    });
    this.logger.debug('Upload results ready');
    return uploadResult;
  }

  getInMetadata(cfg) {
    const prop = {
      fields: [
        'name',
        'modifyTime',
        'accessTime',
        'size',
      ],
      conditions: CONDITIONS_LIST,
      additionalFields: {
        [DIR]: {
          type: 'string',
          title: 'Directory Path',
          required: true,
        },
      },
    };
    return super.getInMetadata(cfg, prop);
  }

  getObjectType() {
    return 'file';
  }

  getMetaModel(cfg) {
    const metaModel = {};
    metaModel.in = this.getInMetadata(cfg);
    switch (cfg[BEHAVIOUR]) {
      case EMIT_INDIVIDUALLY:
        metaModel.out = lookupObjectsEmitIndividually;
        break;
      case FETCH_PAGE:
        metaModel.out = lookupObjectsFetchPage;
        break;
      case FETCH_ALL:
        metaModel.out = lookupObjectsFetchAll;
        break;
      default:
        metaModel.out = {};
    }
    return metaModel;
  }

  /**
   * Override method to move message data to body variable
   *

   * @param cfg input configuration
   * @param msg input message
   * @returns an array of the search criteria
   */
  getCriteria(msg, cfg) {
    msg.body = msg.data;
    return super.getCriteria(msg, cfg);
  }

  /**
   * Override method to move message data to body variable
   *
   * @param cfg input configuration, not used in default implementation but in some cases you may need it.
   * @param msg input message with pageSize(in default implementation).
   * @returns page size
   */
  // @ts-ignore
  getPageSize(cfg, msg) {
    msg.body = msg.data;
    return super.getPageSize(cfg, msg);
  }

  /**
   * Override method to move message data to body variable
   *
   * @param cfg input configuration, not used in default implementation but in some cases you may need it.
   * @param msg input message with pageNumber(in default implementation).
   * @returns page number
   */
  // @ts-ignore
  getPageNumber(cfg, msg) {
    msg.body = msg.data;
    return super.getPageNumber(cfg, msg);
  }

  /**
   * Override method to move message data to body variable
   *
   * @param cfg input configuration, not used in default implementation but in some cases you may need it.
   * @param msg input message with maxResultSize(in default implementation).
   * @returns max number results
   */
  // @ts-ignore
  getMaxResultSize(cfg, msg) {
    msg.body = msg.data;
    return super.getMaxResultSize(cfg, msg);
  }

  /**
   * Override method to move message data to body variable
   *
   * @param cfg input configuration, not used in default implementation but in some cases you may need it.
   * @param msg input message with termOrder(in default implementation).
   * @returns order of terms as an array
   */
  // @ts-ignore
  getTermOrder(cfg, msg) {
    msg.body = msg.data;
    return super.getTermOrder(cfg, msg);
  }
}

async function init(cfg) {
  sftpClient = new Sftp(componentLogger, cfg);
  await sftpClient.connect();
}

// eslint-disable-next-line no-unused-vars
async function shutdown(cfg, data) {
  await sftpClient.end();
}

async function process(msg, cfg, snapshot = {}) {
  try {
    const numSearchTerms = parseInt(cfg.numSearchTerms || 0, 10);
    if (!isNumberInInterval(numSearchTerms, 0, 99)) {
      throw new Error('Number of search terms must be an integer value from the interval [0-99]');
    }
    if (!await sftpClient.exists(msg.data[DIR])) {
      throw new Error(`Directory ${msg.data[DIR]} is not exist`);
    }
    const lookupFilesAction = new LookupFiles(this.logger, this, sftpClient);
    return lookupFilesAction.process(msg, cfg, snapshot);
  } catch (e) {
    this.logger.error('Error during message processing');
    throw e;
  }
}

async function getMetaModel(cfg) {
  const numSearchTerms = parseInt(cfg.numSearchTerms || 0, 10);
  if (!isNumberInInterval(numSearchTerms, 0, 99)) {
    throw new Error('Number of search terms must be an integer value from the interval [0-99]');
  }
  const lookupFilesAction = new LookupFiles(this.logger, this);
  return lookupFilesAction.getMetaModel(cfg);
}

module.exports.init = init;
module.exports.shutdown = shutdown;
module.exports.process = process;
module.exports.getMetaModel = getMetaModel;
