// eslint-disable-next-line
async function handleError(emitter, error, cfg, writeAction) {
  if (cfg.enableRebound && writeAction) {
    emitter.logger.info('Component error: %o', error);
    emitter.logger.info('Starting rebound');
    await emitter.emit('rebound', error.message);
  } else if (cfg.dontThrowErrorFlag) {
    const output = {
      errorName: error.name,
      errorStack: error.stack,
      errorMessage: error.message,
    };
    emitter.logger.debug('Component output: %o', output);
    await emitter.emit('data', { data: output });
  } else {
    await emitter.emit('error', error.message);
    throw Error(error.message);
  }
}

module.exports = handleError;
