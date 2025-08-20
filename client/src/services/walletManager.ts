/** @format */

// 增强版Cosmos钱包管理器
import { generateMnemonic, validateMnemonic } from 'bip39'
import { Secp256k1HdWallet } from '@cosmjs/amino'
import {
  DirectSecp256k1HdWallet,
  makeCosmoshubPath
} from '@cosmjs/proto-signing'
import { toHex } from '@cosmjs/encoding'
import CryptoJS from 'crypto-js'

export interface AccountInfo {
  index: number
  address: string
  publicKey: string
  derivationPath: string
  balance?: string
}

export interface WalletInfo {
  id: string
  name: string
  address: string // 主账户地址（索引0）
  mnemonic?: string // 可选，用于导出
  publicKey: string // 主账户公钥
  accounts: AccountInfo[] // 多个派生账户
  isLocked: boolean
  isEncrypted: boolean
  createdAt: number
  lastUsed?: number
  type: 'mnemonic' | 'imported'
  backupConfirmed?: boolean
}

export interface CreateWalletOptions {
  name?: string
  mnemonic?: string // 可选，用于导入现有钱包
  password?: string // 可选，用于加密存储
  type?: 'mnemonic' | 'imported'
  strength?: 128 | 256 // 助记词强度
}

export interface ImportWalletOptions {
  type: 'mnemonic' | 'json'
  data: string
  name?: string
  password?: string
}

export interface WalletBackupData {
  name: string
  address: string
  mnemonic?: string
  createdAt: number
  version: string
  encrypted?: boolean
  encryptedData?: string
}

export interface SigningWallet {
  address: string
  publicKey: Uint8Array
  sign: (data: Uint8Array) => Promise<Uint8Array>
}

export class CosmosWalletManager {
  private wallet: WalletInfo | null = null
  private signingWallet: Secp256k1HdWallet | DirectSecp256k1HdWallet | null =
    null
  private modernWallet: DirectSecp256k1HdWallet | null = null
  private readonly prefix = 'Ox'
  private encryptionPassword: string | null = null
  private static readonly STORAGE_KEY = 'my_blockchian_v1'
  private static readonly ENCRYPTION_KEY = 'wallet_encryption_key'

  constructor() {
    this.loadWalletsFromStorage()
  }

  // 设置加密密码
  setEncryptionPassword(password: string): void {
    this.encryptionPassword = password
    const hash = CryptoJS.SHA256(password).toString()
    localStorage.setItem(CosmosWalletManager.ENCRYPTION_KEY, hash)
  }

  // 验证加密密码
  verifyEncryptionPassword(password: string): boolean {
    const storedHash = localStorage.getItem(CosmosWalletManager.ENCRYPTION_KEY)
    if (!storedHash) return true
    const hash = CryptoJS.SHA256(password).toString()
    return storedHash === hash
  }

  // 是否需要密码
  requiresPassword(): boolean {
    return localStorage.getItem(CosmosWalletManager.ENCRYPTION_KEY) !== null
  }

  // 加密数据
  private encryptData(data: string, password: string): string {
    return CryptoJS.AES.encrypt(data, password).toString()
  }

  // 解密数据
  private decryptData(encryptedData: string, password: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedData, password)
    return bytes.toString(CryptoJS.enc.Utf8)
  }

  // 生成钱包
  async createWallet(options: CreateWalletOptions): Promise<WalletInfo> {
    const walletName = options.name || 'My Cosmos Wallet'
    console.log(`🔑 创建新钱包: ${walletName}`)
    const mnemonic = options.mnemonic || ''
    const type = options.type || 'mnemonic'
    if (!mnemonic) {
      throw new Error('操作错误，没有生成助记词')
    }

    // 从助记词创建钱包
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
      prefix: this.prefix
    })

    const accounts = await wallet.getAccounts()
    if (accounts.length === 0) {
      throw new Error('无法从助记词生成账户')
    }

    // 直接使用CosmJS生成的标准地址
    const address = this.formatAddress(accounts[0].address)
    console.log(`✨ 使用CosmJS生成的标准地址: ${address}`)
    const publicKey = accounts[0].pubkey

    // 单钱包多账户模式：默认只创建一个账户（索引0）
    let derivedAccounts: AccountInfo[] = []

    console.log('🔄 正在创建默认账户...')
    derivedAccounts = await this.deriveAccountsFromMnemonic(mnemonic, 1) // 默认只创建1个账户
    console.log(`✅ 成功创建默认账户: ${derivedAccounts.length} 个`)

    const walletId = this.generateWalletId()
    const now = Date.now()

    const walletInfo: WalletInfo = {
      id: walletId,
      name: walletName,
      address, // 主账户地址（索引0）
      accounts: derivedAccounts,
      mnemonic: mnemonic,
      publicKey: toHex(publicKey),
      isLocked: false,
      isEncrypted: !!options.password,
      createdAt: now,
      type: type,
      backupConfirmed: false
    }

    // 存储钱包信息（单钱包模式）
    this.wallet = walletInfo
    if (wallet instanceof DirectSecp256k1HdWallet) {
      this.modernWallet = wallet
    } else {
      this.signingWallet = wallet
    }

    // 保存到本地存储
    await this.saveWalletsToStorage(options.password)

    console.log(`✅ 钱包创建成功: ${address}`)
    console.log(`💾 钱包数据:`, {
      id: walletId,
      name: walletName,
      hasMnemonic: !!mnemonic,
      isEncrypted: !!options.password
    })
    if (mnemonic) {
      console.log(`📝 助记词: ${mnemonic}`)
    }

    return walletInfo
  }

  // 获取钱包列表
  getWalletList(): WalletInfo[] {
    if (!this.wallet) return []

    // 为旧版钱包数据添加accounts字段兼容性
    if (!this.wallet.accounts || this.wallet.accounts.length === 0) {
      this.wallet.accounts = [
        {
          index: 0,
          address: this.wallet.address,
          publicKey: this.wallet.publicKey,
          derivationPath: "m/44'/118'/0'/0/0"
        }
      ]
    }

    return [
      {
        ...this.wallet,
        mnemonic: undefined // 不在列表中暴露助记词
      }
    ]
  }

  // 获取钱包详情
  getWallet(walletId?: string): WalletInfo | null {
    if (!this.wallet) return null

    // 如果指定了walletId，检查是否匹配
    if (walletId && this.wallet.id !== walletId) return null

    return {
      ...this.wallet,
      mnemonic: undefined // 默认不返回助记词
    }
  }

  // 获取钱包的助记词（需要验证）
  getWalletMnemonic(walletId?: string): string | null {
    if (!this.wallet) return null

    // 如果指定了walletId，检查是否匹配
    if (walletId && this.wallet.id !== walletId) return null

    const mnemonic = this.wallet.mnemonic || null
    console.log(
      `🔍 获取钱包 ${walletId || 'current'} 的助记词:`,
      mnemonic ? '存在' : '不存在',
      mnemonic?.substring(0, 20) + '...'
    )
    return mnemonic
  }

  // 获取签名钱包
  getSigningWallet(
    walletId?: string
  ): Secp256k1HdWallet | DirectSecp256k1HdWallet | null {
    if (!this.wallet) return null

    // 如果指定了walletId，检查是否匹配
    if (walletId && this.wallet.id !== walletId) return null

    return this.modernWallet || this.signingWallet || null
  }

  // 获取现代钱包（推荐使用）
  getModernWallet(walletId?: string): DirectSecp256k1HdWallet | null {
    if (!this.wallet) return null

    // 如果指定了walletId，检查是否匹配
    if (walletId && this.wallet.id !== walletId) return null

    return this.modernWallet || null
  }

  // 删除钱包（单钱包模式）
  async deleteWallet(walletId?: string): Promise<boolean> {
    if (!this.wallet) return false

    // 如果指定了walletId，检查是否匹配
    if (walletId && this.wallet.id !== walletId) return false

    this.wallet = null
    this.signingWallet = null
    this.modernWallet = null

    await this.saveWalletsToStorage()
    console.log(`🗑️ 钱包已删除`)
    return true
  }

  // 重命名钱包
  async renameWallet(walletId: string, newName: string): Promise<boolean> {
    if (!this.wallet || this.wallet.id !== walletId) return false

    this.wallet.name = newName
    await this.saveWalletsToStorage()
    console.log(`✏️ 钱包已重命名: ${walletId} -> ${newName}`)
    return true
  }

  // 验证助记词
  validateMnemonic(mnemonic: string): boolean {
    return validateMnemonic(mnemonic)
  }

  // 生成助记词
  generateMnemonic(): string {
    return generateMnemonic(256)
  }

  // 签名数据
  async signData(): Promise<Uint8Array> {
    // 客户端没有utxo，签名了也没用
  }

  // 生成钱包ID
  private generateWalletId(): string {
    return (
      'wallet_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    )
  }

  // 从助记词派生多个账户
  async deriveAccountsFromMnemonic(
    mnemonic: string,
    count: number = 1
  ): Promise<AccountInfo[]> {
    const accounts: AccountInfo[] = []

    for (let i = 0; i < count; i++) {
      try {
        // 使用CosmJS创建指定索引的钱包
        const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
          prefix: this.prefix,
          hdPaths: [makeCosmoshubPath(i)] // Cosmos标准派生路径
        })

        const walletAccounts = await wallet.getAccounts()
        if (walletAccounts.length > 0) {
          const account = walletAccounts[0]

          accounts.push({
            index: i,
            address: this.formatAddress(account.address),
            publicKey: toHex(account.pubkey),
            derivationPath: `m/44'/118'/0'/0/${i}`
          })
        }
      } catch (error) {
        throw new Error(error)
      }
    }

    return accounts
  }

  // 为现有钱包添加新账户
  async addAccountToWallet(
    walletId?: string,
    accountIndex?: number
  ): Promise<AccountInfo> {
    if (!this.wallet || (walletId && this.wallet.id !== walletId)) {
      throw new Error('钱包不存在')
    }

    if (!this.wallet.mnemonic) {
      throw new Error('钱包无助记词，无法派生新账户')
    }

    // 确定新账户的索引
    const newIndex =
      accountIndex ??
      Math.max(0, ...this.wallet.accounts.map((a) => a.index)) + 1

    // 检查账户是否已存在
    if (this.wallet.accounts.some((a) => a.index === newIndex)) {
      throw new Error(`账户索引 ${newIndex} 已存在`)
    }

    // 派生新账户
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(
      this.wallet.mnemonic,
      {
        prefix: this.prefix,
        hdPaths: [makeCosmoshubPath(newIndex)]
      }
    )

    const accounts = await wallet.getAccounts()
    if (accounts.length === 0) {
      throw new Error('无法派生新账户')
    }

    const newAccount: AccountInfo = {
      index: newIndex,
      address: this.formatAddress(accounts[0].address),
      publicKey: toHex(accounts[0].pubkey),
      derivationPath: `m/44'/118'/0'/0/${newIndex}`
    }

    // 添加到钱包
    this.wallet.accounts.push(newAccount)
    this.wallet.accounts.sort((a, b) => a.index - b.index)

    // 保存更新
    await this.saveWalletsToStorage()

    console.log(
      `✅ 为钱包 ${this.wallet.name} 添加了新账户: ${newAccount.address}`
    )

    return newAccount
  }

  // 验证地址格式
  private isValidCosmosAddress(address: string): boolean {
    // 自定义地址格式：ox + 37字符，总长度39
    const cosmosPattern = /^ox[0-9a-z]{37}$/
    return cosmosPattern.test(address) && address.length === 39
  }

  // 格式化地址确保符合标准
  private formatAddress(address: string): string {
    console.log(address)
    if (!address) {
      throw new Error('地址不能为空')
    }

    // 如果地址已经是正确格式，直接返回
    if (this.isValidCosmosAddress(address)) {
      return address
    }

    // 如果地址过短，说明可能被截断了
    if (address.length > 39) {
      console.warn(`⚠️ 地址长度不正确: ${address.length}, 期望: 39`)
      console.log(address.substring(0, 39))
      return address.substring(0, 39)
    }

    return address
  }

  // 本地生成标准Cosmos地址（纯客户端实现）
  generateLocalCosmosAddress(name: string): string {
    const entropy = Date.now() + Math.random() + name.length
    const hash = this.simpleHash(entropy.toString())

    // 取前37个字符作为地址数据部分，匹配ox地址格式
    const addressData = hash.substring(0, 37).toLowerCase()

    return 'ox' + addressData
  }

  // 简单的哈希实现（用于地址生成）
  private simpleHash(data: string): string {
    // 这是一个非常简化的哈希实现，实际应用中应该使用crypto库
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

  // 保存钱包到本地存储（单钱包模式）
  private async saveWalletsToStorage(password?: string): Promise<void> {
    try {
      if (!this.wallet) {
        localStorage.removeItem(CosmosWalletManager.STORAGE_KEY)
        console.log('💾 钱包已清空')
        return
      }

      const walletData = { ...this.wallet }

      // 如果设置了密码且钱包需要加密，则加密敏感数据
      if (password && this.wallet.isEncrypted) {
        if (this.wallet.mnemonic) {
          walletData.mnemonic = this.encryptData(this.wallet.mnemonic, password)
        }
      }
      // 如果没有加密，保留明文助记词（用于开发和测试）
      // 生产环境中应该总是加密敏感数据

      localStorage.setItem(
        CosmosWalletManager.STORAGE_KEY,
        JSON.stringify(walletData)
      )
      console.log('💾 钱包数据已保存到本地存储')
    } catch (error) {
      console.error('❌ 保存钱包失败:', error)
      throw new Error('保存钱包失败')
    }
  }

  // 从本地存储加载钱包（单钱包模式）
  private async loadWalletsFromStorage(): Promise<void> {
    try {
      // 尝试加载新版本的存储格式
      let walletData = localStorage.getItem(CosmosWalletManager.STORAGE_KEY)

      // 如果没有新版本，尝试加载旧版本并迁移
      if (!walletData) {
        const oldWalletsData = localStorage.getItem('cosmos_wallets')
        if (oldWalletsData) {
          console.log('📦 检测到旧版本钱包数据，将自动迁移到单钱包模式')
          try {
            const entries = JSON.parse(oldWalletsData)
            if (entries.length > 0) {
              // 取第一个钱包作为主钱包
              const [, firstWallet] = entries[0]
              walletData = JSON.stringify(firstWallet)
              console.log('✅ 已将第一个钱包设为主钱包')
            }
          } catch (e) {
            console.warn('旧数据迁移失败:', e)
          }
        }
      }

      if (!walletData) {
        console.log('📂 没有找到钱包数据')
        return
      }

      const wallet = JSON.parse(walletData)

      // 迁移旧版本数据结构
      if (!wallet.createdAt) {
        wallet.createdAt = Date.now()
        wallet.type = wallet.type || 'mnemonic'
        wallet.isEncrypted = false
        wallet.backupConfirmed = false
      }

      // 重建钱包信息（不包含敏感数据的解密，需要密码时再解密）
      this.wallet = wallet

      // 注意：这里不重建签名钱包，因为可能需要密码解密
      // 签名钱包将在需要时通过unlockWallet方法创建

      console.log('📂 从本地存储加载了钱包:', this.wallet?.name || '未知钱包')

      // 保存新格式并清理旧数据
      if (localStorage.getItem('cosmos_wallets')) {
        await this.saveWalletsToStorage()
        localStorage.removeItem('cosmos_wallets')
        console.log('✅ 钱包数据已迁移到新格式')
      }
    } catch (error) {
      console.error('❌ 加载钱包失败:', error)
    }
  }

  // 解锁钱包（用于使用加密的钱包）
  async unlockWallet(
    walletId?: string,
    password?: string
  ): Promise<DirectSecp256k1HdWallet | Secp256k1HdWallet> {
    if (!this.wallet || (walletId && this.wallet.id !== walletId)) {
      throw new Error('钱包不存在')
    }

    let mnemonic = this.wallet.mnemonic

    // 如果钱包是加密的，需要解密
    if (this.wallet.isEncrypted && password) {
      if (!this.verifyEncryptionPassword(password)) {
        throw new Error('密码错误')
      }

      if (mnemonic) {
        mnemonic = this.decryptData(mnemonic, password)
      }
    }

    if (!mnemonic) {
      throw new Error('无法获取钱包凭据')
    }

    // 创建签名钱包
    let signingWallet: DirectSecp256k1HdWallet | Secp256k1HdWallet

    if (mnemonic) {
      signingWallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
        prefix: this.prefix
      })
      this.modernWallet = signingWallet
    } else {
      throw new Error('暂不支持仅从私钥创建签名钱包')
    }

    // 更新最后使用时间
    this.wallet.lastUsed = Date.now()
    await this.saveWalletsToStorage(password)

    return signingWallet
  }

  // 确认钱包备份
  confirmBackup(walletId?: string): void {
    if (!this.wallet || (walletId && this.wallet.id !== walletId)) return

    this.wallet.backupConfirmed = true
    this.saveWalletsToStorage()
    console.log(`✅ 钱包备份已确认`)
  }

  // 检查是否需要提醒备份
  shouldRemindBackup(walletId?: string): boolean {
    if (!this.wallet || (walletId && this.wallet.id !== walletId)) return false

    // 如果未确认备份且创建超过1天
    const daysSinceCreation =
      (Date.now() - this.wallet.createdAt) / (1000 * 60 * 60 * 24)
    return !this.wallet.backupConfirmed && daysSinceCreation > 1
  }

  // 清空钱包（危险操作）
  clearAllWallets(): void {
    this.wallet = null
    this.signingWallet = null
    this.modernWallet = null
    localStorage.removeItem(CosmosWalletManager.STORAGE_KEY)
    localStorage.removeItem('cosmos_wallets') // 清理旧版本
    localStorage.removeItem(CosmosWalletManager.ENCRYPTION_KEY)
    console.log('🗑️ 钱包已清空')
  }

  // 导出钱包为JSON
  async exportWalletAsJSON(
    walletId?: string,
    password?: string
  ): Promise<string> {
    if (!this.wallet || (walletId && this.wallet.id !== walletId)) {
      throw new Error('钱包不存在')
    }

    const backupData: WalletBackupData = {
      name: this.wallet.name,
      address: this.wallet.address,
      createdAt: this.wallet.createdAt,
      version: '2.0.0'
    }

    if (password && this.encryptionPassword) {
      // 加密导出
      const sensitiveData = {
        mnemonic: this.wallet.mnemonic
      }

      backupData.encrypted = true
      backupData.encryptedData = this.encryptData(
        JSON.stringify(sensitiveData),
        password
      )
    } else {
      // 明文导出（不推荐）
      backupData.mnemonic = this.wallet.mnemonic
    }

    return JSON.stringify(backupData, null, 2)
  }

  // 导出钱包（返回助记词）
  exportWallet(walletId?: string): {
    name: string
    address: string
    mnemonic?: string
  } | null {
    if (!this.wallet || (walletId && this.wallet.id !== walletId)) return null

    return {
      name: this.wallet.name,
      address: this.wallet.address,
      mnemonic: this.wallet.mnemonic
    }
  }

  // 获取统计信息
  getStats(): {
    totalWallets: number
    unlockedWallets: number
    addresses: string[]
    totalAccounts: number
  } {
    if (!this.wallet) {
      return {
        totalWallets: 0,
        unlockedWallets: 0,
        addresses: [],
        totalAccounts: 0
      }
    }

    return {
      totalWallets: 1,
      unlockedWallets: this.wallet.isLocked ? 0 : 1,
      addresses: this.wallet.accounts.map((account) => account.address),
      totalAccounts: this.wallet.accounts.length
    }
  }
}

// 单例实例
export const walletManager = new CosmosWalletManager()
