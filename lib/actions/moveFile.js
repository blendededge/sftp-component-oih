const Sftp = require('../Sftp');

async function process(msg, cfg) {
  const sftpClient = new Sftp(this.logger, cfg);
  await sftpClient.connect();
  this.logger.info('Start moving file...');
  await sftpClient.move(msg.data.filename, msg.data.newFilename);
  await sftpClient.end();
  await this.emit('data', { data: msg.data, attachments: {}, metadata: {} });
}

module.exports.process = process;
