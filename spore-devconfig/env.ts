import { RPC, Indexer } from '@ckb-lumos/lumos';
import { predefinedSporeConfigs } from '../../config';
import { createDefaultLockAccount } from '../helpers';
import { predefinedSporedevConfigs } from '../../config/localcfg';
import fs from "fs";

export const LUMOS_CONFIG_PATH = "lumos.json"
const jsonData = JSON.parse(fs.readFileSync(LUMOS_CONFIG_PATH, 'utf8'));

export const env = {
  dev: process.env.NODE_ENV === 'development',
};

const config = env.dev? predefinedSporedevConfigs.Aggron4 : predefinedSporeConfigs.Aggron4;

// const config = predefinedSporeConfigs.Aggron4;
console.log(config.ckbNodeUrl);
console.log(config.ckbIndexerUrl)

export const TEST_ENV = {
  config,
  rpc: new RPC(config.ckbNodeUrl),
  indexer: new Indexer(config.ckbIndexerUrl, config.ckbNodeUrl),
};

const generateTestAccounts = (config: any) => {
  return {
    CHARLIE: createDefaultLockAccount('0xd6013cd867d286ef84cc300ac6546013837df2b06c9f53c83b4c33c2417f6a07', config),
    ALICE: createDefaultLockAccount('0xfd686a48908e8caf97723578bf85f746e1e1d8956cb132f6a2e92e7234a2a245', config),
  };
};

const generatedevAccounts = (config: any) => {
  return {
    CHARLIE: createDefaultLockAccount(jsonData.CHARLIE.privKey, config),
    ALICE: createDefaultLockAccount(jsonData.ALICE.privKey, config),
  };
};

export const TEST_ACCOUNTS = env.dev ? generatedevAccounts(config) : generateTestAccounts(config);
