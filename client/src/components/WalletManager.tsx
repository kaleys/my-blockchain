/** @format */

import React, { useState, useEffect } from 'react'
import {
  Wallet,
  Key,
  RefreshCw,
  Plus,
  Users,
  Eye,
  EyeOff,
  Copy,
  Download,
  FileText,
  AlertTriangle,
  Trash2,
  DollarSign
} from 'lucide-react'
import type { CosmosClientService } from '../services/cosmosClient'
import { walletManager, type WalletInfo } from '../services/walletManager'

// Props definition
interface WalletManagerProps {
  cosmosClient: CosmosClientService
  onWalletChange: (wallet: WalletInfo | null) => void
}

const WalletManager: React.FC<WalletManagerProps> = ({
  cosmosClient,
  onWalletChange
}) => {
  const [wallet, setWallet] = useState<WalletInfo | null>(null)
  const [currentAccount, setCurrentAccount] = useState<number>(0)
  const [isCreating, setIsCreating] = useState(false)
  const [isAddingAccount, setIsAddingAccount] = useState(false)
  const [showMnemonic, setShowMnemonic] = useState<{ [key: string]: boolean }>(
    {}
  )
  const [expandedWallets, setExpandedWallets] = useState<Set<string>>(new Set())
  const [accountBalances, setAccountBalances] = useState<{
    [key: string]: string
  }>({})
  const [loadingBalance, setLoadingBalance] = useState<string | null>(null)

  const [creationStep, setCreationStep] = useState<'idle' | 'confirming'>(
    'idle'
  )
  const [pendingMnemonic, setPendingMnemonic] = useState<string | null>(null)

  const [status, setStatus] = useState<{
    type: 'success' | 'error' | 'info' | 'warning' | null
    message: string
  }>({ type: null, message: '' })

  const loadWallet = async () => {
    try {
      const list = walletManager.getWalletList()
      if (list.length > 0) {
        const mainWallet = list[0]
        setWallet(mainWallet)
        onWalletChange(mainWallet)
      } else {
        setWallet(null)
        onWalletChange(null)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const activateAccount = async (accountIndex: number) => {
    try {
      if (!wallet) throw new Error('没有钱包可用')
      const account = wallet.accounts[accountIndex]
      if (!account) throw new Error('账户不存在')

      await cosmosClient.setActiveAddress(account.address)
      setCurrentAccount(accountIndex)
      const updatedWallet = { ...wallet, address: account.address }
      onWalletChange(updatedWallet)
      setStatus({
        type: 'success',
        message: `账户已激活: ${account.address.substring(0, 12)}...`
      })
    } catch (e) {
      setStatus({
        type: 'error',
        message: e instanceof Error ? e.message : '激活账户失败'
      })
    }
  }

  const handleStartCreation = () => {
    // 检查是否已有钱包
    if (wallet) {
      setStatus({
        type: 'warning',
        message:
          '已有钱包存在。当前为单钱包模式，如需创建新钱包请先删除现有钱包。'
      })
      return
    }

    const newMnemonic = walletManager.generateMnemonic()
    setPendingMnemonic(newMnemonic)
    setCreationStep('confirming')
    setStatus({
      type: 'info',
      message: '请安全地备份您的助记词。'
    })
  }

  const handleCancelCreation = () => {
    setPendingMnemonic(null)
    setCreationStep('idle')
    setStatus({ type: null, message: '' })
  }

  const handleConfirmCreation = async () => {
    if (!pendingMnemonic) {
      setStatus({ type: 'error', message: '没有可用的助记词' })
      return
    }

    setIsCreating(true)
    try {
      const walletInfo = await walletManager.createWallet({
        mnemonic: pendingMnemonic,
        type: 'mnemonic',
        strength: 256
      })

      setStatus({
        type: 'success',
        message: `钱包创建成功！`
      })

      setPendingMnemonic(null)
      setCreationStep('idle')
      await loadWallet()

      if (walletInfo.accounts.length > 0) {
        setCurrentAccount(0)
        await cosmosClient.setActiveAddress(walletInfo.accounts[0].address)
        onWalletChange(walletInfo)
      }
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : '创建钱包失败'
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleAddAccount = async () => {
    if (!wallet) {
      setStatus({ type: 'error', message: '没有可用的钱包' })
      return
    }
    setIsAddingAccount(true)
    try {
      const newAccount = await walletManager.addAccountToWallet()
      setStatus({
        type: 'success',
        message: `新账户 ${
          newAccount.index
        } 添加成功: ${newAccount.address.substring(0, 12)}...`
      })
      await loadWallet() // Refresh wallet state
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : '添加账户失败'
      })
    } finally {
      setIsAddingAccount(false)
    }
  }

  const exportWallet = async (walletId: string) => {
    try {
      const backupData = walletManager.exportWallet(walletId)
      if (!backupData) {
        throw new Error('钱包不存在或无法导出')
      }
      const dataStr = JSON.stringify(backupData, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `cosmos-wallet-backup.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      setStatus({ type: 'success', message: '钱包备份文件已下载' })
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : '导出钱包失败'
      })
    }
  }

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setStatus({ type: 'success', message: `${label}已复制到剪贴板` })
      setTimeout(() => setStatus({ type: null, message: '' }), 2000)
    } catch {
      setStatus({ type: 'error', message: '复制失败' })
    }
  }

  const toggleMnemonicVisibility = (walletId: string) => {
    setShowMnemonic((prev) => ({ ...prev, [walletId]: !prev[walletId] }))
  }

  const toggleWalletExpansion = (walletId: string) => {
    setExpandedWallets((prev) => {
      const next = new Set(prev)
      if (next.has(walletId)) {
        next.delete(walletId)
      } else {
        next.add(walletId)
      }
      return next
    })
  }

  const getWalletMnemonic = (walletId: string): string | null => {
    return walletManager.getWalletMnemonic(walletId)
  }

  // 获取账户余额
  const fetchAccountBalance = async (address: string) => {
    setLoadingBalance(address)
    try {
      const result = await cosmosClient.getBalance(address)
      if (result.success && result.data) {
        const amount = result.data.amount || '0'
        const balance = amount // 转换为 TOKEN 单位
        setAccountBalances((prev) => ({ ...prev, [address]: balance }))
      } else {
        setAccountBalances((prev) => ({ ...prev, [address]: '0.00000000' }))
      }
    } catch {
      setAccountBalances((prev) => ({ ...prev, [address]: '0.00000000' }))
    } finally {
      setLoadingBalance(null)
    }
  }

  const handleDeleteWallet = async () => {
    if (!wallet) return

    const confirmed = window.confirm(
      `确定要删除钱包 "${wallet.name}" 吗？这将删除钱包及其所有账户。请确保您已备份助记词。`
    )
    if (!confirmed) return

    try {
      const success = await walletManager.deleteWallet(wallet.id)
      if (success) {
        setStatus({
          type: 'success',
          message: '钱包已删除'
        })
        await loadWallet()
        setCurrentAccount(0)
        onWalletChange(null)
      } else {
        throw new Error('删除钱包失败')
      }
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : '删除钱包失败'
      })
    }
  }

  useEffect(() => {
    loadWallet()
  }, [])

  useEffect(() => {
    if (status.type && status.type !== 'info') {
      const timer = setTimeout(
        () => setStatus({ type: null, message: '' }),
        5000
      )
      return () => clearTimeout(timer)
    }
  }, [status])

  return (
    <div className="space-y-8">
      {status.type && (
        <div
          className={`rounded-2xl p-4 border ${
            status.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : status.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : status.type === 'warning'
              ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          <p className="font-medium">{status.message}</p>
        </div>
      )}

      <div className="">
        {wallet ? (
          <div className="space-y-6">
            <div className="group border border-gray-200 rounded-2xl overflow-hidden">
              <div className="p-5 bg-gray-50/50">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-lg truncate flex items-center text-gray-900">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mr-3 bg-gradient-to-br from-cosmos-500 to-blockchain-500 text-white">
                      <Wallet className="w-5 h-5" />
                    </div>
                    {wallet.name}
                  </h4>
                  <div className="flex items-center space-x-2">
                    <div
                      className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50"
                      title="当前激活"
                    ></div>
                    <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded-full">
                      活跃
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-sm font-semibold text-gray-700 flex items-center">
                    <Users className="w-4 h-4 mr-2 text-cosmos-500" />
                    账户管理 ({wallet.accounts.length} 个账户)
                  </h5>
                  <button
                    onClick={handleAddAccount}
                    disabled={isAddingAccount}
                    className="btn-primary text-xs px-3 py-1.5 flex items-center"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    {isAddingAccount ? '生成中...' : '新增账户'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  单钱包多账户模式：一个助记词可以生成多个账户地址
                </p>
                <div className="space-y-2">
                  {wallet.accounts.map((account, index) => (
                    <div
                      key={account.index}
                      className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                        currentAccount === index
                          ? 'border-cosmos-300 bg-cosmos-50'
                          : 'border-gray-200 bg-white hover:border-cosmos-200 hover:bg-cosmos-50/50'
                      }`}
                      onClick={() => activateAccount(index)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium text-gray-900">
                              账户 {account.index}
                            </p>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  copyToClipboard(account.address, '地址')
                                }}
                                className="text-xs text-gray-600 hover:text-gray-700 flex items-center"
                                title="复制地址"
                              >
                                <Copy className="w-3 h-3 mr-1" />
                                复制
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  fetchAccountBalance(account.address)
                                }}
                                className="text-xs text-cosmos-600 hover:text-cosmos-700 flex items-center"
                                disabled={loadingBalance === account.address}
                              >
                                <DollarSign className="w-3 h-3 mr-1" />
                                {loadingBalance === account.address ? (
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : (
                                  '查看余额'
                                )}
                              </button>
                            </div>
                          </div>
                          <p className="text-xs font-mono text-gray-600 truncate">
                            {account.address}
                          </p>
                          {accountBalances[account.address] && (
                            <p className="text-xs font-semibold text-green-600 mt-1">
                              余额: {accountBalances[account.address]} TOKEN
                            </p>
                          )}
                        </div>
                        {currentAccount === index && (
                          <div className="ml-3 w-2 h-2 bg-cosmos-500 rounded-full animate-pulse"></div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-200/50 px-5 py-3 bg-gray-50/50">
                <div className="flex items-center justify-between">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleWalletExpansion(wallet.id)
                    }}
                    className="btn-secondary text-xs px-3 py-1.5 flex items-center"
                  >
                    <FileText className="w-3 h-3 mr-1" />
                    {expandedWallets.has(wallet.id) ? '隐藏详情' : '查看详情'}
                  </button>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        exportWallet(wallet.id)
                      }}
                      className="btn-secondary text-xs px-3 py-1.5 flex items-center"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      导出
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteWallet()
                      }}
                      className="text-xs px-3 py-1.5 bg-red-50 border border-red-200 text-red-700 rounded-lg hover:bg-red-100 hover:border-red-300 transition-colors flex items-center"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      删除
                    </button>
                  </div>
                </div>
              </div>

              {expandedWallets.has(wallet.id) &&
                (() => {
                  const mnemonic = getWalletMnemonic(wallet.id)
                  const showMnemonicText = showMnemonic[wallet.id] || false
                  return (
                    <div className="border-t border-gray-200/50 bg-gray-50 p-5 space-y-4">
                      {mnemonic && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-semibold text-gray-700 flex items-center">
                              <Key className="w-4 h-4 mr-2 text-cosmos-500" />
                              助记词 (请妥善保管)
                            </label>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() =>
                                  toggleMnemonicVisibility(wallet.id)
                                }
                                className="text-xs text-cosmos-600 hover:text-cosmos-700 flex items-center"
                              >
                                {showMnemonicText ? (
                                  <EyeOff className="w-3 h-3 mr-1" />
                                ) : (
                                  <Eye className="w-3 h-3 mr-1" />
                                )}
                                {showMnemonicText ? '隐藏' : '显示'}
                              </button>
                              {showMnemonicText && (
                                <button
                                  onClick={() =>
                                    copyToClipboard(mnemonic, '助记词')
                                  }
                                  className="text-xs text-cosmos-600 hover:text-cosmos-700 flex items-center"
                                >
                                  <Copy className="w-3 h-3 mr-1" />
                                  复制
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="bg-white p-3 rounded-lg border border-gray-200">
                            {showMnemonicText ? (
                              <p className="text-sm font-mono text-gray-800 leading-relaxed">
                                {mnemonic}
                              </p>
                            ) : (
                              <p className="text-sm text-gray-500 font-mono">
                                •••••••••
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}
            </div>
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="relative mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-gray-200 to-gray-300 rounded-3xl flex items-center justify-center mx-auto">
                <Key className="w-10 h-10 text-gray-400" />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <Plus className="w-4 h-4 text-gray-400" />
              </div>
            </div>
            <p className="text-gray-600 font-semibold text-lg mb-2">
              还没有钱包
            </p>
            <p className="text-sm text-gray-500">请在下方创建您的第一个钱包</p>
          </div>
        )}
      </div>

      {!wallet && (
        <div className="group border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200/50 bg-gray-50">
            <h3 className="text-xl font-bold flex items-center text-gray-800">
              <div className="w-8 h-8 bg-gradient-to-br from-blockchain-500 to-cosmos-500 rounded-lg flex items-center justify-center mr-3">
                <Plus className="w-4 h-4 text-white" />
              </div>
              创建钱包
            </h3>
          </div>
          <div className="p-6 space-y-6">
            {creationStep === 'idle' && (
              <>
                <button
                  onClick={handleStartCreation}
                  disabled={isCreating || !!wallet}
                  className="btn-primary w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  创建新钱包
                </button>
              </>
            )}

            {creationStep === 'confirming' && pendingMnemonic && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    您的助记词 (Seed Phrase)
                  </label>
                  <div className="bg-white p-4 rounded-lg border border-gray-200 font-mono text-gray-800 leading-relaxed">
                    {pendingMnemonic}
                  </div>
                </div>
                <div className="flex items-start mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mr-3 flex-shrink-0" />
                  <p className="text-sm text-yellow-800">
                    <strong>请立即备份!</strong>{' '}
                    这是恢复钱包的唯一凭证。请勿泄露给任何人。
                  </p>
                </div>
                <div className="flex justify-end space-x-4 pt-4">
                  <button
                    onClick={handleCancelCreation}
                    className="btn-secondary"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleConfirmCreation}
                    disabled={isCreating}
                    className="btn-primary"
                  >
                    {isCreating ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        创建中...
                      </>
                    ) : (
                      '我已备份，确认创建'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default WalletManager
