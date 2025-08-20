/** @format */

import CryptoUtils from '../utils/CryptoUtils.js'
import { Transaction, TransactionOutput } from './Transaction.js'

/**
 * UTXO (Unspent Transaction Output) 类
 */
export class UTXO {
  constructor(
    transactionId,
    outputIndex,
    address,
    amount,
    blockHeight,
    scriptPubKey = ''
  ) {
    this.transactionId = transactionId // 交易ID
    this.outputIndex = outputIndex // 输出索引
    this.address = address // 地址
    this.amount = amount // 金额
    this.blockHeight = blockHeight // 确认区块高度
    this.scriptPubKey = scriptPubKey // 锁定脚本
    this.spent = false // 是否已花费
    this.spentTxId = null // 花费该UTXO的交易ID
    this.spentHeight = null // 花费时的区块高度
    this.confirmations = 0 // 确认数
  }

  /**
   * 生成UTXO的唯一键
   * @returns {string} UTXO键
   */
  getKey() {
    return `${this.transactionId}:${this.outputIndex}`
  }

  /**
   * 标记为已花费
   * @param {string} spendingTxId - 花费该UTXO的交易ID
   * @param {number} spendingHeight - 花费时的区块高度
   */
  markAsSpent(spendingTxId, spendingHeight) {
    this.spent = true
    this.spentTxId = spendingTxId
    this.spentHeight = spendingHeight
  }

  /**
   * 更新确认数
   * @param {number} currentHeight - 当前区块高度
   */
  updateConfirmations(currentHeight) {
    if (this.blockHeight !== null) {
      this.confirmations = Math.max(0, currentHeight - this.blockHeight + 1)
    }
  }

  /**
   * 序列化UTXO
   * @returns {Object} 序列化数据
   */
  serialize() {
    return {
      transaction_id: this.transactionId,
      output_index: this.outputIndex,
      address: this.address,
      amount: this.amount.toString(),
      block_height: this.blockHeight,
      script_pub_key: this.scriptPubKey,
      spent: this.spent,
      spent_tx_id: this.spentTxId,
      spent_height: this.spentHeight,
      confirmations: this.confirmations
    }
  }

  /**
   * 从序列化数据恢复UTXO
   * @param {Object} data - 序列化数据
   * @returns {UTXO} UTXO实例
   */
  static deserialize(data) {
    const utxo = new UTXO(
      data.transaction_id,
      data.output_index,
      data.address,
      parseFloat(data.amount),
      data.block_height,
      data.script_pub_key
    )
    utxo.spent = data.spent || false
    utxo.spentTxId = data.spent_tx_id || null
    utxo.spentHeight = data.spent_height || null
    utxo.confirmations = data.confirmations || 0
    return utxo
  }
}

/**
 * UTXO集合管理类
 */
export class UTXOSet {
  constructor() {
    this.utxos = new Map() // UTXO映射表 key: "txId:outputIndex"
    this.addressIndex = new Map() // 地址索引 key: address, value: Set of UTXO keys
    this.spentUTXOs = new Map() // 已花费的UTXO记录
    this.totalSupply = 0 // 总供应量
    this.lastProcessedHeight = 0 // 最后处理的区块高度
  }

  /**
   * 添加UTXO
   * @param {UTXO} utxo - UTXO对象
   */
  addUTXO(utxo) {
    const key = utxo.getKey()

    // 检查是否已存在
    if (this.utxos.has(key)) {
      console.warn(`⚠️  UTXO ${key} 已存在，将被覆盖`)
    }

    // 添加到主映射表
    this.utxos.set(key, utxo)

    // 更新地址索引
    if (!this.addressIndex.has(utxo.address)) {
      this.addressIndex.set(utxo.address, new Set())
    }
    this.addressIndex.get(utxo.address).add(key)

    // 更新总供应量
    this.totalSupply += utxo.amount

    console.log(
      `➕ 添加UTXO: ${key} (${utxo.amount} tokens 到 ${utxo.address})`
    )
  }

  /**
   * 移除UTXO（标记为已花费）
   * @param {string} transactionId - 交易ID
   * @param {number} outputIndex - 输出索引
   * @param {string} spendingTxId - 花费该UTXO的交易ID
   * @param {number} spendingHeight - 花费时的区块高度
   * @returns {boolean} 是否成功移除
   */
  removeUTXO(transactionId, outputIndex, spendingTxId, spendingHeight) {
    const key = `${transactionId}:${outputIndex}`
    const utxo = this.utxos.get(key)

    if (!utxo) {
      console.warn(`⚠️  尝试移除不存在的UTXO: ${key}`)
      return false
    }

    if (utxo.spent) {
      console.warn(`⚠️  UTXO ${key} 已被花费`)
      return false
    }

    // 标记为已花费
    utxo.markAsSpent(spendingTxId, spendingHeight)

    // 从主映射表移除
    this.utxos.delete(key)

    // 从地址索引移除
    const addressSet = this.addressIndex.get(utxo.address)
    if (addressSet) {
      addressSet.delete(key)
      if (addressSet.size === 0) {
        this.addressIndex.delete(utxo.address)
      }
    }

    // 记录已花费的UTXO
    this.spentUTXOs.set(key, utxo)

    // 更新总供应量
    this.totalSupply -= utxo.amount

    console.log(`➖ 移除UTXO: ${key} (${utxo.amount} tokens)`)
    return true
  }

  /**
   * 获取UTXO
   * @param {string} transactionId - 交易ID
   * @param {number} outputIndex - 输出索引
   * @returns {UTXO|null} UTXO对象或null
   */
  getUTXO(transactionId, outputIndex) {
    const key = `${transactionId}:${outputIndex}`
    return this.utxos.get(key) || null
  }

  /**
   * 检查UTXO是否存在且未花费
   * @param {string} transactionId - 交易ID
   * @param {number} outputIndex - 输出索引
   * @returns {boolean} 是否存在且未花费
   */
  isUTXOAvailable(transactionId, outputIndex) {
    const utxo = this.getUTXO(transactionId, outputIndex)
    return utxo && !utxo.spent
  }

  /**
   * 获取地址的所有UTXO
   * @param {string} address - 地址
   * @returns {Array<UTXO>} UTXO列表
   */
  getUTXOsByAddress(address) {
    const utxoKeys = this.addressIndex.get(address) || new Set()
    const utxos = []

    for (const key of utxoKeys) {
      const utxo = this.utxos.get(key)
      if (utxo && !utxo.spent) {
        utxos.push(utxo)
      }
    }

    return utxos.sort((a, b) => a.amount - b.amount) // 按金额排序
  }

  /**
   * 获取地址余额
   * @param {string} address - 地址
   * @returns {number} 余额（tokens）
   */
  getBalance(address) {
    const utxos = this.getUTXOsByAddress(address)
    return utxos.reduce((sum, utxo) => sum + utxo.amount, 0)
  }

  /**
   * 选择UTXO用于支付
   * @param {string} address - 支付地址
   * @param {number} targetAmount - 目标金额
   * @param {number} feePercentage - 每字节手续费
   * @returns {Object} 选择结果 { utxos, totalAmount, fee, change }
   */
  selectUTXOsForPayment(address, targetAmount, feePercentage = 10) {
    const availableUTXOs = this.getUTXOsByAddress(address)

    console.log('availableUTXOs===>', availableUTXOs)

    if (availableUTXOs.length === 0) {
      throw new Error('没有可用的UTXO')
    }

    // 按金额从小到大排序（优先使用小额UTXO）
    availableUTXOs.sort((a, b) => a.amount - b.amount)

    const selectedUTXOs = []
    let totalAmount = 0

    // 交易费,交易金额的10%（简化版本）
    const estimatedFee = (targetAmount * feePercentage) / 100
    // 贪心算法选择UTXO
    for (const utxo of availableUTXOs) {
      selectedUTXOs.push(utxo)
      totalAmount += utxo.amount
      // 检查是否足够支付目标金额和手续费
      if (totalAmount >= targetAmount + estimatedFee) {
        break
      }
    }

    // 检查余额是否足够
    if (totalAmount < targetAmount + estimatedFee) {
      throw new Error(
        `余额不足: 需要 ${
          targetAmount + estimatedFee
        } 个代币，但只有 ${totalAmount} 代币`
      )
    }

    const change = totalAmount - targetAmount - estimatedFee

    return {
      utxos: selectedUTXOs,
      totalAmount,
      fee: estimatedFee,
      change
    }
  }

  /**
   * 处理交易更新UTXO集合
   * @param {Transaction} transaction - 交易对象
   * @param {number} blockHeight - 区块高度
   */
  processTransaction(transaction, blockHeight) {
    console.log(`🔄 处理交易 ${transaction.id} (区块高度: ${blockHeight})`)

    // 1. 处理输入（移除被花费的UTXO）
    for (const input of transaction.inputs) {
      // 跳过Coinbase交易的输入
      if (input.transactionId === '0'.repeat(64)) {
        continue
      }

      const success = this.removeUTXO(
        input.transactionId,
        input.outputIndex,
        transaction.id,
        blockHeight
      )

      if (!success) {
        throw new Error(
          `无法移除UTXO: ${input.transactionId}:${input.outputIndex}`
        )
      }
    }

    // 2. 处理输出（添加新的UTXO）
    for (let i = 0; i < transaction.outputs.length; i++) {
      const output = transaction.outputs[i]
      const utxo = new UTXO(
        transaction.id,
        i,
        output.address,
        output.amount,
        blockHeight,
        output.scriptPubKey
      )

      this.addUTXO(utxo)
    }

    // 更新最后处理的区块高度
    this.lastProcessedHeight = Math.max(this.lastProcessedHeight, blockHeight)
  }

  /**
   * 回滚交易（撤销UTXO变更）
   * @param {Transaction} transaction - 交易对象
   * @param {number} blockHeight - 区块高度
   */
  rollbackTransaction(transaction, blockHeight) {
    console.log(`↩️  回滚交易 ${transaction.id} (区块高度: ${blockHeight})`)

    // 1. 移除交易创建的UTXO
    for (let i = 0; i < transaction.outputs.length; i++) {
      const key = `${transaction.id}:${i}`
      const utxo = this.utxos.get(key)

      if (utxo) {
        this.utxos.delete(key)

        // 从地址索引移除
        const addressSet = this.addressIndex.get(utxo.address)
        if (addressSet) {
          addressSet.delete(key)
          if (addressSet.size === 0) {
            this.addressIndex.delete(utxo.address)
          }
        }

        this.totalSupply -= utxo.amount
      }
    }

    // 2. 恢复被花费的UTXO
    for (const input of transaction.inputs) {
      // 跳过Coinbase交易的输入
      if (input.transactionId === '0'.repeat(64)) {
        continue
      }

      const key = `${input.transactionId}:${input.outputIndex}`
      const spentUTXO = this.spentUTXOs.get(key)

      if (spentUTXO && spentUTXO.spentTxId === transaction.id) {
        // 恢复UTXO
        spentUTXO.spent = false
        spentUTXO.spentTxId = null
        spentUTXO.spentHeight = null

        this.utxos.set(key, spentUTXO)
        this.spentUTXOs.delete(key)

        // 恢复地址索引
        if (!this.addressIndex.has(spentUTXO.address)) {
          this.addressIndex.set(spentUTXO.address, new Set())
        }
        this.addressIndex.get(spentUTXO.address).add(key)

        this.totalSupply += spentUTXO.amount
      }
    }
  }

  /**
   * 更新所有UTXO的确认数
   * @param {number} currentHeight - 当前区块高度
   */
  updateConfirmations(currentHeight) {
    for (const utxo of this.utxos.values()) {
      utxo.updateConfirmations(currentHeight)
    }
  }

  /**
   * 清理旧的已花费UTXO记录
   * @param {number} maxAge - 最大保留区块数
   */
  cleanupSpentUTXOs(maxAge = 1000) {
    const cutoffHeight = this.lastProcessedHeight - maxAge
    let cleanedCount = 0

    for (const [key, utxo] of this.spentUTXOs) {
      if (utxo.spentHeight && utxo.spentHeight < cutoffHeight) {
        this.spentUTXOs.delete(key)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 清理了 ${cleanedCount} 个旧的已花费UTXO记录`)
    }
  }

  /**
   * 验证UTXO集合完整性
   * @throws {Error} 如果发现不一致
   */
  validate() {
    let totalInMap = 0
    let totalInIndex = 0

    // 验证主映射表和地址索引的一致性
    for (const [key, utxo] of this.utxos) {
      totalInMap += utxo.amount

      // 检查地址索引
      const addressSet = this.addressIndex.get(utxo.address)
      if (!addressSet || !addressSet.has(key)) {
        throw new Error(
          `地址索引不一致: UTXO ${key} 未在地址 ${utxo.address} 的索引中`
        )
      }
    }

    // 验证地址索引
    for (const [address, utxoKeys] of this.addressIndex) {
      for (const key of utxoKeys) {
        const utxo = this.utxos.get(key)
        if (!utxo) {
          throw new Error(`地址索引包含不存在的UTXO: ${key}`)
        }
        if (utxo.address !== address) {
          throw new Error(
            `UTXO ${key} 的地址不匹配: 期望 ${address}，实际 ${utxo.address}`
          )
        }
        totalInIndex += utxo.amount
      }
    }

    // 验证总供应量
    if (totalInMap !== this.totalSupply) {
      throw new Error(
        `总供应量不一致: 映射表总额 ${totalInMap}，记录总额 ${this.totalSupply}`
      )
    }

    if (totalInMap !== totalInIndex) {
      throw new Error(
        `地址索引总额不一致: 映射表总额 ${totalInMap}，索引总额 ${totalInIndex}`
      )
    }

    console.log('✅ UTXO集合验证通过')
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    const uniqueAddresses = this.addressIndex.size
    const totalUTXOs = this.utxos.size
    const spentUTXOsCount = this.spentUTXOs.size

    // 按金额分组统计
    const amountRanges = {
      dust: 0, // < 0.001 tokens
      small: 0, // 0.001 - 0.1 tokens
      medium: 0, // 0.1 - 10 tokens
      large: 0 // > 10 tokens
    }

    for (const utxo of this.utxos.values()) {
      if (utxo.amount < 0.001) {
        amountRanges.dust++
      } else if (utxo.amount < 0.1) {
        amountRanges.small++
      } else if (utxo.amount < 10) {
        amountRanges.medium++
      } else {
        amountRanges.large++
      }
    }

    return {
      totalSupply: this.totalSupply,
      totalUTXOs,
      uniqueAddresses,
      spentUTXOsCount,
      lastProcessedHeight: this.lastProcessedHeight,
      amountRanges,
      averageUTXOAmount: totalUTXOs > 0 ? this.totalSupply / totalUTXOs : 0
    }
  }

  /**
   * 清空UTXO集合
   */
  clear() {
    this.utxos.clear()
    this.addressIndex.clear()
    this.spentUTXOs.clear()
    this.totalSupply = 0
    this.lastProcessedHeight = 0
    console.log('🗑️  UTXO集合已清空')
  }

  /**
   * 序列化UTXO集合
   * @returns {Object} 序列化数据
   */
  serialize() {
    const utxosData = []
    for (const utxo of this.utxos.values()) {
      utxosData.push(utxo.serialize())
    }

    const spentUTXOsData = []
    for (const utxo of this.spentUTXOs.values()) {
      spentUTXOsData.push(utxo.serialize())
    }

    return {
      utxos: utxosData,
      spent_utxos: spentUTXOsData,
      total_supply: this.totalSupply.toString(),
      last_processed_height: this.lastProcessedHeight
    }
  }

  /**
   * 从序列化数据恢复UTXO集合
   * @param {Object} data - 序列化数据
   * @returns {UTXOSet} UTXO集合实例
   */
  static deserialize(data) {
    const utxoSet = new UTXOSet()

    // 恢复UTXO
    if (data.utxos) {
      for (const utxoData of data.utxos) {
        const utxo = UTXO.deserialize(utxoData)
        utxoSet.addUTXO(utxo)
      }
    }

    // 恢复已花费的UTXO
    if (data.spent_utxos) {
      for (const utxoData of data.spent_utxos) {
        const utxo = UTXO.deserialize(utxoData)
        utxoSet.spentUTXOs.set(utxo.getKey(), utxo)
      }
    }

    // 恢复其他属性
    utxoSet.totalSupply = parseFloat(data.total_supply) || 0
    utxoSet.lastProcessedHeight = data.last_processed_height || 0

    console.log(`📦 从序列化数据恢复UTXO集合: ${utxoSet.utxos.size} 个UTXO`)

    return utxoSet
  }
}

export default UTXOSet
