import { SporeConfig } from './types';
import * as fs from "fs";
import {readFileSync} from "fs";

export const LUMOS_CONFIG_PATH = "lumos.json"

const jsonData = JSON.parse(fs.readFileSync(LUMOS_CONFIG_PATH, 'utf8'));

function localCfg(): any {
    console.log("AAAAA================================BBBBBB");
    const config = readFileSync(LUMOS_CONFIG_PATH, 'utf-8');
    const configMap = JSON.parse(config);
    return configMap;
}

export type PredefinedSporeConfigScriptName = 'Spore' | 'Cluster' | 'ClusterProxy' | 'ClusterAgent' | 'Mutant' | 'Lua';

const DEVNET_SPORE_CONFIG: SporeConfig<PredefinedSporeConfigScriptName> = {
    lumos: localCfg(),
    ckbNodeUrl: 'http://127.0.0.1:8114',
    ckbIndexerUrl: 'http://127.0.0.1:8114',
    maxTransactionSize: 500 * 1024, // 500 KB
    scripts: {
        Spore: {
            versions: [
                {
                    tags: ['v2', 'preview'],
                    script: {
                        codeHash: jsonData.SCRIPTS.SPORE.CODE_HASH,
                        hashType: jsonData.SCRIPTS.SPORE.HASH_TYPE,
                    },
                    cellDep: {
                        outPoint: {
                            txHash: jsonData.SCRIPTS.SPORE.TX_HASH,
                            index: jsonData.SCRIPTS.SPORE.INDEX,
                        },
                        depType: jsonData.SCRIPTS.SPORE.DEP_TYPE,
                    },
                },
            ],
        },
        Cluster: {
            versions: [
                {
                    tags: ['v2', 'preview'],
                    script: {
                        codeHash: jsonData.SCRIPTS.SPORE_CLUSTER.CODE_HASH,
                        hashType: jsonData.SCRIPTS.SPORE_CLUSTER.HASH_TYPE,
                    },
                    cellDep: {
                        outPoint: {
                            txHash: jsonData.SCRIPTS.SPORE_CLUSTER.TX_HASH,
                            index: jsonData.SCRIPTS.SPORE_CLUSTER.INDEX,
                        },
                        depType: jsonData.SCRIPTS.SPORE_CLUSTER.DEP_TYPE,
                    },
                },
            ],
        },
        ClusterProxy: {
            versions: [
                {
                    tags: ['v2', 'preview'],
                    script: {
                        codeHash: jsonData.SCRIPTS.cluster_proxy.CODE_HASH,
                        hashType: jsonData.SCRIPTS.cluster_proxy.HASH_TYPE,
                    },
                    cellDep: {
                        outPoint: {
                            txHash: jsonData.SCRIPTS.cluster_proxy.TX_HASH,
                            index: jsonData.SCRIPTS.cluster_proxy.INDEX,
                        },
                        depType: jsonData.SCRIPTS.cluster_proxy.DEP_TYPE,
                    },
                },
            ],
        },
        ClusterAgent: {
            versions: [
                {
                    tags: ['v2', 'preview'],
                    script: {
                        codeHash: jsonData.SCRIPTS.cluster_agent.CODE_HASH,
                        hashType: jsonData.SCRIPTS.cluster_agent.HASH_TYPE,
                    },
                    cellDep: {
                        outPoint: {
                            txHash: jsonData.SCRIPTS.cluster_agent.TX_HASH,
                            index: jsonData.SCRIPTS.cluster_agent.INDEX,
                        },
                        depType: jsonData.SCRIPTS.cluster_agent.DEP_TYPE,
                    },
                },
            ],
        },
        Mutant: {
            versions: [
                {
                    tags: ['v2', 'preview'],
                    script: {
                        codeHash: '0x2b4ec50a886bd1e697c5223aca624d4ab3793d74d85723c511461da143406482',
                        hashType: 'data1',
                    },
                    cellDep: {
                        outPoint: {
                            txHash: '0xbb65bb4f6064e85ef8af018b3ab5b283b1feeec39fb6fd1bdc4565411a79c7f9',
                            index: '0x0',
                        },
                        depType: 'code',
                    },
                },
            ],
        },
        Lua: {
            versions: [
                {
                    tags: ['v2', 'preview'],
                    script: {
                        codeHash: jsonData.SCRIPTS.spore_extension_lua.CODE_HASH,
                        hashType: jsonData.SCRIPTS.spore_extension_lua.HASH_TYPE,
                    },
                    cellDep: {
                        outPoint: {
                            txHash: jsonData.SCRIPTS.spore_extension_lua.TX_HASH,
                            index: jsonData.SCRIPTS.spore_extension_lua.INDEX,
                        },
                        depType: jsonData.SCRIPTS.spore_extension_lua.DEP_TYPE,
                    },
                },
            ],
        },
    },
};

export const predefinedSporedevConfigs = {
    Aggron4: DEVNET_SPORE_CONFIG,
};