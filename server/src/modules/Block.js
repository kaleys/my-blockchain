/** @format */

import CryptoUtils from '../utils/CryptoUtils.js';

/**
 * 区块头类 - 包含区块的元数据
 */
export class BlockHeader {
  constructor() {
    this.version = 1;                    // 区块版本
    this.previousBlockHash = '';         // 前一个区块的哈希值
    this.merkleRoot = '';                // Merkle树根哈希
    this.timestamp = Date.now();         // 区块创建时间戳
    this.difficulty = 1;                 // 挖矿难度
    this.nonce = 0;                      // 挖矿随机数
    this.height = 0;                     // 区块高度
    this.app_hash = '';                  // 应用状态哈希
    this.validators_hash = '';           // 验证者集合哈希
    this.consensus_hash = '';            // 共识参数哈希
    this.next_validators_hash = '';      // 下一个验证者集合哈希
    this.proposer_address = '';          // 提议者地址
  }

  /**
   * 计算区块头哈希值
   * @returns {string} 区块头的SHA256哈希值
   */
  calculateHash() {
    const headerData = [
      this.version.toString(),
      this.previousBlockHash,
      this.merkleRoot,
      this.timestamp.toString(),
      this.difficulty.toString(),
      this.nonce.toString(),
      this.height.toString(),
      this.app_hash,
      this.validators_hash,
      this.consensus_hash
    ].join('');

    return CryptoUtils.sha256(headerData);
  }

  /**
   * 验证区块头有效性
   * @param {BlockHeader} previousHeader - 前一个区块头
   * @returns {Object} 验证结果 {valid: boolean, reason: string}
   */
  isValid(previousHeader = null) {
    // 基本字段验证
    if (!this.merkleRoot || !this.timestamp || this.height < 0) {
      return { valid: false, reason: '区块头字段不完整' };
    }

    // 时间戳验证
    const now = Date.now();
    const maxFutureTime = now + 2 * 60 * 60 * 1000; // 最多超前2小时
    if (this.timestamp > maxFutureTime) {
      return { valid: false, reason: '区块时间戳过于未来' };
    }

    // 与前一个区块的关系验证
    if (previousHeader) {
      if (this.height !== previousHeader.height + 1) {
        return { valid: false, reason: '区块高度不连续' };
      }

      if (this.previousBlockHash !== previousHeader.calculateHash()) {
        return { valid: false, reason: '前一个区块哈希不匹配' };
      }

      if (this.timestamp <= previousHeader.timestamp) {
        return { valid: false, reason: '区块时间戳必须大于前一个区块' };
      }
    }

    return { valid: true, reason: '区块头有效' };
  }

  /**
   * 序列化区块头
   * @returns {Object} 序列化后的区块头数据
   */
  serialize() {
    return {
      version: this.version,
      previous_block_hash: this.previousBlockHash,
      merkle_root: this.merkleRoot,
      time: new Date(this.timestamp).toISOString(),
      height: this.height.toString(),
      app_hash: this.app_hash,
      validators_hash: this.validators_hash,
      consensus_hash: this.consensus_hash,
      next_validators_hash: this.next_validators_hash,
      proposer_address: this.proposer_address
    };
  }

  /**
   * 从序列化数据恢复区块头
   * @param {Object} data - 序列化的区块头数据
   * @returns {BlockHeader} 区块头实例
   */
  static deserialize(data) {
    const header = new BlockHeader();
    header.version = data.version || 1;
    header.previousBlockHash = data.previous_block_hash || '';
    header.merkleRoot = data.merkle_root || '';
    header.timestamp = data.time ? new Date(data.time).getTime() : Date.now();
    header.height = parseInt(data.height) || 0;
    header.app_hash = data.app_hash || '';
    header.validators_hash = data.validators_hash || '';
    header.consensus_hash = data.consensus_hash || '';
    header.next_validators_hash = data.next_validators_hash || '';
    header.proposer_address = data.proposer_address || '';
    return header;
  }
}

/**
 * 区块类 - 包含交易数据和区块头
 */
export class Block {
  constructor(transactions = [], previousBlockHash = '', height = 0) {
    this.header = new BlockHeader();
    this.header.previousBlockHash = previousBlockHash;
    this.header.height = height;
    
    this.transactions = transactions;         // 交易列表
    this.hash = '';                          // 区块哈希
    this.size = 0;                           // 区块大小(字节)
    this.evidence = { evidence: [] };         // 证据数据
    this.last_commit = null;                 // 上一个区块的提交信息
    
    // 计算Merkle根
    this.updateMerkleRoot();
    
    // 计算区块哈希和大小
    this.updateHash();
    this.updateSize();
  }

  /**
   * 更新Merkle树根
   */
  updateMerkleRoot() {
    this.header.merkleRoot = this.calculateMerkleRoot();
  }

  /**
   * 计算Merkle树根哈希
   * @returns {string} Merkle树根哈希
   */
  calculateMerkleRoot() {
    if (this.transactions.length === 0) {
      return CryptoUtils.sha256('');
    }

    const txHashes = this.transactions.map(tx => tx.id || CryptoUtils.sha256(JSON.stringify(tx)));
    return CryptoUtils.calculateMerkleRoot(txHashes);
  }

  /**
   * 更新区块哈希
   */
  updateHash() {
    this.hash = this.header.calculateHash();
  }

  /**
   * 更新区块大小
   */
  updateSize() {
    this.size = JSON.stringify(this.serialize()).length;
  }

  /**
   * 添加交易到区块
   * @param {Transaction} transaction - 要添加的交易
   */
  addTransaction(transaction) {
    this.transactions.push(transaction);
    this.updateMerkleRoot();
    this.updateSize();
  }

  /**
   * 工作量证明挖矿
   * @param {number} difficulty - 挖矿难度
   * @param {Function} progressCallback - 进度回调函数(可选)
   */
  mine(difficulty, progressCallback = null) {
    console.log(`⛏️  开始挖矿区块 #${this.header.height}，难度: ${difficulty}`);

    const target = '0'.repeat(difficulty);
    const startTime = Date.now();
    let hashCount = 0;

    this.header.difficulty = difficulty;
    this.header.nonce = 0;

    while (!this.hash.startsWith(target)) {
      this.header.nonce++;
      hashCount++;
      this.updateHash();

      // 进度回调
      if (hashCount % 100000 === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const hashRate = hashCount / elapsed;
        
        console.log(`⛏️  进度: ${hashCount.toLocaleString()} 哈希, 速率: ${Math.round(hashRate).toLocaleString()} H/s`);
        
        if (progressCallback) {
          progressCallback({
            hashCount,
            hashRate,
            elapsed,
            currentHash: this.hash,
            nonce: this.header.nonce
          });
        }
      }
    }

    const elapsed = (Date.now() - startTime) / 1000;
    const hashRate = hashCount / elapsed;

    console.log(`✅ 挖矿完成! 区块 #${this.header.height}`);
    console.log(`   耗时: ${elapsed.toFixed(2)}s`);
    console.log(`   总哈希: ${hashCount.toLocaleString()}`);
    console.log(`   平均速率: ${Math.round(hashRate).toLocaleString()} H/s`);
    console.log(`   找到的哈希: ${this.hash}`);
    console.log(`   使用的nonce: ${this.header.nonce.toLocaleString()}`);

    return {
      success: true,
      elapsed,
      hashCount,
      hashRate,
      finalHash: this.hash,
      nonce: this.header.nonce
    };
  }

  /**
   * 验证区块有效性
   * @param {Block} previousBlock - 前一个区块
   * @param {UTXOSet} utxoSet - UTXO集合(可选)
   * @returns {Object} 验证结果 {valid: boolean, reason: string}
   */
  isValid(previousBlock = null, utxoSet = null) {
    // 1. 验证区块基本结构
    if (!this.header || !Array.isArray(this.transactions)) {
      return { valid: false, reason: '区块结构无效' };
    }

    // 2. 验证区块头
    const headerValidation = this.header.isValid(previousBlock?.header);
    if (!headerValidation.valid) {
      return { valid: false, reason: `区块头无效: ${headerValidation.reason}` };
    }

    // 3. 验证区块哈希
    const calculatedHash = this.header.calculateHash();
    if (this.hash !== calculatedHash) {
      return { valid: false, reason: '区块哈希不匹配' };
    }

    // 4. 验证工作量证明
    if (!CryptoUtils.isValidHash(this.hash, this.header.difficulty)) {
      return { valid: false, reason: '工作量证明无效' };
    }

    // 5. 验证Merkle根
    const calculatedMerkleRoot = this.calculateMerkleRoot();
    if (this.header.merkleRoot !== calculatedMerkleRoot) {
      return { valid: false, reason: 'Merkle根不匹配' };
    }

    // 6. 验证区块大小限制
    const maxBlockSize = 1024 * 1024; // 1MB
    if (this.size > maxBlockSize) {
      return { valid: false, reason: '区块大小超过限制' };
    }

    // 7. 验证交易数量限制
    const maxTransactions = 2000;
    if (this.transactions.length > maxTransactions) {
      return { valid: false, reason: '交易数量超过限制' };
    }

    // 8. 验证交易(如果提供了UTXO集合)
    if (utxoSet && this.transactions.length > 0) {
      // 第一个交易应该是coinbase交易
      const firstTx = this.transactions[0];
      if (!this.isCoinbaseTransaction(firstTx)) {
        return { valid: false, reason: '第一个交易必须是Coinbase交易' };
      }

      // 验证其他交易
      for (let i = 1; i < this.transactions.length; i++) {
        const tx = this.transactions[i];
        
        if (this.isCoinbaseTransaction(tx)) {
          return { valid: false, reason: '区块中只能有一个Coinbase交易' };
        }

        const txValidation = tx.isValid(utxoSet, { skipSignatureVerification: true });
        if (!txValidation.valid) {
          return { valid: false, reason: `交易${i}无效: ${txValidation.reason}` };
        }
      }
    }

    return { valid: true, reason: '区块有效' };
  }

  /**
   * 检查是否为Coinbase交易
   * @param {Transaction} transaction - 交易对象
   * @returns {boolean} 是否为Coinbase交易
   */
  isCoinbaseTransaction(transaction) {
    if (!transaction || !transaction.inputs || transaction.inputs.length !== 1) {
      return false;
    }

    const input = transaction.inputs[0];
    return input.transactionId === '0'.repeat(64) && input.outputIndex === 0xffffffff;
  }

  /**
   * 获取区块奖励
   * @returns {number} 区块奖励金额
   */
  getBlockReward() {
    const baseReward = 50; // 50 tokens
    const halvingInterval = 210000;
    const halvings = Math.floor(this.header.height / halvingInterval);

    if (halvings >= 32) {
      return 0;
    }

    return Math.floor(baseReward / Math.pow(2, halvings));
  }

  /**
   * 获取交易手续费总额
   * @returns {number} 总手续费
   */
  getTotalFees() {
    let totalFees = 0;
    
    // 跳过Coinbase交易
    for (let i = 1; i < this.transactions.length; i++) {
      totalFees += this.transactions[i].fee || 0;
    }

    return totalFees;
  }

  /**
   * 查找交易
   * @param {string} transactionId - 交易ID
   * @returns {Transaction|null} 找到的交易或null
   */
  findTransaction(transactionId) {
    return this.transactions.find(tx => tx.id === transactionId) || null;
  }

  /**
   * 获取区块摘要信息
   * @returns {Object} 区块摘要
   */
  getSummary() {
    return {
      hash: this.hash,
      height: this.header.height,
      timestamp: this.header.timestamp,
      transactionCount: this.transactions.length,
      size: this.size,
      difficulty: this.header.difficulty,
      nonce: this.header.nonce,
      previousBlockHash: this.header.previousBlockHash,
      merkleRoot: this.header.merkleRoot,
      blockReward: this.getBlockReward(),
      totalFees: this.getTotalFees()
    };
  }

  /**
   * 序列化区块
   * @returns {Object} 序列化后的区块数据
   */
  serialize() {
    return {
      header: this.header.serialize(),
      data: {
        txs: this.transactions.map(tx => 
          typeof tx.serialize === 'function' ? tx.serialize() : tx
        )
      },
      evidence: this.evidence,
      last_commit: this.last_commit
    };
  }

  /**
   * 从序列化数据恢复区块
   * @param {Object} data - 序列化的区块数据
   * @param {Class} TransactionClass - 交易类构造函数
   * @returns {Block} 区块实例
   */
  static deserialize(data, TransactionClass = null) {
    const block = new Block();
    
    // 恢复区块头
    block.header = BlockHeader.deserialize(data.header);
    
    // 恢复交易
    if (data.data && data.data.txs) {
      if (TransactionClass && typeof TransactionClass.deserialize === 'function') {
        block.transactions = data.data.txs.map(txData => 
          TransactionClass.deserialize(txData)
        );
      } else {
        block.transactions = data.data.txs;
      }
    }

    // 恢复其他字段
    block.evidence = data.evidence || { evidence: [] };
    block.last_commit = data.last_commit || null;
    
    // 重新计算字段
    block.updateMerkleRoot();
    block.updateHash();
    block.updateSize();

    return block;
  }

  /**
   * 创建创世区块
   * @param {Array} initialTransactions - 初始交易列表(可选)
   * @returns {Block} 创世区块
   */
  static createGenesisBlock(initialTransactions = []) {
    console.log('🌟 创建创世区块...');

    const genesisBlock = new Block(initialTransactions, '0'.repeat(64), 0);
    genesisBlock.header.timestamp = 1640995200000; // 2022-01-01 00:00:00 UTC
    genesisBlock.header.difficulty = 1;
    genesisBlock.header.nonce = 0;
    
    // 创世区块不需要挖矿
    genesisBlock.updateHash();

    console.log(`✅ 创世区块创建完成: ${genesisBlock.hash}`);
    console.log(`📊 包含交易数: ${genesisBlock.transactions.length}`);

    return genesisBlock;
  }
}

export default Block;