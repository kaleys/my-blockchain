// Cosmos区块链相关的TypeScript类型定义

// 重新导出钱包管理器的类型
export type { WalletInfo, AccountInfo } from '../services/walletManager';

export interface TransactionFormData {
  fromAddress: string;
  toAddress: string;
  amount: string;
  memo: string;
}

export interface CosmosAccount {
  address: string;
  account_number: string;
  sequence: string;
  pub_key?: {
    '@type': string;
    key: string;
  } | null;
}

export interface Balance {
  denom: string;
  amount: string;
  balances?: Balance[];
}

export interface BlockHeader {
  version: {
    block: string;
  };
  chain_id: string;
  height: string;
  time: string;
  last_block_id?: {
    hash: string;
    part_set_header: {
      total: number;
      hash: string;
    };
  } | null;
  last_commit_hash: string;
  data_hash: string;
  validators_hash: string;
  next_validators_hash: string;
  consensus_hash: string;
  app_hash: string;
  last_results_hash: string;
  evidence_hash: string;
  proposer_address: string;
}

export interface Block {
  header: BlockHeader;
  data: {
    txs: string[];
  };
  evidence: {
    evidence: any[];
  };
  last_commit: any;
}

export interface BlockInfo {
  block_id: {
    hash: string;
    part_set_header: {
      total: number;
      hash: string;
    };
  };
  block: Block;
}

export interface Transaction {
  hash: string;
  height: string;
  index: number;
  tx_result: {
    code: number;
    data: string;
    log: string;
    info: string;
    gas_wanted: string;
    gas_used: string;
    events: any[];
    codespace: string;
  };
  tx: string;
}

export interface TxResponse {
  height: string;
  txhash: string;
  codespace: string;
  code: number;
  data: string;
  raw_log: string;
  logs: any[];
  info: string;
  gas_wanted: string;
  gas_used: string;
  tx: any;
  timestamp: string;
  events: any[];
}

export interface NetworkStatus {
  chainId: string;
  latestBlockHeight: string;
  latestBlockTime: string;
  catchingUp: boolean;
  moniker?: string;
  version?: string;
}

export interface NodeInfo {
  node_info: {
    protocol_version: {
      p2p: string;
      block: string;
      app: string;
    };
    id: string;
    listen_addr: string;
    network: string;
    version: string;
    channels: string;
    moniker: string;
    other: {
      tx_index: string;
      rpc_address: string;
    };
  };
  sync_info: {
    latest_block_hash: string;
    latest_app_hash: string;
    latest_block_height: string;
    latest_block_time: string;
    earliest_block_hash: string;
    earliest_app_hash: string;
    earliest_block_height: string;
    earliest_block_time: string;
    catching_up: boolean;
  };
  validator_info: {
    address: string;
    pub_key: {
      type: string;
      value: string;
    };
    voting_power: string;
  };
}

export interface SendTokensMsg {
  type: '/cosmos.bank.v1beta1.MsgSend';
  value: {
    from_address: string;
    to_address: string;
    amount: Balance[];
  };
}

export interface Fee {
  amount: Balance[];
  gas: string;
}

export interface CosmosMessage {
  type: string;
  value: any;
}

export interface TestAccount {
  name: string;
  address: string;
  mnemonic: string;
}

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// WebSocket消息类型
export interface WebSocketMessage {
  type: 'newBlock' | 'newTransaction' | 'status';
  data: any;
}

// 组件Props类型
export interface BalanceCardProps {
  name: string;
  address: string;
  balance: string;
  isLoading?: boolean;
}

export interface TransactionFormData {
  fromAddress: string;
  toAddress: string;
  amount: string;
  memo?: string;
}

export interface BlockItemProps {
  block: BlockInfo;
  index: number;
}

export interface TransactionItemProps {
  transaction: Transaction;
  index: number;
}