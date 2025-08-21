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
   * 检查钱包是否已初始化
   * @returns {boolean} 是否已初始化
   */
  isReady() {
    return this.isInitialized && this.minerAddress !== null
  }
}

export default MinerWallet
