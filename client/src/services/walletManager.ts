/** @format */

// 增强版Cosmos钱包管理器
import { generateMnemonic } from 'bip39'
import {
  DirectSecp256k1HdWallet,
  makeCosmoshubPath
} from '@cosmjs/proto-signing'
import { toHex } from '@cosmjs/encoding'

export interface AccountInfo {
  index: number
  address: string
  publicKey: string
  balance?: string
}

export interface WalletInfo {
  id: string
  name: string
  address: string // 主账户地址（索引0）
  mnemonic?: string // 可选，用于导出
  publicKey: string // 主账户公钥
  accounts: AccountInfo[] // 多个派生账户
  createdAt: number
  lastUsed?: number
  backupConfirmed?: boolean
}

export interface CreateWalletOptions {
  name?: string
  mnemonic?: string // 可选，用于导入现有钱包
  password?: string // 可选，用于加密存储
  strength?: 128 | 256 // 助记词强度
}

export class CosmosWalletManager {
  private wallet: WalletInfo | null = null
  private readonly prefix = 'Ox'
  private encryptionPassword: string | null = null
  private static readonly STORAGE_KEY = 'my_blockchian_v1'
  private static readonly ENCRYPTION_KEY = 'wallet_encryption_key'

  constructor() {
    this.loadWalletsFromStorage()
  }

  // 生成钱包
  async createWallet(options: CreateWalletOptions): Promise<WalletInfo> {
    const walletName = options.name || '我的钱包'
    console.log(`🔑 创建新钱包: ${walletName}`)
    const mnemonic = options.mnemonic || ''
    if (!mnemonic) {
      throw new Error('操作错误，没有生成助记词')
    }

    // 从助记词创建钱包
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
      prefix: this.prefix,
      hdPaths: [makeCosmoshubPath(0)]
    })
    // 获取第一个账号
    const accounts = await wallet.getAccounts()
    if (accounts.length === 0) {
      throw new Error('无法从助记词生成账户')
    }

    // 格式化地址化成ox开头
    const address = this.formatAddress(accounts[0].address)
    accounts[0].address = address
    const publicKey = toHex(accounts[0].pubkey)
    const walletId = this.generateWalletId()
    const now = Date.now()

    const walletInfo: WalletInfo = {
      id: walletId,
      name: walletName,
      address, // 主账户地址（索引0）
      accounts,
      mnemonic,
      publicKey,
      createdAt: now,
      backupConfirmed: false
    }

    // 存储钱包信息
    this.wallet = walletInfo

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

  // 为现有钱包添加新账户
  async addAccountToWallet(): Promise<AccountInfo> {
    const newIndex = this.wallet.accounts.length

    // 根据已有的助记词生成钱包
    // 派生路径（derivation path/hdPaths）: 44' → BIP44 协议
    //118' → Cosmos 的 coin type（以太坊是 60'，比特币是 0'）account index
    //0 → change（一般 0 表示外部地址，1 表示找零地址）
    //0 → address index
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
      publicKey: toHex(accounts[0].pubkey)
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

  // 获取钱包
  getWallet(): WalletInfo {
    if (!this.wallet) return {}

    return {
      ...this.wallet,
      mnemonic: undefined // 不在列表中暴露助记词
    }
  }

  // 获取钱包的助记词
  getWalletMnemonic(): string | null {
    return this.wallet.mnemonic || null
  }

  // 删除钱包（单钱包模式）
  async deleteWallet(): Promise<boolean> {
    this.wallet = null

    await this.saveWalletsToStorage()
    console.log(`🗑️ 钱包已删除`)
    return true
  }

  // 生成助记词
  generateMnemonic(): string {
    return generateMnemonic(256)
  }

  // 生成钱包ID
  private generateWalletId(): string {
    return (
      'wallet_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    )
  }

  // 格式化地址,39位
  private formatAddress(address: string): string {
    console.log(address)
    if (!address) {
      throw new Error('地址不能为空')
    }
    return address.substring(0, 39)
    return address
  }

  // 保存钱包到本地存储
  private async saveWalletsToStorage(): Promise<void> {
    try {
      if (!this.wallet) {
        localStorage.removeItem(CosmosWalletManager.STORAGE_KEY)
        console.log('💾 钱包已清空')
        return
      }

      const walletData = { ...this.wallet }
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
      const walletData = localStorage.getItem(CosmosWalletManager.STORAGE_KEY)

      if (!walletData) {
        console.log('📂 没有找到钱包数据')
        return
      }
      const wallet = JSON.parse(walletData)
      // 重建钱包信息（不包含敏感数据的解密，需要密码时再解密）
      this.wallet = wallet

      console.log('📂 从本地存储加载了钱包:', this.wallet?.name || '未知钱包')
    } catch (error) {
      console.error('❌ 加载钱包失败:', error)
    }
  }

  // 导出钱包（返回助记词）
  exportWallet(): {
    name: string
    address: string
    mnemonic?: string
  } | null {
    return {
      name: this.wallet.name,
      address: this.wallet.address,
      mnemonic: this.wallet.mnemonic
    }
  }
}

// 单例实例
export const walletManager = new CosmosWalletManager()
