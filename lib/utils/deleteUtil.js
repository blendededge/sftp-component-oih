const { DeleteById } = require('@elastic.io/oih-standard-library/lib/actions/delete');

class SftpDelete extends DeleteById {
  constructor(logger, client) {
    super(logger);
    this.client = client;
  }

  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  getId(msg, cfg) {
    return msg.data.path;
  }

  async deleteObject(path) {
    this.logger.debug('Checking for existence of path ...');
    const fileExists = await this.client.exists(path);
    if (!fileExists) {
      this.logger.debug('Specified path does not exist.');
      await this.client.end();
      return null;
    }
    this.logger.debug('Specified path exists. Will delete ...');
    await this.client.delete(path);
    await this.client.end();
    return path;
  }
}

exports.SftpDelete = SftpDelete;
