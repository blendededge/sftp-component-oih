/* eslint-disable no-unused-expressions */
const bunyan = require('bunyan');
const { expect } = require('chai');
const sinon = require('sinon');
const verifyCredentials = require('../verifyCredentials');
require('dotenv').config();

describe('verifyCredentials Test', () => {
  const spy = sinon.spy();
  let credentials;

  before(() => {
    credentials = {
      host: process.env.HOSTNAME,
      port: process.env.PORT,
      username: process.env.USER,
      password: process.env.PASSWORD,
    };
  });

  afterEach(() => {
    spy.resetHistory();
  });

  describe('Verify Credentials Tests', () => {
    it('Correct Password', async () => {
      const cbObj = await verifyCredentials.call(
        {
          emit: spy,
          logger: bunyan.createLogger({ name: 'dummy' }),
        },
        credentials,
        (_, verifiedObj) => verifiedObj,
      );
      expect(cbObj.verified).to.be.true;
    });

    it('Incorrect Password', async () => {
      const incorrectCredentials = JSON.parse(JSON.stringify(credentials));
      incorrectCredentials.password = 'IncorrectPassword';
      const cbObj = await verifyCredentials.call(
        {
          emit: spy,
          logger: bunyan.createLogger({ name: 'dummy' }),
        },
        incorrectCredentials,
        (_, verifiedObj) => verifiedObj,
      );
      expect(cbObj.verified).to.be.false;
    });
  });
});
