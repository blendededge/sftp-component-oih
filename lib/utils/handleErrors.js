// eslint-disable-next-line
async function handleError(emitter, error, cfg, writeAction) {
  if (cfg.enableRebound && writeAction) {
    emitter.logger.info('Component error: %o', error);
    emitter.logger.info('Starting rebound');
    await emitter.emit('rebound', error.message);
    emitter.emit('end');
  } else if (cfg.dontThrowErrorFlag) {
    const output = {
      errorName: error.name,
      errorStack: error.stack,
      errorMessage: error.message,
    };
    emitter.logger.debug('Component output: %o', output);
    await emitter.emit('data', { data: output });
    emitter.emit('end');
  } else {
    await emitter.emit('error', error.message);
    emitter.emit('end');
    throw Error(error.message);
  }
}

module.exports = handleError;
