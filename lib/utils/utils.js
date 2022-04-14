const moment = require('moment');

const extensionTypes = {
  conf: 'text/plain',
  csv: 'text/csv',
  json: 'application/json',
  log: 'text/plain',
  text: 'text/plain',
  txt: 'text/plain',
  tsv: 'text/tsv',
  xml: 'application/xml',
  xsl: 'application/xml',
};

function getDirectory(cfg) {
  const { directory } = cfg;
  return directory.substring(directory.length - 1) === '/'
    ? directory.substring(0, directory.length - 1)
    : directory;
}

function unixTimeToIsoDate(unixTime) {
  return moment.utc(unixTime, 'x', true).toISOString();
}

function isNumberInInterval(num, min, max) {
  if (Number.isNaN(num) || num < min || num > max) {
    return false;
  }

  return true;
}

function getContentType(ext) {
  return extensionTypes[ext.toLowerCase()] || 'application/octet-stream';
}

exports.getDirectory = getDirectory;
exports.unixTimeToIsoDate = unixTimeToIsoDate;
exports.isNumberInInterval = isNumberInInterval;
exports.getContentType = getContentType;
