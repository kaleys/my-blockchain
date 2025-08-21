/** @format */

import { Block } from './Block.js'
import {
  Transaction,
  TransactionInput,
  TransactionOutput
} from './Transaction.js'
import UTXOSet from './UTXOSet.js'
import CryptoUtils from '../utils/CryptoUtils.js'
import { P2PNetwork } from './P2PNetwork.js'

/**
 * 区块链核心类 - 管理完整的区块链状态和操作
 */
export class Blockchain {
  constructor(config = {}) {
    // 区块链基本配置
    this.chainId = config.chainId || 'my-blockchain'
    this.chainName = config.chainName || 'My Blockchain'
    this.initialMinerAddress = config.initialMinerAddress || null
    this.minerPublicKey = config.minerPublicKey || null

    // 初始化P2P网络（区块链管理网络层）
    this.p2pNetwork = new P2PNetwork({
      chainId: this.chainId,
      nodeId: config.nodeId || 'node-' + Date.now(),
      p2pPort: config.p2pPort || 6001,
      initialPeers: config.initialPeers || [],
      blockchain: this // 传递区块链引用给网络层
    })

    // 区块链数据
    this.chain = [] // 区块链数组
    this.utxoSet = new UTXOSet() // UTXO集合
    this.mempool = new Map() // 内存池（待确认交易）

    // 挖矿和共识参数
    this.difficulty = 2 // 当前挖矿难度
    this.targetBlockTime = 10000 // 目标出块时间（毫秒）
    this.difficultyAdjustmentInterval = 10 // 难度调整间隔（区块数）
    this.maxDifficultyChange = 4 // 最大难度变化倍数

    // 奖励机制
    this.baseBlockReward = 20 // 基础区块奖励（20个token）

    // 创建创世区块
    this.createGenesisBlock()

    console.log(`🚀 区块链 "${this.chainName}" 初始化完成`)
    console.log(`📊 链ID: ${this.chainId}`)
    console.log(`⚡ 目标出块时间: ${this.targetBlockTime}ms`)
    console.log(`🎯 初始难度: ${this.difficulty}`)
  }

  /**
   * 创建创世区块
   */
  createGenesisBlock() {
    console.log('🌟 创建创世区块...')

    // 创建创世区块的初始交易
    const genesisTransactions = this.createGenesisTransactions(
      this.minerPublicKey,
      this.initialMinerAddress
    )

    const genesisBlock = Block.createGenesisBlock(genesisTransactions)
    this.chain.push(genesisBlock)

    // 处理创世区块的交易到UTXO集合
    for (const transaction of genesisBlock.transactions) {
      this.utxoSet.processTransaction(transaction, 0)
    }

    console.log(`✅ 创世区块创建完成: ${genesisBlock.hash}`)
    console.log(`💰 初始总供应量: ${this.utxoSet.totalSupply} tokens`)
  }

  /**
   * 创建创世区块的初始交易
   * @param {string} minerAddress - 矿工地址（可选）
   * @returns {Array<Transaction>} 初始交易列表
   */
  createGenesisTransactions(publicKey, minerAddress = null) {
    const transactions = []

    // 如果提供了矿工地址，给其初始化10个token
    if (minerAddress) {
      const minerInitialAmount = 10 // 10个token
      const minerInitialTx = Transaction.createCoinbase(
        minerAddress,
        0, // blockHeight for genesis block
        minerInitialAmount, // reward amount
        '矿工初始化10个token' // extraData
      )

      // 关键：为 Coinbase 交易的输出设置 scriptPubKey = 地址
      // 统一使用地址作为锁定条件
      if (minerInitialTx.outputs.length > 0) {
        minerInitialTx.outputs[0].scriptPubKey = minerAddress
        console.log(`🔐 创世块 UTXO scriptPubKey 已设置为地址: ${minerAddress}`)
      }

      transactions.push(minerInitialTx)
    }

    return transactions
  }

  /**
   * 获取区块链高度
   * @returns {number} 区块链高度
   */
  getHeight() {
    return this.chain.length - 1
  }

  /**
   * 获取最新区块
   * @returns {Block} 最新区块
   */
  getLatestBlock() {
    return this.chain[this.chain.length - 1]
  }

  /**
   * 通过高度获取区块
   * @param {number} height - 区块高度
   * @returns {Block|null} 区块对象或null
   */
  getBlockByHeight(height) {
    if (height < 0 || height >= this.chain.length) {
      return null
    }
    return this.chain[height]
  }

  /**
   * 添加交易到内存池
   * @param {Transaction} transaction - 交易对象
   * @returns {Object} 处理结果
   */
  addTransactionToMempool(transaction) {
    try {
      // 验证交易的格式、input、output
      const validation = transaction.isValid(this.utxoSet)
      if (!validation.valid) {
        throw new Error(`交易验证失败: ${validation.reason}`)
      }

      // 检查是否已存在
      if (this.mempool.has(transaction.id)) {
        throw new Error('交易已存在于内存池中')
      }

      // 检查双重支付
      this.checkDoubleSpending(transaction)

      // 添加到内存池
      this.mempool.set(transaction.id, transaction)

      console.log(`📝 交易已添加到内存池: ${transaction.id}`)

      return {
        success: true,
        transactionId: transaction.id,
        message: '交易已添加到内存池'
      }
    } catch (error) {
      console.error(`❌ 添加交易到内存池失败: ${error.message}`)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 检查input是否重复，是否与内存池中的交易的input重复
   * @param {Transaction} transaction - 交易对象
   * @throws {Error} 如果检测到双重支付
   */
  checkDoubleSpending(transaction) {
    const inputKeys = new Set()

    // 检查交易内部的重复输入
    for (const input of transaction.inputs) {
      if (input.transactionId === '0'.repeat(64)) {
        continue // 跳过Coinbase输入
      }

      const key = `${input.transactionId}:${input.outputIndex}`
      if (inputKeys.has(key)) {
        throw new Error(`交易内部双重支付: ${key}`)
      }
      inputKeys.add(key)
    }

    // 检查与内存池中其他交易的冲突
    for (const [txId, existingTx] of this.mempool) {
      for (const existingInput of existingTx.inputs) {
        if (existingInput.transactionId === '0'.repeat(64)) {
          continue
        }

        const existingKey = `${existingInput.transactionId}:${existingInput.outputIndex}`
        if (inputKeys.has(existingKey)) {
          throw new Error(`与内存池交易 ${txId} 发生双重支付: ${existingKey}`)
        }
      }
    }
  }

  /**
   * 从内存池移除交易
   * @param {string} transactionId - 交易ID
   * @returns {boolean} 是否成功移除
   */
  removeTransactionFromMempool(transactionId) {
    const removed = this.mempool.delete(transactionId)
    if (removed) {
      console.log(`🗑️ 交易已从内存池移除: ${transactionId}`)
    }
    return removed
  }

  /**
   * 获取内存池统计信息
   * @returns {Object} 内存池统计
   */
  getMempoolStats() {
    const transactions = Array.from(this.mempool.values())

    if (transactions.length === 0) {
      return {
        count: 0,
        totalSize: 0,
        totalFees: 0,
        averageFeeRate: 0,
        minFeeRate: 0,
        maxFeeRate: 0
      }
    }

    const totalSize = transactions.reduce((sum, tx) => sum + tx.getSize(), 0)
    const totalFees = transactions.reduce((sum, tx) => sum + tx.fee, 0)
    const feeRates = transactions.map((tx) => tx.getFeeRate())

    return {
      count: transactions.length,
      totalSize,
      totalFees,
      averageFeeRate: totalFees / totalSize,
      minFeeRate: Math.min(...feeRates),
      maxFeeRate: Math.max(...feeRates)
    }
  }

  /**
   * 选择交易用于打包
   * @returns {Array<Transaction>} 选中的交易列表
   */
  selectTransactionsForBlock() {
    const transactions = Array.from(this.mempool.values())

    // 按手续费率降序排序（优先级队列）
    transactions.sort((a, b) => b.fee - a.fee)

    const selectedTransactions = []
    let currentSize = 0
    let invalidTransactions = []

    for (const tx of transactions) {
      // 再次验证交易（防止状态变化）
      const validation = tx.isValid(this.utxoSet, {
        skipSignatureVerification: true
      })
      if (validation.valid) {
        selectedTransactions.push(tx)
        // currentSize += txSize
      } else {
        console.warn(`⚠️ 内存池交易 ${tx.id} 已无效: ${validation.reason}`)
        invalidTransactions.push(tx.id)
      }
    }

    // 移除无效交易
    for (const txId of invalidTransactions) {
      this.removeTransactionFromMempool(txId)
    }

    console.log(
      `📦 选择了 ${selectedTransactions.length} 个交易用于打包 (总大小: ${currentSize} bytes)`
    )

    return selectedTransactions
  }

  /**
   * 计算区块奖励
   * @param {number} height - 区块高度
   * @returns {number} 区块奖励（tokens）
   */
  getBlockReward(height) {
    // 简单定死，别减半了
    return this.baseBlockReward
  }

  /**
   * 创建新区块
   * @param {string} minerAddress - 矿工地址
   * @param {string} minerPublicKey - 矿工公钥
   * @returns {Block} 新区块
   */
  createBlock(minerAddress, minerPublicKey = null) {
    const latestBlock = this.getLatestBlock()
    const height = latestBlock.header.height + 1

    // 选择交易
    const transactions = this.selectTransactionsForBlock()

    // 计算总手续费
    const totalFees = transactions.reduce((sum, tx) => sum + tx.fee, 0)

    // 计算区块奖励
    const blockReward = this.getBlockReward(height)
    const totalReward = blockReward + totalFees

    // 创建Coinbase交易
    const coinbaseTransaction = Transaction.createCoinbase(
      minerAddress,
      height,
      totalReward,
      `Block ${height} mined by ${minerAddress}`
    )

    // 为 Coinbase 交易的输出设置 scriptPubKey = 地址
    if (coinbaseTransaction.outputs.length > 0) {
      coinbaseTransaction.outputs[0].scriptPubKey = minerAddress
      console.log(`🔐 挖矿奖励 UTXO scriptPubKey 已设置为地址: ${minerAddress}`)
    }

    // 创建区块（Coinbase交易放在第一位）
    const allTransactions = [coinbaseTransaction, ...transactions]
    const block = new Block(allTransactions, latestBlock.hash, height)

    console.log(`📦 创建新区块 #${height}:`)
    console.log(`   交易数量: ${allTransactions.length} (包含1个Coinbase)`)
    console.log(`   总手续费: ${totalFees} 个币`)
    console.log(`   区块奖励: ${blockReward} 个币`)
    console.log(`   矿工总收益: ${totalReward} 个币`)

    return block
  }

  /**
   * 挖矿
   * @param {string} minerAddress - 矿工地址
   * @param {Function} progressCallback - 挖矿进度回调
   * @param {string} minerPublicKey - 矿工公钥
   * @returns {Object} 挖矿结果
   */
  async mineBlock(
    minerAddress,
    progressCallback = null,
    minerPublicKey = null
  ) {
    console.log(`⛏️ 开始为矿工 ${minerAddress} 挖矿...`)

    try {
      // 调整难度
      this.adjustDifficulty()

      // 创建区块，选择交易，按手续费倒序
      const block = this.createBlock(minerAddress, minerPublicKey)

      // 挖矿
      const miningResult = block.mine(this.difficulty, progressCallback)

      // 添加到区块链,交易utx哦更新
      const addResult = this.addBlock(block)

      if (addResult.success) {
        console.log(`🎉 挖矿成功! 区块 #${block.header.height} 已添加到区块链`)

        // 从内存池移除已确认的交易
        for (let i = 1; i < block.transactions.length; i++) {
          this.removeTransactionFromMempool(block.transactions[i].id)
        }

        return {
          success: true,
          block,
          miningStats: miningResult
        }
      } else {
        throw new Error(addResult.reason)
      }
    } catch (error) {
      console.error(`❌ 挖矿失败: ${error.message}`)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 难度调整算法
   */
  adjustDifficulty() {
    const currentHeight = this.getHeight()

    // 只在调整间隔时调整
    if (currentHeight < this.difficultyAdjustmentInterval) {
      return
    }

    // 每10个块调整一次难度，每隔targetBlockTime时间就出一个块
    // 实际出块时间 = 最新快的时间 - 往前第10个
    // 预期的出块时间 = targetBlockTime * 10
    const latestBlock = this.getLatestBlock()
    const previousAdjustmentBlock =
      this.chain[currentHeight - this.difficultyAdjustmentInterval]

    const expectedTime =
      this.targetBlockTime * this.difficultyAdjustmentInterval
    const actualTime =
      latestBlock.header.timestamp - previousAdjustmentBlock.header.timestamp

    const oldDifficulty = this.difficulty

    // 计算难度调整比例
    const ratio = actualTime / expectedTime

    if (ratio < 0.25) {
      // 时间太短，增加难度
      this.difficulty = Math.min(oldDifficulty + 2, oldDifficulty * 4)
    } else if (ratio < 0.5) {
      this.difficulty = Math.min(oldDifficulty + 1, oldDifficulty * 2)
    } else if (ratio > 4) {
      // 时间太长，降低难度
      this.difficulty = Math.max(1, Math.floor(oldDifficulty / 4))
    } else if (ratio > 2) {
      this.difficulty = Math.max(1, Math.floor(oldDifficulty / 2))
    }

    // 限制最大难度
    this.difficulty = Math.min(this.difficulty, 20)

    if (oldDifficulty !== this.difficulty) {
      console.log(`🎯 难度调整: ${oldDifficulty} -> ${this.difficulty}`)
      console.log(`   实际用时: ${actualTime}ms, 期望用时: ${expectedTime}ms`)
      console.log(`   调整比例: ${ratio.toFixed(2)}`)
    }
  }

  /**
   * 添加区块到区块链
   * @param {Block} block - 区块对象
   * @returns {Object} 添加结果
   */
  addBlock(block) {
    try {
      const latestBlock = this.getLatestBlock()

      // 验证区块
      const validation = block.isValid(latestBlock, this.utxoSet)
      if (!validation.valid) {
        return {
          success: false,
          reason: `区块验证失败: ${validation.reason}`
        }
      }

      // 更新UTXO集合,移除input，然后处理output
      const utxoBackup = this.utxoSet.serialize() // 备份UTXO状态
      try {
        for (const transaction of block.transactions) {
          this.utxoSet.processTransaction(transaction, block.header.height)
        }
      } catch (error) {
        return {
          success: false,
          reason: `UTXO更新失败: ${error.message}`
        }
      }

      // 添加到区块链
      this.chain.push(block)

      console.log(`✅ 区块 #${block.header.height} 已添加到区块链`)
      console.log(
        `📊 当前链高度: ${this.getHeight()}, UTXO数量: ${
          this.utxoSet.utxos.size
        }`
      )
      console.log(`💰 总供应量: ${this.utxoSet.totalSupply} tokens`)

      return {
        success: true,
        block
      }
    } catch (error) {
      console.error(`❌ 添加区块失败: ${error.message}`)
      return {
        success: false,
        reason: error.message
      }
    }
  }

  /**
   * 获取地址余额
   * @param {string} address - 地址
   * @returns {number} 余额（tokens）
   */
  getBalance(address) {
    return this.utxoSet.getBalance(address)
  }

  /**
   * 获得区块链信息
   * @returns {Object} 区块链状态
   */
  getStatus() {
    const latestBlock = this.getLatestBlock()
    return {
      chain_id: this.chainId,
      latest_block_height: this.getHeight(),
      latest_block_time: latestBlock.header.timestamp,
      catching_up: false // 简化处理，真实情况需要实现同步逻辑
    }
  }

  /**
   * 关闭区块链（清理资源）
   */
  shutdown() {
    console.log('🛑 正在关闭区块链...')

    // p2p也断开
    this.p2pNetwork.stop()

    console.log('✅ 区块链已关闭')
  }
}

export default Blockchain
