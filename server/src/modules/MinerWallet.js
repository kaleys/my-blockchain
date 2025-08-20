/** @format */

import { error } from 'console'
import CryptoUtils from '../utils/CryptoUtils.js'

/**
 * 矿工钱包管理器
 */
export class MinerWallet {
  constructor() {
    this.minerAddress = null
    this.privateKey = null
    this.publicKey = null
    this.minerName = 'Node Miner'
    this.isInitialized = false
  }

  /**
   * 初始化矿工钱包
   * @param {Object} options - 初始化选项
   * @param {string} options.privateKey - 私钥（可选）
   * @param {string} options.address - 自定义地址（可选）
   * @returns {Object} 初始化结果
   */
  initialize() {
    if (this.isInitialized) {
      new error('已经初始化')
    }
    try {
      // 生成新的完整钱包
      const keyPair = CryptoUtils.generateKeyPair()
      this.privateKey = keyPair.privateKey
      this.publicKey = keyPair.publicKey
      this.minerAddress = CryptoUtils.generateAddress(this.publicKey)
      this.minerName = 'Node Miner'

      this.isInitialized = true

      console.log(`🏗️ 矿工钱包已初始化:`)
      console.log(`   矿工地址: ${this.minerAddress}`)
      console.log(`   矿工名称: ${this.minerName}`)

      return {
        success: true,
        address: this.minerAddress,
        name: this.minerName,
        hasPrivateKey: !!this.privateKey,
        hasPublicKey: !!this.publicKey
      }
    } catch (error) {
      console.error(`❌ 矿工钱包初始化失败: ${error.message}`)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 获取矿工地址
   * @returns {string|null} 矿工地址
   */
  getAddress() {
    return this.minerAddress
  }

  /**
   * 获取矿工信息
   * @returns {Object} 矿工信息
   */
  getInfo() {
    return {
      address: this.minerAddress,
      name: this.minerName,
      isInitialized: this.isInitialized,
      hasPrivateKey: !!this.privateKey,
      hasPublicKey: !!this.publicKey
    }
  }

  /**
   * 获取私钥
   * @returns {string|null} 私钥
   */
  getPrivateKey() {
    return this.privateKey
  }

  /**
   * 获取公钥
   * @returns {string|null} 公钥
   */
  getPublicKey() {
    return this.publicKey
  }

  /**
   * 检查是否有私钥
   * @returns {boolean} 是否有私钥
   */
  hasPrivateKey() {
    return !!this.privateKey
  }

  /**
   * 签名数据
   * @param {string} data - 要签名的数据
   * @returns {string} 签名结果
   * @throws {Error} 如果没有私钥
   */
  sign(data) {
    if (!this.privateKey) {
      throw new Error('钱包没有私钥，无法签名')
    }
    return CryptoUtils.sign(data, this.privateKey)
  }

  /**
   * 验证签名
   * @param {string} data - 原始数据
   * @param {string} signature - 签名
   * @returns {boolean} 签名是否有效
   */
  verify(data, signature) {
    if (!this.publicKey) {
      return false
    }
    return CryptoUtils.verify(data, signature, this.publicKey)
  }

  /**
   * 设置矿工地址（仅地址模式，无私钥）
   * @param {string} address - 新的矿工地址
   * @returns {boolean} 是否设置成功
   */
  setAddress(address) {
    if (!CryptoUtils.isValidAddress(address)) {
      console.error(`❌ 无效的矿工地址: ${address}`)
      return false
    }

    this.minerAddress = address
    this.privateKey = null
    this.publicKey = null
    this.minerName = 'Watch-Only Miner'
    this.isInitialized = true

    console.log(`✅ 矿工地址已更新: ${address}`)
    console.warn('⚠️ 注意：此模式没有私钥，无法签名交易')
    return true
  }

  /**
   * 从私钥设置钱包
   * @param {string} privateKey - 私钥
   * @returns {boolean} 是否设置成功
   */
  setFromPrivateKey(privateKey) {
    try {
      this.privateKey = privateKey
      this.publicKey = CryptoUtils.getPublicKey(privateKey)
      this.minerAddress = CryptoUtils.generateAddress(this.publicKey)
      this.minerName = 'Imported Miner'
      this.isInitialized = true

      console.log(`✅ 矿工钱包已从私钥设置: ${this.minerAddress}`)
      return true
    } catch (error) {
      console.error(`❌ 从私钥设置钱包失败: ${error.message}`)
      return false
    }
  }

  /**
   * 检查钱包是否已初始化
   * @returns {boolean} 是否已初始化
   */
  isReady() {
    return this.isInitialized && this.minerAddress !== null
  }

  /**
   * 重置矿工钱包
   */
  reset() {
    this.minerAddress = null
    this.privateKey = null
    this.publicKey = null
    this.minerName = 'Node Miner'
    this.isInitialized = false
    console.log('🔄 矿工钱包已重置')
  }

  /**
   * 序列化矿工钱包信息（安全版本，不包含私钥）
   * @param {boolean} includePrivateKey - 是否包含私钥（危险！）
   * @returns {Object} 序列化数据
   */
  serialize(includePrivateKey = false) {
    const data = {
      address: this.minerAddress,
      name: this.minerName,
      isInitialized: this.isInitialized,
      hasPrivateKey: !!this.privateKey,
      hasPublicKey: !!this.publicKey
    }

    if (includePrivateKey && this.privateKey) {
      console.warn('⚠️ 警告：序列化包含私钥，请确保安全存储！')
      data.privateKey = this.privateKey
      data.publicKey = this.publicKey
    }

    return data
  }

  /**
   * 从序列化数据恢复
   * @param {Object} data - 序列化数据
   * @returns {boolean} 是否恢复成功
   */
  deserialize(data) {
    try {
      if (data.address && CryptoUtils.isValidAddress(data.address)) {
        this.minerAddress = data.address
        this.minerName = data.name || 'Node Miner'
        this.isInitialized = data.isInitialized || false

        // 如果有私钥数据，恢复完整钱包
        if (data.privateKey) {
          this.privateKey = data.privateKey
          this.publicKey =
            data.publicKey || CryptoUtils.getPublicKey(data.privateKey)
          console.log(`📦 矿工钱包已从数据恢复（含私钥）: ${this.minerAddress}`)
        } else {
          this.privateKey = null
          this.publicKey = null
          console.log(`📦 矿工钱包已从数据恢复（仅地址）: ${this.minerAddress}`)
        }

        return true
      }
      return false
    } catch (error) {
      console.error(`❌ 矿工钱包恢复失败: ${error.message}`)
      return false
    }
  }

  /**
   * 导出钱包（用于备份）
   * @returns {Object} 导出数据
   */
  exportWallet() {
    if (!this.privateKey) {
      throw new Error('钱包没有私钥，无法导出')
    }

    return {
      address: this.minerAddress,
      privateKey: this.privateKey,
      publicKey: this.publicKey,
      name: this.minerName,
      exportTime: Date.now(),
      version: '1.0.0'
    }
  }

  /**
   * 从导出数据导入钱包
   * @param {Object} exportData - 导出数据
   * @returns {boolean} 是否导入成功
   */
  importWallet(exportData) {
    try {
      if (!exportData.privateKey) {
        throw new Error('导入数据缺少私钥')
      }

      this.privateKey = exportData.privateKey
      this.publicKey =
        exportData.publicKey || CryptoUtils.getPublicKey(exportData.privateKey)
      this.minerAddress =
        exportData.address || CryptoUtils.generateAddress(this.publicKey)
      this.minerName = exportData.name || 'Imported Miner'
      this.isInitialized = true

      console.log(`📥 矿工钱包导入成功: ${this.minerAddress}`)
      return true
    } catch (error) {
      console.error(`❌ 矿工钱包导入失败: ${error.message}`)
      return false
    }
  }
}

export default MinerWallet
