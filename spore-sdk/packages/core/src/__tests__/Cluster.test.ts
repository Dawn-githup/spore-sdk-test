import { describe, expect, it } from 'vitest';
import { BI } from '@ckb-lumos/lumos';
import { getSporeScript } from '../config';
import { bytifyRawString } from '../helpers';
import { createCluster, createSpore, getClusterByOutPoint, transferCluster } from '../api';
import { expectTypeId, expectCellDep, expectTypeCell, expectLockCell, IdRecord } from './helpers';
import { signAndSendTransaction, popRecord, OutPointRecord } from './helpers';
import { retryQuery, getSporeOutput, getClusterOutput } from './helpers';
import { TEST_ENV, TEST_ACCOUNTS, SPORE_OUTPOINT_RECORDS, CLUSTER_OUTPOINT_RECORDS } from './shared';

describe('Cluster', function () {
  const { rpc, config } = TEST_ENV;
  const { CHARLIE, ALICE } = TEST_ACCOUNTS;

  let existingClusterRecord: OutPointRecord | undefined;

  describe('Cluster basics', () => {
    it('Create a Cluster (latest)', async () => {
      const { txSkeleton, outputIndex } = await createCluster({
        data: {
          name: 'Testnet Spores',
          description: 'Testing only',
        },
        fromInfos: [CHARLIE.address],
        toLock: CHARLIE.lock,
        config,
      });

      const cluster = getClusterOutput(txSkeleton, outputIndex, config);
      expect(cluster.cell.cellOutput.lock).toEqual(CHARLIE.lock);
      expectTypeId(txSkeleton, outputIndex, cluster.id);
      expect(cluster.data.name).toEqual('Testnet Spores');
      expect(cluster.data.description).toEqual('Testing only');

      expectTypeCell(txSkeleton, 'output', cluster.cell.cellOutput.type!);
      expectCellDep(txSkeleton, cluster.script.cellDep);

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
    }, 0);
    it('Transfer a Cluster (latest)', async () => {
      const clusterRecord = existingClusterRecord ?? popRecord(CLUSTER_OUTPOINT_RECORDS, true);
      const clusterCell = await retryQuery(() => getClusterByOutPoint(clusterRecord.outPoint, config));

      const { txSkeleton, outputIndex } = await transferCluster({
        outPoint: clusterCell.outPoint!,
        fromInfos: [CHARLIE.address],
        toLock: ALICE.lock,
        config,
      });

      const cluster = getClusterOutput(txSkeleton, outputIndex, config);
      expect(cluster.cell.cellOutput.lock).toEqual(ALICE.lock);

      expectTypeCell(txSkeleton, 'both', cluster.cell.cellOutput.type!);
      expectCellDep(txSkeleton, cluster.script.cellDep);

      const hash = await signAndSendTransaction({
        account: CHARLIE,
        txSkeleton,
        config,
        rpc,
        send: false,
      });
      if (hash) {
        const newRecord: OutPointRecord = {
          outPoint: {
            txHash: hash,
            index: BI.from(outputIndex).toHexString(),
          },
          account: ALICE,
        };
        if (existingClusterRecord) {
          existingClusterRecord = newRecord;
        } else {
          CLUSTER_OUTPOINT_RECORDS.push(newRecord);
        }
      }
    }, 0);
  });

  describe('Spore with Cluster (latest)', () => {
    it('Create a Spore with Cluster (via lock proxy)', async () => {
      const clusterRecord = existingClusterRecord ?? popRecord(CLUSTER_OUTPOINT_RECORDS, true);
      const clusterCell = await retryQuery(() => getClusterByOutPoint(clusterRecord.outPoint, config));
      const clusterId = clusterCell.cellOutput.type!.args;

      const { txSkeleton, outputIndex, reference } = await createSpore({
        data: {
          clusterId,
          contentType: 'text/plain',
          content: bytifyRawString('content'),
        },
        toLock: CHARLIE.lock,
        fromInfos: [clusterRecord.account.address],
        config,
      });

      const spore = getSporeOutput(txSkeleton, outputIndex, config);
      expect(spore.data.clusterId).toEqual(clusterId);

      expect(reference).toBeDefined();
      expect(reference.referenceTarget).toEqual('cluster');
      expect(reference.referenceType).toEqual('lockProxy');

      expectLockCell(txSkeleton, 'both', clusterCell.cellOutput.lock);

      const clusterScript = getSporeScript(config, 'Cluster', clusterCell.cellOutput.type);
      expectCellDep(txSkeleton, clusterScript.cellDep);
      expectCellDep(txSkeleton, {
        outPoint: clusterRecord.outPoint,
        depType: 'code',
      });

      const hash = await signAndSendTransaction({
        account: CHARLIE,
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
          account: CHARLIE,
        });
      }
    }, 0);
    it('Create a Spore with Cluster (via cell reference)', async () => {
      const clusterRecord = existingClusterRecord ?? popRecord(CLUSTER_OUTPOINT_RECORDS, true);
      const clusterCell = await retryQuery(() => getClusterByOutPoint(clusterRecord.outPoint, config));
      const clusterId = clusterCell.cellOutput.type!.args;

      const oppositeAccount = clusterRecord.account.address === ALICE.address ? CHARLIE : ALICE;

      const { txSkeleton, outputIndex, reference } = await createSpore({
        data: {
          clusterId,
          contentType: 'text/plain',
          content: bytifyRawString('content'),
        },
        toLock: clusterRecord.account.lock,
        fromInfos: [oppositeAccount.address],
        config,
      });

      const spore = getSporeOutput(txSkeleton, outputIndex, config);
      expect(spore.data.clusterId).toEqual(clusterId);

      expect(reference).toBeDefined();
      expect(reference.referenceTarget).toEqual('cluster');
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

      const clusterOutputCell = getClusterOutput(txSkeleton, reference.cluster!.outputIndex, config);
      expect(clusterOutputCell.id).toEqual(clusterId);

      const hash = await signAndSendTransaction({
        account: [oppositeAccount, clusterRecord.account],
        txSkeleton,
        config,
        rpc,
        send: true,
      });
      if (hash) {
        if (existingClusterRecord) {
          existingClusterRecord = {
            outPoint: {
              txHash: hash,
              index: BI.from(reference.cluster!.outputIndex).toHexString(),
            },
            account: clusterRecord.account,
          };
        }
        SPORE_OUTPOINT_RECORDS.push({
          outPoint: {
            txHash: hash,
            index: BI.from(outputIndex).toHexString(),
          },
          account: clusterRecord.account,
        });
      }
    }, 0);
  });

  describe('Spore with Cluster (v1)', () => {
    const clusterV1IdRecord: IdRecord = {
      id: '0x8b9f893397310a3bbd925cd1c9ab606555675bb2d03f3c5cb934f2ba4ef97e93',
      account: CHARLIE,
    };
    it('Reference Cluster via cell reference', async () => {
      const clusterRecord = clusterV1IdRecord;
      const sponsorAccount = clusterRecord.account.address === ALICE.address ? CHARLIE : ALICE;

      const { txSkeleton, outputIndex, reference } = await createSpore({
        data: {
          clusterId: clusterRecord.id,
          contentType: 'text/plain',
          content: bytifyRawString('content'),
        },
        toLock: clusterRecord.account.lock,
        fromInfos: [sponsorAccount.address],
        config,
      });

      const spore = getSporeOutput(txSkeleton, outputIndex, config);
      expect(spore.data.clusterId).toEqual(clusterRecord.id);

      expect(reference).toBeDefined();
      expect(reference.referenceTarget).toEqual('cluster');
      expect(reference.referenceType).toEqual('cell');

      expect(reference.cluster).toBeDefined();
      expect(reference.cluster).toHaveProperty('inputIndex');
      expect(reference.cluster).toHaveProperty('outputIndex');

      const clusterCell = getClusterOutput(txSkeleton, reference.cluster!.outputIndex, config);
      expectTypeCell(txSkeleton, 'both', clusterCell.cell.cellOutput.type!);
      expect(clusterCell.id).toEqual(clusterRecord.id);

      const clusterScript = getSporeScript(config, 'Cluster', clusterCell.cell.cellOutput.type);
      expectCellDep(txSkeleton, clusterScript.cellDep);

      const hash = await signAndSendTransaction({
        account: [sponsorAccount, clusterRecord.account],
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
          account: CHARLIE,
        });
      }
    }, 0);
  });
});
