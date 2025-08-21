/** @format */

import CryptoUtils from '../utils/CryptoUtils.js'

/**
 * 区块头类 - 包含区块的元数据
 */
export class BlockHeader {
  constructor() {
    this.previousBlockHash = '' // 前一个区块的哈希值
    this.merkleRoot = '' // Merkle树根哈希
    this.timestamp = Date.now() // 区块创建时间戳
    this.difficulty = 1 // 挖矿难度
    this.nonce = 0 // 挖矿随机数
    this.height = 0 // 区块高度
  }

  /**
   * 计算区块头哈希值
   * @returns {string} 区块头的SHA256哈希值
   */
  calculateHash() {
    const headerData = [
      this.previousBlockHash,
      this.merkleRoot,
      this.timestamp.toString(),
      this.difficulty.toString(),
      this.nonce.toString(),
      this.height.toString()
    ].join('')

    return CryptoUtils.sha256(headerData)
  }

  /**
   * 验证区块头有效性
   * @param {BlockHeader} previousHeader - 前一个区块头
   * @returns {Object} 验证结果 {valid: boolean, reason: string}
   */
  isValid(previousHeader = null) {
    // 基本字段验证
    if (!this.merkleRoot || !this.timestamp || this.height < 0) {
      return { valid: false, reason: '区块头字段不完整' }
    }

    // 时间戳验证
    const now = Date.now()
    const maxFutureTime = now + 2 * 60 * 60 * 1000 // 最多超前2小时
    if (this.timestamp > maxFutureTime) {
      return { valid: false, reason: '区块时间戳过于未来' }
    }

    // 与前一个区块的关系验证
    if (previousHeader) {
      if (this.height !== previousHeader.height + 1) {
        return { valid: false, reason: '区块高度不连续' }
      }

      if (this.previousBlockHash !== previousHeader.calculateHash()) {
        return { valid: false, reason: '前一个区块哈希不匹配' }
      }

      if (this.timestamp <= previousHeader.timestamp) {
        return { valid: false, reason: '区块时间戳必须大于前一个区块' }
      }
    }

    return { valid: true, reason: '区块头有效' }
  }

  /**
   * 序列化区块头
   * @returns {Object} 序列化后的区块头数据
   */
  serialize() {
    return {
      previous_block_hash: this.previousBlockHash,
      merkle_root: this.merkleRoot,
      time: new Date(this.timestamp).toISOString(),
      height: this.height.toString()
    }
  }
}

/**
 * 区块类 - 包含交易数据和区块头
 */
export class Block {
  constructor(transactions = [], previousBlockHash = '', height = 0) {
    this.header = new BlockHeader()
    this.header.previousBlockHash = previousBlockHash
    this.header.height = height

    this.transactions = transactions // 交易列表
    this.hash = '' // 区块哈希
    this.size = 0 // 区块大小(字节)
    this.evidence = { evidence: [] } // 证据数据
    this.last_commit = null // 上一个区块的提交信息

    // 计算Merkle根
    this.updateMerkleRoot()

    // 计算区块哈希和大小
    this.updateHash()
  }

  // 简单的校验
  isValid() {
    // 基本格式
    // merlker root
    return this.header.isValid()
  }

  /**
   * 更新Merkle树根
   */
  updateMerkleRoot() {
    this.header.merkleRoot = this.calculateMerkleRoot()
  }

  /**
   * 计算Merkle树根哈希
   * @returns {string} Merkle树根哈希
   */
  calculateMerkleRoot() {
    if (this.transactions.length === 0) {
      return CryptoUtils.sha256('')
    }

    const txHashes = this.transactions.map(
      (tx) => tx.id || CryptoUtils.sha256(JSON.stringify(tx))
    )
    return CryptoUtils.calculateMerkleRoot(txHashes)
  }

  /**
   * 更新区块哈希
   */
  updateHash() {
    this.hash = this.header.calculateHash()
  }

  /**
   * 工作量证明挖矿
   * @param {number} difficulty - 挖矿难度
   * @param {Function} progressCallback - 进度回调函数(可选)
   */
  mine(difficulty, progressCallback = null) {
    console.log(`⛏️  开始挖矿区块 #${this.header.height}，难度: ${difficulty}`)

    const target = '0'.repeat(difficulty)
    const startTime = Date.now()
    let hashCount = 0

    this.header.difficulty = difficulty
    this.header.nonce = 0

    while (!this.hash.startsWith(target)) {
      this.header.nonce++
      hashCount++
      this.updateHash() //重新计算hash
    }

    const elapsed = (Date.now() - startTime) / 1000
    const hashRate = hashCount / elapsed

    console.log(`✅ 挖矿完成! 区块 #${this.header.height}`)
    console.log(`   耗时: ${elapsed.toFixed(2)}s`)
    console.log(`   总哈希: ${hashCount.toLocaleString()}`)
    console.log(`   平均速率: ${Math.round(hashRate).toLocaleString()} H/s`)
    console.log(`   找到的哈希: ${this.hash}`)
    console.log(`   使用的nonce: ${this.header.nonce.toLocaleString()}`)

    return {
      success: true,
      elapsed,
      hashCount,
      hashRate,
      finalHash: this.hash,
      nonce: this.header.nonce
    }
  }

  /**
   * 获取交易手续费总额
   * @returns {number} 总手续费
   */
  getTotalFees() {
    let totalFees = 0

    // 跳过Coinbase交易
    for (let i = 1; i < this.transactions.length; i++) {
      totalFees += this.transactions[i].fee || 0
    }

    return totalFees
  }

  /**
   * 创建创世区块
   * @param {Array} initialTransactions - 初始交易列表(可选)
   * @returns {Block} 创世区块
   */
  static createGenesisBlock(initialTransactions = []) {
    console.log('🌟 创建创世区块...')

    const genesisBlock = new Block(initialTransactions, '0'.repeat(64), 0)
    genesisBlock.header.timestamp = 1640995200000 // 2022-01-01 00:00:00 UTC
    genesisBlock.header.difficulty = 1
    genesisBlock.header.nonce = 0

    // 创世区块不需要挖矿
    genesisBlock.updateHash()

    console.log(`✅ 创世区块创建完成: ${genesisBlock.hash}`)
    console.log(`📊 包含交易数: ${genesisBlock.transactions.length}`)

    return genesisBlock
  }
}

export default Block
