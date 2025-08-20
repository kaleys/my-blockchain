/** @format */

import crypto from 'crypto'
import secp256k1 from 'secp256k1'
import { sha256, ripemd160 } from '@cosmjs/crypto'
import { toHex, fromHex } from '@cosmjs/encoding'

/**
 * 加密工具类 - 提供哈希、签名等加密功能
 */
class CryptoUtils {
  /**
   * 计算SHA256哈希
   * @param {string} data - 要哈希的数据
   * @returns {string} SHA256哈希值
   */
  static sha256(data) {
    return crypto.createHash('sha256').update(data).digest('hex')
  }

  /**
   * 计算RIPEMD160哈希
   * @param {string} data - 要哈希的数据
   * @returns {string} RIPEMD160哈希值
   */
  static ripemd160(data) {
    return crypto.createHash('ripemd160').update(data).digest('hex')
  }

  /**
   * 双重SHA256哈希
   * @param {string} data - 要哈希的数据
   * @returns {string} 双重SHA256哈希值
   */
  static doubleSha256(data) {
    const hash1 = crypto.createHash('sha256').update(data).digest()
    return crypto.createHash('sha256').update(hash1).digest('hex')
  }

  /**
   * 计算Merkle树根哈希
   * @param {Array<string>} hashes - 哈希数组
   * @returns {string} Merkle根哈希
   */
  static calculateMerkleRoot(hashes) {
    if (hashes.length === 0) {
      return this.sha256('')
    }

    if (hashes.length === 1) {
      return hashes[0]
    }

    // 如果数量为奇数，复制最后一个哈希
    let levelHashes = [...hashes]
    if (levelHashes.length % 2 !== 0) {
      levelHashes.push(levelHashes[levelHashes.length - 1])
    }

    // 递归计算
    const nextLevel = []
    for (let i = 0; i < levelHashes.length; i += 2) {
      const combined = levelHashes[i] + levelHashes[i + 1]
      nextLevel.push(this.sha256(combined))
    }

    return this.calculateMerkleRoot(nextLevel)
  }

  /**
   * 验证哈希是否满足难度要求
   * @param {string} hash - 哈希值
   * @param {number} difficulty - 难度
   * @returns {boolean} 是否满足难度
   */
  static isValidHash(hash, difficulty) {
    const target = '0'.repeat(difficulty)
    return hash.startsWith(target)
  }

  /**
   * 生成随机字符串
   * @param {number} length - 长度
   * @returns {string} 随机字符串
   */
  static generateRandomString(length = 32) {
    return crypto.randomBytes(length).toString('hex')
  }

  /**
   * 生成密钥对（完全使用CosmJS算法）
   * @returns {Object} 密钥对 {privateKey, publicKey}
   */
  static generateKeyPair() {
    // 生成32字节随机私钥
    let privateKey
    do {
      privateKey = crypto.randomBytes(32)
    } while (!secp256k1.privateKeyVerify(privateKey))
    
    // 从私钥生成公钥
    const publicKey = secp256k1.publicKeyCreate(privateKey, false) // uncompressed
    
    console.log('🔑 生成CosmJS兼容密钥对')
    return {
      privateKey: toHex(privateKey),
      publicKey: toHex(publicKey)
    }
  }

  /**
   * 从私钥获取公钥（使用CosmJS标准算法）
   * @param {string} privateKey - 私钥（十六进制格式）
   * @returns {string} 公钥（十六进制格式）
   */
  static getPublicKey(privateKey) {
    try {
      const privateKeyBytes = fromHex(privateKey)
      if (!secp256k1.privateKeyVerify(privateKeyBytes)) {
        throw new Error('无效的私钥')
      }
      
      const publicKeyBytes = secp256k1.publicKeyCreate(privateKeyBytes, false)
      return toHex(publicKeyBytes)
    } catch (error) {
      console.error('从私钥生成公钥失败:', error)
      throw error
    }
  }

  /**
   * 从公钥生成ox格式地址（智能选择算法）
   * @param {string} publicKey - 公钥（十六进制格式或pub_前缀格式）
   * @param {string} fromAddress - 客户端提供的地址（优先使用，用于兼容）
   * @returns {string} ox格式地址
   */
  static generateAddress(publicKey, fromAddress = null) {
    try {
      // 如果客户端提供了有效地址，优先使用（兼容处理）
      if (fromAddress && this.isValidAddress(fromAddress)) {
        console.log(`✅ 使用客户端提供的地址: ${fromAddress}`)
        return fromAddress
      }
      
      // 检测公钥格式并选择合适的算法
      if (publicKey.startsWith('pub_')) {
        // 客户端简化格式，使用客户端兼容算法
        const clientAddress = this.generateClientCompatibleAddress(publicKey)
        console.log(`🔑 使用客户端兼容算法生成地址: ${clientAddress}`)
        return clientAddress
      }
      
      try {
        // 尝试使用CosmJS标准算法
        const publicKeyBytes = fromHex(publicKey)
        const sha256Hash = sha256(publicKeyBytes)
        const ripemd160Hash = ripemd160(sha256Hash)
        const addressHex = toHex(ripemd160Hash).substring(0, 37)
        const oxAddress = 'ox' + addressHex.toLowerCase()
        
        console.log(`🔑 使用CosmJS标准算法生成地址: ${oxAddress}`)
        return oxAddress
      } catch (cosmjsError) {
        // CosmJS算法失败，回退到客户端兼容算法
        console.log(`⚠️ CosmJS算法失败，使用客户端兼容算法`)
        const clientAddress = this.generateClientCompatibleAddress(publicKey)
        console.log(`🔑 客户端兼容算法生成地址: ${clientAddress}`)
        return clientAddress
      }
    } catch (error) {
      console.error('地址生成失败:', error)
      throw error
    }
  }


  /**
   * 生成符合ox前缀的地址（匹配前端钱包格式）
   * @param {number} entropy - 熵值（可选）
   * @returns {string} ox前缀地址
   */
  static generateCosmosAddress(entropy = null) {
    // 生成随机熵或使用提供的熵
    const randomData = entropy
      ? entropy.toString()
      : this.generateRandomString(32)

    // 使用双重哈希增加随机性
    const hash1 = this.sha256(randomData)
    const hash2 = this.ripemd160(hash1)

    // 生成37字节的地址数据部分（匹配ox格式）
    const addressBytes = hash2.substring(0, 37)

    // 构造ox格式地址
    const addressPart = addressBytes.toLowerCase()

    // 确保地址符合ox格式: ox + 37字符
    return 'ox' + addressPart
  }

  /**
   * 签名数据（使用CosmJS标准ECDSA签名）
   * @param {string} data - 要签名的数据
   * @param {string} privateKey - 私钥（十六进制格式）
   * @returns {string} 十六进制格式的签名
   */
  static sign(data, privateKey) {
    try {
      const privateKeyBytes = fromHex(privateKey)
      if (!secp256k1.privateKeyVerify(privateKeyBytes)) {
        throw new Error('无效的私钥')
      }
      
      // 对数据进行SHA256哈希
      const dataHash = sha256(Buffer.from(data, 'utf8'))
      
      // 使用secp256k1签名
      const signature = secp256k1.ecdsaSign(dataHash, privateKeyBytes)
      
      console.log('🔑 使用CosmJS标准ECDSA签名')
      return toHex(signature.signature)
    } catch (error) {
      console.error('签名失败:', error)
      throw error
    }
  }

  /**
   * 验证签名（使用CosmJS标准ECDSA验证）
   * @param {string} data - 原始数据
   * @param {string} signature - 十六进制格式的签名
   * @param {string} publicKey - 公钥（十六进制格式或pub_前缀格式）
   * @returns {boolean} 签名是否有效
   */
  static verify(data, signature, publicKey) {
    try {
      if (!signature || !publicKey || !data) {
        console.log('⚠️ 签名验证：缺少必要参数')
        return false
      }

      // 处理pub_前缀格式的公钥
      let cleanPublicKey = publicKey
      if (publicKey.startsWith('pub_')) {
        cleanPublicKey = publicKey.substring(4)
        console.log(`🔍 移除pub_前缀: ${publicKey} -> ${cleanPublicKey}`)
      }

      const publicKeyBytes = fromHex(cleanPublicKey)
      const signatureBytes = fromHex(signature)
      
      // 对数据进行SHA256哈希
      const dataHash = sha256(Buffer.from(data, 'utf8'))
      
      // 使用secp256k1验证签名
      const isValid = secp256k1.ecdsaVerify(signatureBytes, dataHash, publicKeyBytes)
      
      console.log(`🔍 CosmJS标准签名验证结果: ${isValid}`)
      return isValid
    } catch (error) {
      console.error('🔍 签名验证错误:', error.message)
      return false
    }
  }

  /**
   * 生成UUID
   * @returns {string} UUID
   */
  static generateUUID() {
    return crypto.randomUUID()
  }

  /**
   * 验证ox地址格式
   * @param {string} address - 地址
   * @returns {boolean} 地址是否有效
   */
  static isValidAddress(address) {
    if (typeof address !== 'string') {
      return false
    }
    // 验证ox地址格式：ox + 37个十六进制字符
    const oxPattern = /^ox[0-9a-z]{37}$/
    return oxPattern.test(address)
  }

  /**
   * 验证Bech32地址格式（更严格）
   * @param {string} address - 地址
   * @param {string} expectedPrefix - 期望的前缀（默认cosmos）
   * @returns {boolean} 地址是否有效
   */
  static isValidBech32Address(address, expectedPrefix = 'cosmos') {
    if (typeof address !== 'string') {
      return false
    }
    // 验证格式：prefix1 + data part
    const pattern = new RegExp(`^${expectedPrefix}1[0-9a-f]{32}$`)
    return (
      pattern.test(address) && address.length === expectedPrefix.length + 1 + 32
    )
  }

  /**
   * 验证哈希格式
   * @param {string} hash - 哈希
   * @returns {boolean} 哈希是否有效
   */
  static isValidHash(hash) {
    return (
      typeof hash === 'string' && hash.length === 64 && /^[a-f0-9]+$/.test(hash)
    )
  }

  /**
   * 简单哈希算法（兼容客户端walletManager的simpleHash）
   * @param {string} data - 要哈希的数据
   * @returns {string} 64字符的十六进制哈希
   */
  static simpleHash(data) {
    // 这是客户端walletManager中相同的简化哈希实现
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // 转换为32位整数
    }

    // 将哈希转换为十六进制字符串并填充到64字符
    const hexHash = Math.abs(hash).toString(16)
    return hexHash.padEnd(64, '0').substring(0, 64)
  }

  /**
   * 生成客户端兼容的ox地址（使用简单哈希算法）
   * @param {string} publicKey - 公钥数据
   * @returns {string} ox格式地址
   */
  static generateClientCompatibleAddress(publicKey) {
    try {
      // 移除pub_前缀如果存在
      let keyData = publicKey
      if (publicKey.startsWith('pub_')) {
        keyData = publicKey.substring(4)
      }
      
      // 使用客户端相同的简单哈希算法
      const hash = this.simpleHash(keyData)
      
      // 取前37个字符作为地址数据部分，匹配ox地址格式
      const addressData = hash.substring(0, 37).toLowerCase()
      
      return 'ox' + addressData
    } catch (error) {
      console.error('生成客户端兼容地址失败:', error)
      throw error
    }
  }

}

export default CryptoUtils
