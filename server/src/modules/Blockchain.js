/** @format */

import { EventEmitter } from 'events'
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
export class Blockchain extends EventEmitter {
  constructor(config = {}) {
    super()

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

    // 区块限制
    this.maxBlockSize = 1024 * 1024 // 最大区块大小（1MB）
    this.maxTransactionsPerBlock = 2000 // 每个区块最大交易数

    // 奖励机制
    this.baseBlockReward = 50 // 基础区块奖励（50个token）
    this.halvingInterval = 210000 // 奖励减半间隔

    // 创建创世区块
    this.createGenesisBlock()

    // 启动内存池清理定时器
    this.startMempoolCleanup()

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

    this.emit('blockAdded', {
      block: genesisBlock,
      height: 0,
      isGenesis: true
    })

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
        'Miner wallet initial funding - 10 tokens' // extraData
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
   * 通过哈希获取区块
   * @param {string} hash - 区块哈希
   * @returns {Block|null} 区块对象或null
   */
  getBlockByHash(hash) {
    return this.chain.find((block) => block.hash === hash) || null
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
   * 获取区块范围
   * @param {number} startHeight - 起始高度
   * @param {number} endHeight - 结束高度
   * @returns {Array<Block>} 区块列表
   */
  getBlockRange(startHeight, endHeight) {
    const start = Math.max(0, startHeight)
    const end = Math.min(this.chain.length - 1, endHeight)
    return this.chain.slice(start, end + 1)
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

      console.log('transaction===>', transaction)

      // 检查双重支付
      this.checkDoubleSpending(transaction)

      // 添加到内存池
      this.mempool.set(transaction.id, transaction)

      console.log(`📝 交易已添加到内存池: ${transaction.id}`)

      this.emit('transactionAdded', {
        transaction,
        mempoolSize: this.mempool.size
      })

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
   * 检查双重支付
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
      this.emit('transactionRemoved', {
        transactionId,
        mempoolSize: this.mempool.size
      })
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
      // 检查区块大小限制
      // const txSize = tx.getSize()
      // if (currentSize + txSize > this.maxBlockSize) {
      //   continue
      // }

      // 检查交易数量限制
      if (selectedTransactions.length >= this.maxTransactionsPerBlock) {
        break
      }

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
    const halvings = Math.floor(height / this.halvingInterval)

    if (halvings >= 32) {
      return 0 // 防止精度问题
    }

    return Math.floor(this.baseBlockReward / Math.pow(2, halvings))
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

      // 创建区块
      const block = this.createBlock(minerAddress, minerPublicKey)

      // 挖矿
      const miningResult = block.mine(this.difficulty, progressCallback)

      // 添加到区块链
      const addResult = this.addBlock(block)

      if (addResult.success) {
        console.log(`🎉 挖矿成功! 区块 #${block.header.height} 已添加到区块链`)

        // 从内存池移除已确认的交易
        for (let i = 1; i < block.transactions.length; i++) {
          this.removeTransactionFromMempool(block.transactions[i].id)
        }

        // 发射挖矿成功事件
        this.emit('blockMined', {
          block,
          miner: minerAddress,
          reward: block.transactions[0].getOutputAmount(),
          transactionCount: block.transactions.length - 1,
          miningStats: miningResult
        })

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

      // 更新UTXO集合
      const utxoBackup = this.utxoSet.serialize() // 备份UTXO状态
      try {
        for (const transaction of block.transactions) {
          this.utxoSet.processTransaction(transaction, block.header.height)
        }
      } catch (error) {
        // 恢复UTXO状态
        this.utxoSet = UTXOSet.deserialize(utxoBackup)
        return {
          success: false,
          reason: `UTXO更新失败: ${error.message}`
        }
      }

      // 添加到区块链
      this.chain.push(block)

      // 更新确认数
      this.utxoSet.updateConfirmations(block.header.height)

      console.log(`✅ 区块 #${block.header.height} 已添加到区块链`)
      console.log(
        `📊 当前链高度: ${this.getHeight()}, UTXO数量: ${
          this.utxoSet.utxos.size
        }`
      )
      console.log(`💰 总供应量: ${this.utxoSet.totalSupply} tokens`)

      // 发射区块添加事件
      this.emit('blockAdded', {
        block,
        height: block.header.height,
        totalSupply: this.utxoSet.totalSupply
      })

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
   * 难度调整算法
   */
  adjustDifficulty() {
    const currentHeight = this.getHeight()

    // 只在调整间隔时调整
    if (currentHeight % this.difficultyAdjustmentInterval !== 0) {
      return
    }

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

      this.emit('difficultyAdjusted', {
        oldDifficulty,
        newDifficulty: this.difficulty,
        actualTime,
        expectedTime,
        ratio
      })
    }
  }

  /**
   * 验证整个区块链
   * @returns {Object} 验证结果
   */
  validateChain() {
    console.log('🔍 验证区块链完整性...')

    if (this.chain.length === 0) {
      return { valid: false, reason: '区块链为空' }
    }

    // 重建UTXO集合进行验证
    const tempUTXOSet = new UTXOSet()

    for (let i = 0; i < this.chain.length; i++) {
      const currentBlock = this.chain[i]
      const previousBlock = i > 0 ? this.chain[i - 1] : null

      // 验证区块
      const validation = currentBlock.isValid(previousBlock, tempUTXOSet)
      if (!validation.valid) {
        return {
          valid: false,
          reason: `区块 #${i} 验证失败: ${validation.reason}`
        }
      }

      // 更新临时UTXO集合
      try {
        for (const transaction of currentBlock.transactions) {
          tempUTXOSet.processTransaction(
            transaction,
            currentBlock.header.height
          )
        }
      } catch (error) {
        return {
          valid: false,
          reason: `区块 #${i} 的UTXO处理失败: ${error.message}`
        }
      }
    }

    // 验证UTXO集合
    try {
      tempUTXOSet.validate()
    } catch (error) {
      return {
        valid: false,
        reason: `UTXO集合验证失败: ${error.message}`
      }
    }

    // 比较UTXO集合
    if (tempUTXOSet.totalSupply !== this.utxoSet.totalSupply) {
      return {
        valid: false,
        reason: `UTXO总供应量不匹配: 期望 ${tempUTXOSet.totalSupply}, 实际 ${this.utxoSet.totalSupply}`
      }
    }

    console.log('✅ 区块链验证通过')
    return { valid: true, reason: '区块链有效' }
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
   * 获取地址的交易历史
   * @param {string} address - 地址
   * @param {Object} options - 选项 { limit, offset }
   * @returns {Array} 交易历史
   */
  getTransactionHistory(address, options = {}) {
    const { limit = 100, offset = 0 } = options
    const history = []

    // 遍历区块链收集交易历史
    for (const block of this.chain) {
      for (const transaction of block.transactions) {
        let involvement = this.checkTransactionInvolvement(transaction, address)

        if (involvement.involved) {
          history.push({
            transactionId: transaction.id,
            blockHeight: block.header.height,
            blockHash: block.hash,
            timestamp: block.header.timestamp,
            confirmed: true,
            confirmations: this.getHeight() - block.header.height + 1,
            type: involvement.type,
            amount: involvement.amount,
            fee: transaction.fee,
            inputs: transaction.inputs.length,
            outputs: transaction.outputs.length
          })
        }
      }
    }

    // 检查内存池中的未确认交易
    for (const transaction of this.mempool.values()) {
      let involvement = this.checkTransactionInvolvement(transaction, address)

      if (involvement.involved) {
        history.push({
          transactionId: transaction.id,
          blockHeight: null,
          blockHash: null,
          timestamp: transaction.timestamp,
          confirmed: false,
          confirmations: 0,
          type: involvement.type,
          amount: involvement.amount,
          fee: transaction.fee,
          inputs: transaction.inputs.length,
          outputs: transaction.outputs.length
        })
      }
    }

    // 按时间戳降序排序
    history.sort((a, b) => b.timestamp - a.timestamp)

    // 分页
    return history.slice(offset, offset + limit)
  }

  /**
   * 检查交易是否涉及指定地址
   * @param {Transaction} transaction - 交易对象
   * @param {string} address - 地址
   * @returns {Object} 涉及情况
   */
  checkTransactionInvolvement(transaction, address) {
    let involved = false
    let type = 'unknown'
    let amount = 0
    let isInput = false
    let isOutput = false

    // 检查输入
    for (const input of transaction.inputs) {
      if (input.transactionId === '0'.repeat(64)) {
        continue // 跳过Coinbase输入
      }

      const utxo = this.utxoSet.getUTXO(input.transactionId, input.outputIndex)
      if (utxo && utxo.address === address) {
        involved = true
        isInput = true
        amount -= utxo.amount // 支出为负数
      }
    }

    // 检查输出
    for (const output of transaction.outputs) {
      if (output.address === address) {
        involved = true
        isOutput = true
        amount += output.amount // 收入为正数
      }
    }

    // 确定交易类型
    if (isInput && isOutput) {
      type = 'self' // 自转账
    } else if (isInput) {
      type = 'sent' // 支出
    } else if (isOutput) {
      type = 'received' // 收入
    }

    return { involved, type, amount }
  }

  /**
   * 获取P2P网络状态
   * @returns {Object} 网络状态
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
   * 查找交易
   * @param {string} transactionId - 交易ID
   * @returns {Object|null} 交易信息或null
   */
  findTransaction(transactionId) {
    // 在区块链中查找
    for (const block of this.chain) {
      const transaction = block.findTransaction(transactionId)
      if (transaction) {
        return {
          transaction,
          block,
          confirmed: true,
          confirmations: this.getHeight() - block.header.height + 1
        }
      }
    }

    // 在内存池中查找
    const mempoolTx = this.mempool.get(transactionId)
    if (mempoolTx) {
      return {
        transaction: mempoolTx,
        block: null,
        confirmed: false,
        confirmations: 0
      }
    }

    return null
  }

  /**
   * 获取区块链统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    const latestBlock = this.getLatestBlock()
    const utxoStats = this.utxoSet.getStats()
    const mempoolStats = this.getMempoolStats()

    // 计算平均区块时间
    let averageBlockTime = this.targetBlockTime
    if (this.chain.length > 1) {
      const timeDiff =
        latestBlock.header.timestamp - this.chain[0].header.timestamp
      averageBlockTime = timeDiff / (this.chain.length - 1)
    }

    // 计算总交易数
    const totalTransactions = this.chain.reduce(
      (sum, block) => sum + block.transactions.length,
      0
    )

    return {
      chainId: this.chainId,
      chainName: this.chainName,
      height: this.getHeight(),
      totalBlocks: this.chain.length,
      difficulty: this.difficulty,
      targetBlockTime: this.targetBlockTime,
      averageBlockTime: Math.round(averageBlockTime),
      latestBlockHash: latestBlock.hash,
      latestBlockTime: latestBlock.header.timestamp,
      totalSupply: utxoStats.totalSupply,
      utxoCount: utxoStats.totalUTXOs,
      uniqueAddresses: utxoStats.uniqueAddresses,
      totalTransactions,
      mempool: mempoolStats,
      averageBlockSize:
        this.chain.length > 0
          ? this.chain.reduce((sum, block) => sum + block.size, 0) /
            this.chain.length
          : 0
    }
  }

  /**
   * 启动内存池清理定时器
   */
  startMempoolCleanup() {
    // 每分钟清理一次内存池
    setInterval(() => {
      this.cleanupMempool()
    }, 60000)
  }

  /**
   * 清理内存池
   */
  cleanupMempool() {
    const now = Date.now()
    const maxAge = 24 * 60 * 60 * 1000 // 24小时
    let removedCount = 0

    for (const [txId, transaction] of this.mempool) {
      // 移除过期交易
      if (now - transaction.timestamp > maxAge) {
        this.mempool.delete(txId)
        removedCount++
        continue
      }

      // 移除无效交易
      const validation = transaction.isValid(this.utxoSet, {
        skipSignatureVerification: true
      })
      if (!validation.valid) {
        this.mempool.delete(txId)
        removedCount++
      }
    }

    if (removedCount > 0) {
      console.log(`🧹 清理内存池: 移除了 ${removedCount} 个过期/无效交易`)
    }

    // 清理UTXO集合中的旧记录
    this.utxoSet.cleanupSpentUTXOs()
  }

  /**
   * 序列化区块链
   * @returns {Object} 序列化数据
   */
  serialize() {
    return {
      chain_id: this.chainId,
      chain_name: this.chainName,
      blocks: this.chain.map((block) => block.serialize()),
      utxo_set: this.utxoSet.serialize(),
      difficulty: this.difficulty,
      target_block_time: this.targetBlockTime,
      base_block_reward: this.baseBlockReward.toString(),
      halving_interval: this.halvingInterval
    }
  }

  /**
   * 从序列化数据恢复区块链
   * @param {Object} data - 序列化数据
   * @returns {Blockchain} 区块链实例
   */
  static deserialize(data) {
    const config = {
      chainId: data.chain_id,
      chainName: data.chain_name
    }

    const blockchain = new Blockchain(config)

    // 清空默认数据
    blockchain.chain = []
    blockchain.utxoSet.clear()

    // 恢复区块
    for (const blockData of data.blocks || []) {
      const block = Block.deserialize(blockData, Transaction)
      blockchain.chain.push(block)
    }

    // 恢复UTXO集合
    if (data.utxo_set) {
      blockchain.utxoSet = UTXOSet.deserialize(data.utxo_set)
    }

    // 恢复配置
    blockchain.difficulty = data.difficulty || 2
    blockchain.targetBlockTime = data.target_block_time || 10000
    blockchain.baseBlockReward = parseFloat(data.base_block_reward) || 50
    blockchain.halvingInterval = data.halving_interval || 210000

    console.log(
      `📦 区块链已从序列化数据恢复: ${blockchain.chain.length} 个区块`
    )

    return blockchain
  }

  /**
   * 关闭区块链（清理资源）
   */
  shutdown() {
    console.log('🛑 正在关闭区块链...')

    // 清理定时器等资源
    this.removeAllListeners()

    console.log('✅ 区块链已关闭')
  }
}

export default Blockchain
