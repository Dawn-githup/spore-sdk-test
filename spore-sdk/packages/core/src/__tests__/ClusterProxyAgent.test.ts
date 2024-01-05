import { describe, expect, it } from 'vitest';
import { BI } from '@ckb-lumos/lumos';
import { getSporeScript } from '../config';
import { bytifyRawString, minimalCellCapacityByLock } from '../helpers';
import { createCluster, createSpore, getClusterById, getClusterByOutPoint } from '../api';
import { createClusterProxy, transferClusterProxy, meltClusterProxy, getClusterProxyByOutPoint } from '../api';
import { createClusterAgent, transferClusterAgent, meltClusterAgent, getClusterAgentByOutPoint } from '../api';
import { packRawClusterAgentDataToHash, unpackToRawClusterProxyArgs } from '../codec';
import {
  signAndSendTransaction,
  popRecord,
  OutPointRecord,
  retryQuery,
  getClusterAgentOutput,
  getSporeOutput,
  getClusterProxyOutput,
  expectCellDep,
  expectLockCell,
  expectTypeCell,
  expectTypeId,
  expectCell,
  expectCellLock,
} from './helpers';
import {
  TEST_ENV,
  TEST_ACCOUNTS,
  SPORE_OUTPOINT_RECORDS,
  CLUSTER_OUTPOINT_RECORDS,
  CLUSTER_PROXY_OUTPOINT_RECORDS,
  CLUSTER_AGENT_OUTPOINT_RECORDS,
} from './shared';

describe('ClusterProxy and ClusterAgent', function () {
  const { rpc, config } = TEST_ENV;
  const { CHARLIE, ALICE } = TEST_ACCOUNTS;

  let existingClusterRecord: OutPointRecord | undefined;
  let existingClusterProxyRecord: OutPointRecord | undefined;
  let existingClusterAgentRecord: OutPointRecord | undefined;

  existingClusterProxyRecord = {
    outPoint: {
      txHash: '0x33566347c67c076790ebec134928852fa7e4c3d3c42e1cb737c0f52cd6ad9f9e',
      index: '0x0',
    },
    account: CHARLIE,
  };

  it('Fetch Cluster', async () => {
    const clusterCell = await getClusterById(
      '0x8b9f893397310a3bbd925cd1c9ab606555675bb2d03f3c5cb934f2ba4ef97e93',
      config,
    );
    existingClusterRecord = {
      outPoint: clusterCell.outPoint!,
      account: CHARLIE,
    };
  });

  describe('ClusterProxy basics', () => {
    it.skipIf(existingClusterRecord !== void 0)('Create a Cluster', async ({ skip }) => {
      if (existingClusterRecord !== void 0) {
        return skip();
      }

      const { txSkeleton, outputIndex } = await createCluster({
        data: {
          name: 'Testnet Spores',
          description: 'Testing only',
        },
        fromInfos: [CHARLIE.address],
        toLock: CHARLIE.lock,
        config,
      });
      const hash = await signAndSendTransaction({
        account: CHARLIE,
        txSkeleton,
        config,
        rpc,
        send: true,
      });
      if (hash) {
        CLUSTER_OUTPOINT_RECORDS.push({
          outPoint: {
            txHash: hash,
            index: BI.from(outputIndex).toHexString(),
          },
          account: CHARLIE,
        });
      }
    });
    it('Create a ClusterProxy with Cluster (via lock proxy)', async () => {
      const clusterRecord = existingClusterRecord ?? popRecord(CLUSTER_OUTPOINT_RECORDS, true);
      const clusterCell = await retryQuery(() => getClusterByOutPoint(clusterRecord.outPoint, config));
      const clusterId = clusterCell.cellOutput.type!.args;

      const { txSkeleton, outputIndex, reference } = await createClusterProxy({
        clusterOutPoint: clusterCell.outPoint!,
        minPayment: 10,
        toLock: clusterRecord.account.lock,
        fromInfos: [clusterRecord.account.address],
        config,
      });

      const clusterProxy = getClusterProxyOutput(txSkeleton, outputIndex, config);
      expect(clusterProxy.cell.cellOutput.lock).toEqual(clusterRecord.account.lock);
      expectTypeId(txSkeleton, outputIndex, clusterProxy.id);
      expect(clusterProxy.data).toEqual(clusterId);
      expect(clusterProxy.args.minPayment).toBeDefined();
      expect(clusterProxy.args.minPayment!.toNumber()).toEqual(10);

      expectTypeCell(txSkeleton, 'output', clusterProxy.cell.cellOutput.type!);
      expectCellDep(txSkeleton, clusterProxy.script.cellDep);

      expect(reference).toBeDefined();
      expect(reference.referenceType).toEqual('lockProxy');
      expectLockCell(txSkeleton, 'both', clusterRecord.account.lock);
      expectCellDep(txSkeleton, {
        outPoint: clusterRecord.outPoint,
        depType: 'code',
      });

      const hash = await signAndSendTransaction({
        account: clusterRecord.account,
        txSkeleton,
        config,
        rpc,
        send: true,
      });
      if (hash) {
        CLUSTER_PROXY_OUTPOINT_RECORDS.push({
          outPoint: {
            txHash: hash,
            index: BI.from(outputIndex).toHexString(),
          },
          account: clusterRecord.account,
        });
      }
    }, 0);
    it('Create a ClusterProxy with Cluster (via cell reference)', async () => {
      const clusterRecord = existingClusterRecord ?? popRecord(CLUSTER_OUTPOINT_RECORDS, true);
      const clusterCell = await retryQuery(() => getClusterByOutPoint(clusterRecord.outPoint, config));
      const clusterId = clusterCell.cellOutput.type!.args;

      expectCellLock(clusterCell, [CHARLIE.lock, ALICE.lock]);
      const oppositeAccount = clusterRecord.account.address === CHARLIE.address ? ALICE : CHARLIE;

      const { txSkeleton, outputIndex, reference } = await createClusterProxy({
        clusterOutPoint: clusterCell.outPoint!,
        minPayment: 10,
        toLock: clusterRecord.account.lock,
        fromInfos: [oppositeAccount.address],
        config,
      });

      const clusterProxy = getClusterProxyOutput(txSkeleton, outputIndex, config);
      expect(clusterProxy.cell.cellOutput.lock).toEqual(clusterRecord.account.lock);
      expectTypeId(txSkeleton, outputIndex, clusterProxy.id);
      expect(clusterProxy.data).toEqual(clusterId);
      expect(clusterProxy.args.minPayment).toBeDefined();
      expect(clusterProxy.args.minPayment!.toNumber()).toEqual(10);

      expectTypeCell(txSkeleton, 'output', clusterProxy.cell.cellOutput.type!);
      expectCellDep(txSkeleton, clusterProxy.script.cellDep);

      expect(reference).toBeDefined();
      expect(reference.referenceType).toEqual('cell');
      expect(reference.cluster).toBeDefined();
      expect(reference.cluster).toHaveProperty('inputIndex');
      expect(reference.cluster).toHaveProperty('outputIndex');

      expectTypeCell(txSkeleton, 'both', clusterCell.cellOutput.type!);

      const clusterScript = getSporeScript(config, 'Cluster', clusterCell.cellOutput.type);
      expectCellDep(txSkeleton, clusterScript.cellDep);
      expectCellDep(txSkeleton, {
        outPoint: clusterRecord.outPoint,
        depType: 'code',
      });

      const hash = await signAndSendTransaction({
        account: [clusterRecord.account, oppositeAccount],
        txSkeleton,
        config,
        rpc,
        send: true,
      });
      if (hash) {
        CLUSTER_PROXY_OUTPOINT_RECORDS.push({
          outPoint: {
            txHash: hash,
            index: BI.from(outputIndex).toHexString(),
          },
          account: clusterRecord.account,
        });
      }
    }, 0);
    it('Transfer a ClusterProxy', async () => {
      const clusterProxyRecord = existingClusterProxyRecord ?? popRecord(CLUSTER_PROXY_OUTPOINT_RECORDS, true);
      const clusterProxyCell = await retryQuery(() => getClusterProxyByOutPoint(clusterProxyRecord.outPoint, config));

      const { txSkeleton, outputIndex } = await transferClusterProxy({
        outPoint: clusterProxyCell.outPoint!,
        minPayment: 9,
        toLock: ALICE.lock,
        fromInfos: [clusterProxyRecord.account.address],
        config,
      });

      const clusterProxy = getClusterProxyOutput(txSkeleton, outputIndex, config);
      expect(clusterProxy.cell.cellOutput.lock).toEqual(ALICE.lock);
      expect(clusterProxy.args.minPayment).toBeDefined();
      expect(clusterProxy.args.minPayment!.toNumber()).toEqual(9);

      expectCell(txSkeleton, 'both', (cell) => {
        return (
          !!cell.cellOutput.type &&
          !!clusterProxyCell.cellOutput.type &&
          cell.cellOutput.type.codeHash === clusterProxyCell.cellOutput.type.codeHash &&
          cell.cellOutput.type.hashType === clusterProxyCell.cellOutput.type.hashType &&
          cell.cellOutput.type.args.startsWith(clusterProxy.id)
        );
      });
      expectCellDep(txSkeleton, clusterProxy.script.cellDep);

      const hash = await signAndSendTransaction({
        account: clusterProxyRecord.account,
        txSkeleton,
        config,
        rpc,
        send: true,
      });
      if (hash) {
        const newRecord: OutPointRecord = {
          outPoint: {
            txHash: hash,
            index: BI.from(outputIndex).toHexString(),
          },
          account: ALICE,
        };
        if (existingClusterProxyRecord) {
          existingClusterProxyRecord = newRecord;
        } else {
          CLUSTER_PROXY_OUTPOINT_RECORDS.push(newRecord);
        }
      }
    }, 0);
    it('Melt a ClusterProxy', async () => {
      const clusterProxyRecord = existingClusterProxyRecord ?? popRecord(CLUSTER_PROXY_OUTPOINT_RECORDS, true);
      const clusterProxyCell = await retryQuery(() => getClusterProxyByOutPoint(clusterProxyRecord.outPoint, config));
      const clusterProxyType = clusterProxyCell.cellOutput.type;

      const { txSkeleton } = await meltClusterProxy({
        outPoint: clusterProxyCell.outPoint!,
        changeAddress: clusterProxyRecord.account.address,
        config,
      });

      expectTypeCell(txSkeleton, 'input', clusterProxyCell.cellOutput.type!);

      const clusterProxyScript = getSporeScript(config, 'ClusterProxy', clusterProxyType);
      expectCellDep(txSkeleton, clusterProxyScript.cellDep);

      const hash = await signAndSendTransaction({
        account: clusterProxyRecord.account,
        txSkeleton,
        config,
        rpc,
        send: true,
      });
      if (!hash) {
        CLUSTER_PROXY_OUTPOINT_RECORDS.push(clusterProxyRecord);
      }
    }, 0);
  });

  describe('ClusterAgent basics', () => {
    it('Create a ClusterAgent with ClusterProxy (via payment)', async () => {
      const clusterProxyRecord = existingClusterProxyRecord ?? popRecord(CLUSTER_PROXY_OUTPOINT_RECORDS, true);
      const clusterProxyCell = await retryQuery(() => getClusterProxyByOutPoint(clusterProxyRecord.outPoint, config));
      const clusterProxyArgs = unpackToRawClusterProxyArgs(clusterProxyCell.cellOutput.type!.args);
      const minPayment = clusterProxyArgs.minPayment;
      expect(minPayment).toBeDefined();

      expectCellLock(clusterProxyCell, [CHARLIE.lock, ALICE.lock]);
      const oppositeAccount = clusterProxyRecord.account.address === CHARLIE.address ? ALICE : CHARLIE;

      const { txSkeleton, outputIndex, reference } = await createClusterAgent({
        clusterProxyOutPoint: clusterProxyRecord.outPoint!,
        referenceType: 'payment',
        toLock: oppositeAccount.lock,
        fromInfos: [oppositeAccount.address],
        config,
      });

      const clusterAgent = getClusterAgentOutput(txSkeleton, outputIndex, config);
      expect(clusterAgent.cell.cellOutput.type!).toEqual(clusterProxyCell.data);
      expect(clusterAgent.cell.cellOutput.lock).toEqual(clusterProxyRecord.account.lock);
      expect(clusterAgent.data).toEqual(packRawClusterAgentDataToHash(clusterProxyCell.cellOutput.type!));

      expectCellDep(txSkeleton, clusterAgent.script.cellDep);

      expect(reference.referenceType).toEqual('payment');
      expect(reference.payment).toBeDefined();
      expect(reference.payment).toHaveProperty('outputIndex');

      const paymentCell = txSkeleton.get('outputs').get(reference.payment!.outputIndex!);
      expect(paymentCell).toBeDefined();
      expect(paymentCell!.cellOutput.lock).toEqual(clusterProxyCell.cellOutput.lock);

      const minimalPayment = BI.from(10).pow(minPayment!);
      const lockRequiredCapacity = minimalCellCapacityByLock(clusterProxyCell.cellOutput.lock);
      const expectedPayment = lockRequiredCapacity.gt(minimalPayment) ? lockRequiredCapacity : minimalPayment;
      expect(BI.from(paymentCell!.cellOutput.capacity).gte(expectedPayment)).toEqual(true);

      const clusterProxyScript = getSporeScript(config, 'ClusterProxy', clusterProxyCell.cellOutput.type);
      expectCellDep(txSkeleton, clusterProxyScript.cellDep);
      expectCellDep(txSkeleton, {
        outPoint: clusterProxyRecord.outPoint,
        depType: 'code',
      });

      const hash = await signAndSendTransaction({
        account: oppositeAccount,
        txSkeleton,
        config,
        rpc,
        send: true,
      });
      if (hash) {
        CLUSTER_AGENT_OUTPOINT_RECORDS.push({
          outPoint: {
            txHash: hash,
            index: BI.from(outputIndex).toHexString(),
          },
          account: oppositeAccount,
        });
      }
    }, 0);
    it('Create a ClusterAgent with ClusterProxy (via cell reference)', async () => {
      const clusterProxyRecord = existingClusterProxyRecord ?? popRecord(CLUSTER_PROXY_OUTPOINT_RECORDS, true);
      const clusterProxyCell = await retryQuery(() => getClusterProxyByOutPoint(clusterProxyRecord.outPoint, config));

      expectCellLock(clusterProxyCell, [CHARLIE.lock, ALICE.lock]);
      const oppositeAccount = clusterProxyRecord.account.address === CHARLIE.address ? ALICE : CHARLIE;

      const { txSkeleton, outputIndex, reference } = await createClusterAgent({
        clusterProxyOutPoint: clusterProxyRecord.outPoint!,
        referenceType: 'cell',
        toLock: oppositeAccount.lock,
        fromInfos: [oppositeAccount.address],
        config,
      });

      const clusterAgent = getClusterAgentOutput(txSkeleton, outputIndex, config);
      expect(clusterAgent.cell.cellOutput.type!).toEqual(clusterProxyCell.data);
      expect(clusterAgent.cell.cellOutput.lock).toEqual(clusterProxyRecord.account.lock);
      expect(clusterAgent.data).toEqual(packRawClusterAgentDataToHash(clusterProxyCell.cellOutput.type!));

      expectCellDep(txSkeleton, clusterAgent.script.cellDep);

      expect(reference.referenceType).toEqual('cell');
      expect(reference.clusterProxy).toBeDefined();
      expect(reference.clusterProxy).toHaveProperty('inputIndex');
      expect(reference.clusterProxy).toHaveProperty('outputIndex');

      expectTypeCell(txSkeleton, 'both', clusterProxyCell.cellOutput.type!);

      const clusterProxyScript = getSporeScript(config, 'ClusterProxy', clusterProxyCell.cellOutput.type);
      expectCellDep(txSkeleton, clusterProxyScript.cellDep);
      expectCellDep(txSkeleton, {
        outPoint: clusterProxyRecord.outPoint,
        depType: 'code',
      });

      const hash = await signAndSendTransaction({
        account: oppositeAccount,
        txSkeleton,
        config,
        rpc,
        send: true,
      });
      if (hash) {
        CLUSTER_AGENT_OUTPOINT_RECORDS.push({
          outPoint: {
            txHash: hash,
            index: BI.from(outputIndex).toHexString(),
          },
          account: oppositeAccount,
        });
      }
    }, 0);
    it('Transfer a ClusterAgent', async () => {
      const clusterAgentRecord = existingClusterAgentRecord ?? popRecord(CLUSTER_AGENT_OUTPOINT_RECORDS, true);
      const clusterAgentCell = await retryQuery(() => getClusterAgentByOutPoint(clusterAgentRecord.outPoint, config));

      const oppositeAccount = clusterAgentRecord.account.address === CHARLIE.address ? ALICE : CHARLIE;
      const { txSkeleton, outputIndex } = await transferClusterAgent({
        outPoint: clusterAgentCell.outPoint!,
        fromInfos: [clusterAgentRecord.account.address],
        toLock: oppositeAccount.lock,
        config,
      });

      const clusterAgent = getClusterAgentOutput(txSkeleton, outputIndex, config);
      expect(clusterAgent.cell.cellOutput.lock).toEqual(oppositeAccount.lock);

      expectTypeCell(txSkeleton, 'output', clusterAgent.cell.cellOutput.type!);
      expectCellDep(txSkeleton, clusterAgent.script.cellDep);

      const hash = await signAndSendTransaction({
        account: [clusterAgentRecord.account, oppositeAccount],
        txSkeleton,
        config,
        rpc,
        send: true,
      });
      if (hash) {
        const newRecord: OutPointRecord = {
          outPoint: {
            txHash: hash,
            index: BI.from(outputIndex).toHexString(),
          },
          account: oppositeAccount,
        };
        if (existingClusterAgentRecord) {
          existingClusterAgentRecord = newRecord;
        } else {
          CLUSTER_AGENT_OUTPOINT_RECORDS.push(newRecord);
        }
      }
    }, 0);
    it('Melt a ClusterAgent', async () => {
      const clusterAgentRecord = existingClusterAgentRecord ?? popRecord(CLUSTER_AGENT_OUTPOINT_RECORDS, true);
      const clusterAgentCell = await retryQuery(() => getClusterAgentByOutPoint(clusterAgentRecord.outPoint, config));
      const clusterAgentType = clusterAgentCell.cellOutput.type!;

      const { txSkeleton } = await meltClusterAgent({
        outPoint: clusterAgentCell.outPoint!,
        changeAddress: clusterAgentRecord.account.address,
        config,
      });

      expectTypeCell(txSkeleton, 'input', clusterAgentCell.cellOutput.type!);

      const clusterAgentScript = getSporeScript(config, 'ClusterAgent', clusterAgentType);
      expectCellDep(txSkeleton, clusterAgentScript.cellDep);

      const hash = await signAndSendTransaction({
        account: clusterAgentRecord.account,
        txSkeleton,
        config,
        rpc,
        send: true,
      });
      if (!hash) {
        CLUSTER_AGENT_OUTPOINT_RECORDS.push(clusterAgentRecord);
      }
    }, 0);
  });

  describe('Spore with ClusterAgent', () => {
    it('Create a Spore with ClusterAgent (via lock proxy)', async () => {
      const clusterAgentRecord = existingClusterAgentRecord ?? popRecord(CLUSTER_AGENT_OUTPOINT_RECORDS, true);
      const clusterAgentCell = await retryQuery(() => getClusterAgentByOutPoint(clusterAgentRecord.outPoint, config));
      const clusterId = clusterAgentCell.cellOutput.type!.args;

      const { txSkeleton, outputIndex, reference } = await createSpore({
        data: {
          clusterId,
          contentType: 'text/plain',
          content: bytifyRawString('content'),
        },
        clusterAgentOutPoint: clusterAgentCell.outPoint!,
        fromInfos: [clusterAgentRecord.account.address],
        toLock: clusterAgentRecord.account.lock,
        config,
      });

      const spore = getSporeOutput(txSkeleton, outputIndex, config);
      expect(spore.data.clusterId).toEqual(clusterId);

      expect(reference.referenceTarget).toEqual('clusterAgent');
      expect(reference.referenceType).toEqual('lockProxy');
      expectLockCell(txSkeleton, 'both', clusterAgentCell.cellOutput.lock);

      const clusterScript = getSporeScript(config, 'ClusterAgent', clusterAgentCell.cellOutput.type);
      expectCellDep(txSkeleton, clusterScript.cellDep);
      expectCellDep(txSkeleton, {
        outPoint: clusterAgentRecord.outPoint,
        depType: 'code',
      });

      const hash = await signAndSendTransaction({
        account: clusterAgentRecord.account,
        txSkeleton,
        config,
        rpc,
        send: true,
      });
      if (hash) {
        SPORE_OUTPOINT_RECORDS.push({
          outPoint: {
            txHash: hash,
            index: BI.from(outputIndex).toHexString(),
          },
          account: clusterAgentRecord.account,
        });
      }
    }, 0);
    it('Create a Spore with ClusterAgent (via cell reference)', async () => {
      const clusterAgentRecord = existingClusterAgentRecord ?? popRecord(CLUSTER_AGENT_OUTPOINT_RECORDS, true);
      const clusterAgentCell = await retryQuery(() => getClusterAgentByOutPoint(clusterAgentRecord.outPoint, config));
      const clusterId = clusterAgentCell.cellOutput.type!.args;

      expectCellLock(clusterAgentCell, [CHARLIE.lock, ALICE.lock]);
      const oppositeAccount = clusterAgentRecord.account.address === CHARLIE.address ? ALICE : CHARLIE;

      const { txSkeleton, outputIndex, reference } = await createSpore({
        data: {
          clusterId,
          contentType: 'text/plain',
          content: bytifyRawString('content'),
        },
        clusterAgentOutPoint: clusterAgentCell.outPoint!,
        toLock: clusterAgentRecord.account.lock,
        fromInfos: [oppositeAccount.address],
        config,
      });

      const spore = getSporeOutput(txSkeleton, outputIndex, config);
      expect(spore.data.clusterId).toEqual(clusterId);

      expect(reference.referenceTarget).toEqual('clusterAgent');
      expect(reference.referenceType).toEqual('cell');
      expect(reference.clusterAgent).toBeDefined();
      expect(reference.clusterAgent).toHaveProperty('inputIndex');
      expect(reference.clusterAgent).toHaveProperty('outputIndex');

      const clusterAgentType = clusterAgentCell.cellOutput.type!;
      expectTypeCell(txSkeleton, 'both', clusterAgentType);

      const clusterScript = getSporeScript(config, 'ClusterAgent', clusterAgentType);
      expectCellDep(txSkeleton, clusterScript.cellDep);
      expectCellDep(txSkeleton, {
        outPoint: clusterAgentRecord.outPoint,
        depType: 'code',
      });

      const hash = await signAndSendTransaction({
        account: [oppositeAccount, clusterAgentRecord.account],
        txSkeleton,
        config,
        rpc,
        send: true,
      });
      if (hash) {
        SPORE_OUTPOINT_RECORDS.push({
          outPoint: {
            txHash: hash,
            index: BI.from(outputIndex).toHexString(),
          },
          account: clusterAgentRecord.account,
        });
      }
    }, 0);
  });
});
