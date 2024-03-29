const sinon = require('sinon');
const chaiAsPromised = require('chai-as-promised');
const chai = require('chai');
const { expect } = require('chai');
const { AttachmentProcessor } = require('@blendededge/ferryman-extensions');

chai.use(chaiAsPromised);
const Sftp = require('../../lib/Sftp');
const trigger = require('../../lib/triggers/read');

describe('SFTP test - read trigger', () => {
  let self;
  const buffer = Buffer.from('Hello');
  const res = { config: { url: 'https://url' } };
  const cfg = {
    directory: 'www/test',
  };

  beforeEach(() => {
    self = {
      emit: sinon.spy(),
      logger: {
        debug: () => {},
        info: () => {},
        trace: () => {},
        error: () => {},
        child: () => self.logger,
      },
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  it('Failed to connect', async () => {
    const sftpClientConnectStub = sinon.stub(Sftp.prototype, 'connect').throws(new Error('Connection failed'));

    await trigger.process.call(self, { metadata: {} }, cfg);
    const result = self.emit.getCalls();
    expect(result[0].args[0]).to.be.equal('error');
    expect(result[0].args[1].message).to.be.equal('Connection failed');
    expect(sftpClientConnectStub.calledOnce).to.be.equal(true);
    sftpClientConnectStub.restore();
  });

  it('No such directory', async () => {
    const sftpClientConnectStub = sinon.stub(Sftp.prototype, 'connect').returns({});
    const sftpClientListStub = sinon.stub(Sftp.prototype, 'list').throws(new Error('No such directory'));

    await trigger.process.call(self, { metadata: {} }, cfg);

    const result = self.emit.getCalls();
    expect(result[0].args[0]).to.be.equal('error');
    expect(result[0].args[1].message).to.be.equal('No such directory');

    expect(sftpClientConnectStub.calledOnce).to.be.equal(true);
    expect(sftpClientListStub.calledOnce).to.be.equal(true);
    sftpClientConnectStub.restore();
    sftpClientListStub.restore();
  });

  it('Invalid file pattern causes exception', async () => {
    const sftpClientConnectStub = sinon.stub(Sftp.prototype, 'connect').returns({});
    await trigger.process.call(self, { metadata: {} }, { ...cfg, pattern: '***' });

    const result = self.emit.getCalls();
    expect(result[0].args[0]).to.be.equal('error');
    expect(result[0].args[1].message).to.be.equal('Invalid regular expression: /***/: Nothing to repeat');

    expect(sftpClientConnectStub.calledOnce).to.be.equal(true);
    sftpClientConnectStub.restore();
  });

  it('No files available', async () => {
    const list = [
      {
        type: 'd',
        name: '.oih_processed',
        size: 4096,
      },
    ];
    const sftpClientConnectStub = sinon.stub(Sftp.prototype, 'connect').returns({});
    const sftpClientListStub = sinon.stub(Sftp.prototype, 'list').returns(list);
    const sftpClientEndStub = sinon.stub(Sftp.prototype, 'end').returns(true);

    await trigger.process.call(self, { metadata: {} }, cfg);

    expect(sftpClientEndStub.calledOnce).to.be.equal(true);
    expect(sftpClientListStub.calledOnce).to.be.equal(true);
    expect(sftpClientConnectStub.calledOnce).to.be.equal(true);
    sftpClientConnectStub.restore();
    sftpClientListStub.restore();
    sftpClientEndStub.restore();
  });

  it('File name does not match given pattern', async () => {
    const list = [
      {
        type: 'd',
        name: '.oih_processed',
        size: 4096,
      },
      {
        type: '-',
        name: '1.txt',
        size: 7,
        accessTime: '1575379317000',
        modifyTime: '1575291942000',
      },
    ];
    const sftpClientConnectStub = sinon.stub(Sftp.prototype, 'connect').returns({});
    const sftpClientListStub = sinon.stub(Sftp.prototype, 'list').returns(list);
    const sftpClientEndStub = sinon.stub(Sftp.prototype, 'end').returns(true);

    await trigger.process.call(self, { metadata: {} }, { ...cfg, pattern: 'aaa' });

    expect(sftpClientConnectStub.calledOnce).to.be.equal(true);
    sftpClientEndStub.restore();
    sftpClientConnectStub.restore();
    sftpClientListStub.restore();
  });

  it('File exceeds maximal file size', async () => {
    const list = [
      {
        type: 'd',
        name: '.oih_processed',
        size: 4096,
      },
      {
        type: '-',
        name: '1.txt',
        size: 204857600,
        accessTime: '1575379317000',
        modifyTime: '1575291942000',
      },
    ];
    const sftpClientConnectStub = sinon.stub(Sftp.prototype, 'connect').returns({});
    const sftpClientEndStub = sinon.stub(Sftp.prototype, 'end').returns(true);
    const sftpClientListStub = sinon.stub(Sftp.prototype, 'list').returns(list);

    await trigger.process.call(self, { metadata: {} }, cfg);

    expect(sftpClientConnectStub.calledOnce).to.be.equal(true);
    expect(sftpClientEndStub.calledOnce).to.be.equal(true);
    expect(sftpClientListStub.calledOnce).to.be.equal(true);
    sftpClientEndStub.restore();
    sftpClientConnectStub.restore();
    sftpClientListStub.restore();
  });

  it('File read successfully', async () => {
    const list = [
      {
        type: 'd',
        name: '.oih_processed',
        size: 4096,
      },
      {
        type: '-',
        name: '1.txt',
        size: 7,
        accessTime: '1575379317000',
        modifyTime: '1575291942000',
      },
    ];
    const sftpClientConnectStub = sinon.stub(Sftp.prototype, 'connect').returns({});
    const sftpClientExistsStub = sinon.stub(Sftp.prototype, 'exists').returns(true);
    const sftpClientMoveStub = sinon.stub(Sftp.prototype, 'move').returns(true);
    const sftpClientEndStub = sinon.stub(Sftp.prototype, 'end').returns(true);
    const sftpClientListStub = sinon.stub(Sftp.prototype, 'list').returns(list);
    const sftpClientGetStub = sinon.stub(Sftp.prototype, 'get').returns(buffer);
    const attachStub = sinon.stub(AttachmentProcessor.prototype, 'uploadAttachment').returns(res);

    await trigger.process.call(self, { metadata: {} }, cfg);

    expect(self.emit.getCall(0).args[1].data).to.be.deep.equal({
      filename: '1.txt',
      size: 7,
    });
    expect(sftpClientConnectStub.calledOnce).to.be.equal(true);
    expect(attachStub.calledOnce).to.be.equal(true);
    sftpClientEndStub.restore();
    sftpClientMoveStub.restore();
    sftpClientExistsStub.restore();
    sftpClientConnectStub.restore();
    sftpClientListStub.restore();
    sftpClientGetStub.restore();
    attachStub.restore();
  });
});
