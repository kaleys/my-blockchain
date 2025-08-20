/** @format */

import { privateEncrypt } from 'crypto'
import CryptoUtils from '../utils/CryptoUtils.js'

/**
 * 交易输入类 - 引用之前交易的输出
 */
export class TransactionInput {
  constructor(
    transactionId,
    outputIndex,
    scriptSig = '',
    publicKey = '',
    amount = null
  ) {
    this.transactionId = transactionId // 引用的交易ID
    this.outputIndex = outputIndex // 输出索引
    this.scriptSig = scriptSig // 解锁脚本/签名
    this.publicKey = publicKey // 公钥
    this.sequence = 0xffffffff // 序列号
    this.amount = amount // 对应UTXO的金额（用于显示）
  }

  /**
   * 创建Coinbase输入
   * @param {number} blockHeight - 区块高度
   * @param {string} extraNonce - 额外随机数
   * @returns {TransactionInput} Coinbase输入
   */
  static createCoinbase(blockHeight, extraNonce = '') {
    const coinbaseData = `${blockHeight}${extraNonce}${Date.now()}`
    return new TransactionInput(
      '0'.repeat(64), // Coinbase交易ID为全0
      0xffffffff, // Coinbase输出索引为最大值
      coinbaseData, // Coinbase数据
      '', // 无公钥
      null // Coinbase没有前置金额
    )
  }

  /**
   * 验证输入有效性
   * @returns {Object} 验证结果
   */
  // isValid() {
  //   // Coinbase输入验证
  //   if (
  //     this.transactionId === '0'.repeat(64) &&
  //     this.outputIndex === 0xffffffff
  //   ) {
  //     return { valid: true, reason: 'Coinbase输入有效' }
  //   }

  //   // 普通输入验证
  //   if (!this.transactionId || this.transactionId.length !== 64) {
  //     return { valid: false, reason: '交易ID格式无效' }
  //   }

  //   if (typeof this.outputIndex !== 'number' || this.outputIndex < 0) {
  //     return { valid: false, reason: '输出索引无效' }
  //   }

  //   if (!this.publicKey) {
  //     return { valid: false, reason: '缺少公钥' }
  //   }

  //   return { valid: true, reason: '输入有效' }
  // }

  /**
   * 序列化输入
   * @returns {Object} 序列化数据
   */
  serialize() {
    return {
      transaction_id: this.transactionId,
      output_index: this.outputIndex,
      script_sig: this.scriptSig,
      public_key: this.publicKey,
      sequence: this.sequence
    }
  }

  /**
   * 从序列化数据恢复输入
   * @param {Object} data - 序列化数据
   * @returns {TransactionInput} 输入实例
   */
  static deserialize(data) {
    const input = new TransactionInput(
      data.transaction_id,
      data.output_index,
      data.script_sig,
      data.public_key
    )
    input.sequence = data.sequence || 0xffffffff
    return input
  }
}

/**
 * 交易输出类 - 指定接收方和金额
 */
export class TransactionOutput {
  constructor(address, amount, scriptPubKey = '') {
    this.address = address // 接收地址
    this.amount = amount // 金额（tokens）
    // 锁定脚本，
    this.scriptPubKey = scriptPubKey
    this.spent = false // 是否已花费
    this.spentTxId = null // 花费该输出的交易ID
    this.spentHeight = null // 花费时的区块高度
  }

  /**
   * 验证输出有效性
   * @returns {Object} 验证结果
   */
  // isValid() {
  //   if (!this.address || typeof this.address !== 'string') {
  //     return { valid: false, reason: '接收地址无效' }
  //   }

  //   if (typeof this.amount !== 'number' || this.amount <= 0) {
  //     return { valid: false, reason: '金额必须大于0' }
  //   }

  //   // 检查金额精度（最多8位小数）
  //   const roundedAmount = Math.round(this.amount * 100000000) / 100000000
  //   if (Math.abs(this.amount - roundedAmount) > 1e-8) {
  //     return { valid: false, reason: '金额精度不能超过8位小数' }
  //   }

  //   // 检查最大金额限制
  //   const maxAmount = 21000000 // 2100万个token
  //   if (this.amount > maxAmount) {
  //     return { valid: false, reason: '金额超过最大限制' }
  //   }

  //   return { valid: true, reason: '输出有效' }
  // }

  /**
   * 标记为已花费
   * @param {string} txId - 花费该输出的交易ID
   * @param {number} height - 区块高度
   */
  markAsSpent(txId, height) {
    this.spent = true
    this.spentTxId = txId
    this.spentHeight = height
  }

  /**
   * 序列化输出
   * @returns {Object} 序列化数据
   */
  serialize() {
    return {
      address: this.address,
      amount: this.amount.toString(),
      script_pub_key: this.scriptPubKey,
      spent: this.spent,
      spent_tx_id: this.spentTxId,
      spent_height: this.spentHeight
    }
  }

  /**
   * 从序列化数据恢复输出
   * @param {Object} data - 序列化数据
   * @returns {TransactionOutput} 输出实例
   */
  static deserialize(data) {
    const output = new TransactionOutput(
      data.address,
      parseFloat(data.amount),
      data.script_pub_key
    )
    output.spent = data.spent || false
    output.spentTxId = data.spent_tx_id || null
    output.spentHeight = data.spent_height || null
    return output
  }
}

/**
 * 交易类 - 包含输入和输出的完整交易
 */
export class Transaction {
  constructor(inputs = [], outputs = []) {
    this.id = '' // 交易ID（哈希）
    this.version = 1 // 交易版本
    this.inputs = inputs // 输入列表
    this.outputs = outputs // 输出列表
    this.lockTime = 0 // 锁定时间
    this.fee = 0 // 交易手续费
    this.timestamp = Date.now() // 创建时间戳
    this.confirmed = false // 是否已确认
    this.blockHeight = null // 确认区块高度
    this.blockHash = null // 确认区块哈希

    // 计算交易ID和大小
    this.updateTransactionId()
  }

  /**
   * 更新交易ID
   */
  updateTransactionId() {
    const txData = {
      version: this.version,
      inputs: this.inputs.map((input) => {
        return input.serialize()
      }),
      outputs: this.outputs.map((output) => output.serialize()),
      lockTime: this.lockTime
    }
    this.id = CryptoUtils.sha256(JSON.stringify(txData))
  }

  /**
   * 检查是否为Coinbase交易
   * @returns {boolean} 是否为Coinbase交易
   */
  isCoinbase() {
    return (
      this.inputs.length === 1 &&
      this.inputs[0].transactionId === '0'.repeat(64) &&
      this.inputs[0].outputIndex === 0xffffffff
    )
  }

  /**
   * 计算输入总金额
   * @param {UTXOSet} utxoSet - UTXO集合
   * @returns {number} 输入总金额
   */
  getInputAmount(utxoSet) {
    let totalInput = 0

    for (const input of this.inputs) {
      if (input.transactionId === '0'.repeat(64)) {
        // Coinbase交易输入金额为0
        continue
      }

      const utxo = utxoSet.getUTXO(input.transactionId, input.outputIndex)
      if (utxo) {
        totalInput += utxo.amount
      }
    }

    return totalInput
  }

  /**
   * 计算输出总金额
   * @returns {number} 输出总金额
   */
  getOutputAmount() {
    return this.outputs.reduce((sum, output) => sum + output.amount, 0)
  }

  /**
   * 计算交易手续费
   * @param {UTXOSet} utxoSet - UTXO集合
   * @returns {number} 交易手续费
   */
  calculateFee(utxoSet) {
    if (this.isCoinbase()) {
      this.fee = 0
      return 0
    }

    const inputAmount = this.getInputAmount(utxoSet)
    const outputAmount = this.getOutputAmount()
    this.fee = inputAmount - outputAmount
    return this.fee
  }

  /**
   * 验证交易有效性 - 核心脚本验证
   * @param {UTXOSet} utxoSet - UTXO集合
   * @param {Object} options - 验证选项
   * @returns {Object} 验证结果
   */
  isValid(utxoSet, options = {}) {
    const { skipSignatureVerification = false } = options

    try {
      // 1. Coinbase交易直接通过
      if (this.isCoinbase()) {
        return { valid: true, reason: 'Coinbase交易验证通过' }
      }

      // 2. 验证输入输出基本结构
      if (!this.inputs || this.inputs.length === 0) {
        return { valid: false, reason: '交易缺少输入' }
      }
      if (!this.outputs || this.outputs.length === 0) {
        return { valid: false, reason: '交易缺少输出' }
      }

      // 3. 核心验证：验证每个输入的脚本
      for (let i = 0; i < this.inputs.length; i++) {
        const input = this.inputs[i]

        // 获取引用的UTXO
        const utxo = utxoSet.getUTXO(input.transactionId, input.outputIndex)
        if (!utxo) {
          return {
            valid: false,
            reason: `输入${i}引用的UTXO不存在: ${input.transactionId}:${input.outputIndex}`
          }
        }

        // 验证UTXO是否已被花费
        if (utxo.spent) {
          return {
            valid: false,
            reason: `输入${i}引用的UTXO已被花费: ${input.transactionId}:${input.outputIndex}`
          }
        }

        // 核心脚本验证：scriptSig + scriptPubKey
        if (!skipSignatureVerification) {
          const scriptValid = this.validateScript(input, utxo, i)
          if (!scriptValid.valid) {
            return {
              valid: false,
              reason: `输入${i}脚本验证失败: ${scriptValid.reason}`
            }
          }
        }
      }

      // 4. 验证输入输出金额平衡
      const inputAmount = this.getInputAmount(utxoSet)
      const outputAmount = this.getOutputAmount()

      if (inputAmount < outputAmount) {
        return {
          valid: false,
          reason: `输入金额不足: 输入=${inputAmount}, 输出=${outputAmount}`
        }
      }

      return { valid: true, reason: '交易验证通过' }
    } catch (error) {
      return {
        valid: false,
        reason: `交易验证异常: ${error.message}`
      }
    }
  }

  /**
   * 验证单个输入的脚本 (scriptSig + scriptPubKey)
   * @param {TransactionInput} input - 交易输入
   * @param {UTXO} utxo - 引用的UTXO
   * @param {number} inputIndex - 输入索引
   * @returns {Object} 验证结果
   */
  validateScript(input, utxo, inputIndex) {
    try {
      //因为客户端在交易的时候，因为没有utxo,所以这里走一个过程
      if (input.scriptSig == 'custom_exchange') {
        return { valid: true, reason: '脚本验证通过' }
      }
      if (!input.scriptSig || !input.publicKey) {
        // 简化的脚本验证逻辑：
        // input scriptSig = 签名 (证明拥有私钥)
        // output-utxo scriptPubKey = 地址 (统一使用地址作为锁定条件)

        return { valid: false, reason: '缺少签名或公钥' }
      }

      if (!utxo.scriptPubKey) {
        return { valid: false, reason: 'UTXO缺少scriptPubKey' }
      }

      // 1. 验证地址一致性：公钥生成的地址必须匹配UTXO地址
      const addressFromPubKey = CryptoUtils.generateAddress(
        input.publicKey,
        utxo.address
      )
      if (addressFromPubKey !== utxo.address) {
        console.log(
          `🔍 地址验证失败: 生成地址=${addressFromPubKey}, UTXO地址=${utxo.address}`
        )
        return { valid: false, reason: '公钥生成的地址与UTXO地址不匹配' }
      }

      // 2. 验证scriptPubKey：必须等于UTXO地址
      if (utxo.scriptPubKey !== utxo.address) {
        return { valid: false, reason: 'scriptPubKey与UTXO地址不匹配' }
      }

      // 3. 验证数字签名：证明拥有该地址的私钥
      const signatureData = {
        transactionId: utxo.transactionId,
        inputIndex: inputIndex,
        outputAddress: utxo.address,
        amount: utxo.amount
      }
      const isValidSignature = CryptoUtils.verify(
        JSON.stringify(signatureData),
        input.scriptSig,
        input.publicKey
      )

      if (!isValidSignature) {
        return { valid: false, reason: '数字签名验证失败' }
      }

      return { valid: true, reason: '脚本验证通过' }
    } catch (error) {
      return {
        valid: false,
        reason: `脚本验证异常: ${error.message}`
      }
    }
  }

  /**
   * 创建Coinbase交易
   * @param {string} minerAddress - 矿工地址
   * @param {number} blockHeight - 区块高度
   * @param {number} reward - 总奖励（区块奖励+手续费）
   * @param {string} extraData - 额外数据
   * @returns {Transaction} Coinbase交易
   */
  static createCoinbase(minerAddress, blockHeight, reward, extraData = '') {
    const coinbaseInput = TransactionInput.createCoinbase(
      blockHeight,
      extraData
    )
    const coinbaseOutput = new TransactionOutput(minerAddress, reward)

    const transaction = new Transaction([coinbaseInput], [coinbaseOutput])
    transaction.timestamp = Date.now()

    console.log(`💰 创建Coinbase交易: 奖励${reward} tokens 给 ${minerAddress}`)

    return transaction
  }

  /**
   * 创建并签名转账交易（完整流程）
   * @param {string} fromAddress - 发送地址
   * @param {string} toAddress - 接收地址
   * @param {number} amount - 转账金额
   * @param {string} privateKey - 私钥
   * @param {string} publicKey - 公钥
   * @param {UTXOSet} utxoSet - UTXO集合
   * @returns {Transaction} 已签名的交易
   */
  static createAndSignTransfer(
    fromAddress,
    toAddress,
    amount,
    publicKey,
    utxoSet,
    privateKey
  ) {
    console.log(
      `🔍 创建转账交易: ${fromAddress} -> ${toAddress}, 金额: ${amount}`
    )
    console.log(`📊 当前 UTXO 集合总数: ${utxoSet.utxos.size}`)
    console.log(`💰 发送方余额: ${utxoSet.getBalance(fromAddress)}`)
    // 1. 选择UTXO进行支付
    try {
      const { utxos, fee, change } = utxoSet.selectUTXOsForPayment(
        fromAddress,
        amount
      )

      console.log(`📦 选中的 UTXO 数量: ${utxos.length}`)
      utxos.forEach((utxo, index) => {
        console.log(
          `   UTXO ${index}: ${utxo.transactionId}:${utxo.outputIndex} - ${utxo.amount} 个币`
        )
      })

      // 2. 创建交易输入
      const inputs = utxos.map((utxo) => {
        return new TransactionInput(
          utxo.transactionId,
          utxo.outputIndex,
          '', //签名
          publicKey, // 添加公钥
          utxo.amount // 添加金额用于显示
        )
      })

      // 3. 创建交易输出
      const outputs = []

      // 发送给目标地址的输出（使用地址作为 scriptPubKey）
      outputs.push(new TransactionOutput(toAddress, amount, toAddress))

      // 如果有找零，添加找零输出（使用发送方地址作为 scriptPubKey）
      if (change > 0) {
        outputs.push(new TransactionOutput(fromAddress, change, fromAddress))
      }

      // 4. 创建交易
      const transaction = new Transaction(inputs, outputs)

      // 5. 更新手续费
      transaction.fee = fee

      // 6. 签名交易
      transaction.sign(privateKey, utxoSet)

      console.log(
        `💸 创建转账交易: ${fromAddress} -> ${toAddress}, 金额: ${amount}, 手续费: ${fee}`
      )

      return transaction
    } catch (error) {
      throw error
    }
  }

  /**
   * 签名交易
   * @param {string} privateKey - 私钥
   * @param {UTXOSet} utxoSet - UTXO集合
   */
  sign(privateKey, utxoSet) {
    if (this.isCoinbase()) {
      return // Coinbase交易不需要签名
    }

    for (let i = 0; i < this.inputs.length; i++) {
      const input = this.inputs[i]
      const utxo = utxoSet.getUTXO(input.transactionId, input.outputIndex)

      if (!utxo) {
        throw new Error(
          `找不到UTXO: ${input.transactionId}:${input.outputIndex}`
        )
      }

      // 创建签名数据
      const signatureData = {
        transactionId: input.transactionId,
        inputIndex: i,
        outputAddress: utxo.address,
        amount: utxo.amount
      }

      // 生成签名
      if (privateKey) {
        input.scriptSig = CryptoUtils.sign(
          JSON.stringify(signatureData),
          privateKey
        )
        input.publicKey = CryptoUtils.getPublicKey(privateKey)
      } else {
        input.scriptSig = 'custom_exchange'
      }
    }

    // 重新计算交易ID（包含签名后）
    this.updateTransactionId()
  }

  /**
   * 确认交易
   * @param {number} blockHeight - 区块高度
   * @param {string} blockHash - 区块哈希
   */
  confirm(blockHeight, blockHash) {
    this.confirmed = true
    this.blockHeight = blockHeight
    this.blockHash = blockHash
  }

  /**
   * 获取交易摘要
   * @returns {Object} 交易摘要
   */
  getSummary() {
    return {
      id: this.id,
      version: this.version,
      inputCount: this.inputs.length,
      outputCount: this.outputs.length,
      inputAmount: this.inputs.reduce(
        (sum, input) => sum + (input.amount || 0),
        0
      ),
      outputAmount: this.getOutputAmount(),
      fee: this.fee,
      feeRate: this.getFeeRate(),
      size: this.getSize(),
      timestamp: this.timestamp,
      confirmed: this.confirmed,
      blockHeight: this.blockHeight,
      isCoinbase: this.isCoinbase()
    }
  }

  /**
   * 序列化交易
   * @returns {Object} 序列化数据
   */
  serialize() {
    return {
      id: this.id,
      version: this.version,
      inputs: this.inputs.map((input) => input.serialize()),
      outputs: this.outputs.map((output) => output.serialize()),
      lock_time: this.lockTime,
      fee: this.fee,
      size: this.size,
      timestamp: this.timestamp,
      confirmed: this.confirmed,
      block_height: this.blockHeight,
      block_hash: this.blockHash
    }
  }

  /**
   * 从序列化数据恢复交易
   * @param {Object} data - 序列化数据
   * @returns {Transaction} 交易实例
   */
  static deserialize(data) {
    const inputs = data.inputs.map((inputData) =>
      TransactionInput.deserialize(inputData)
    )
    const outputs = data.outputs.map((outputData) =>
      TransactionOutput.deserialize(outputData)
    )

    const transaction = new Transaction(inputs, outputs)
    transaction.id = data.id
    transaction.version = data.version || 1
    transaction.lockTime = data.lock_time || 0
    transaction.fee = data.fee || 0
    transaction.size = data.size || 0
    transaction.timestamp = data.timestamp || Date.now()
    transaction.confirmed = data.confirmed || false
    transaction.blockHeight = data.block_height || null
    transaction.blockHash = data.block_hash || null

    return transaction
  }
}

export default Transaction
