/** @format */

import React, { useState, useEffect } from 'react'
import { Wallet, Globe, Database, Activity, Send, Pickaxe } from 'lucide-react'
import { CosmosClientService } from './services/cosmosClient'
import { walletManager, type WalletInfo } from './services/walletManager'
import TransactionForm from './components/TransactionForm'
import NetworkStatus from './components/NetworkStatus'
import BlockExplorer from './components/BlockExplorer'
import WalletManager from './components/WalletManager'
import MiningManager from './components/MiningManager'

type TabType = 'wallet' | 'transactions' | 'mining' | 'blocks' | 'network'

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('wallet')
  const [cosmosClient] = useState(() => new CosmosClientService())
  const [isConnected, setIsConnected] = useState(false)
  const [currentWallet, setCurrentWallet] = useState<WalletInfo | null>(null)

  const connectToNetwork = async () => {
    setIsConnecting(true)
    try {
      const result = await cosmosClient.connect()
      setIsConnected(result.success)
    } catch (error) {
      console.error('连接失败:', error)
      setIsConnected(false)
    } finally {
      setIsConnecting(false)
    }
  }

  const loadCurrentWallet = async () => {
    try {
      const wallets = walletManager.getWalletList()
      const lastUsedWallet = wallets.find((w) => w.lastUsed)
      if (lastUsedWallet) {
        setCurrentWallet(lastUsedWallet)
        await cosmosClient.setActiveAddress(lastUsedWallet.address)
      }
    } catch (error) {
      console.error('加载当前钱包失败:', error)
    }
  }

  const handleWalletChange = (wallet: WalletInfo | null) => {
    setCurrentWallet(wallet)
  }

  useEffect(() => {
    connectToNetwork()
    loadCurrentWallet()
  }, [])

  const tabs = [
    { id: 'wallet' as TabType, label: '钱包管理', icon: Wallet },
    { id: 'transactions' as TabType, label: '发送交易', icon: Send },
    { id: 'mining' as TabType, label: '挖矿控制', icon: Pickaxe },
    { id: 'blocks' as TabType, label: '区块浏览器', icon: Database },
    { id: 'network' as TabType, label: '网络状态', icon: Globe }
  ]

  const renderContent = () => {
    switch (activeTab) {
      case 'wallet':
        return (
          <WalletManager
            cosmosClient={cosmosClient}
            onWalletChange={handleWalletChange}
          />
        )
      case 'transactions':
        return (
          <TransactionForm
            cosmosClient={cosmosClient}
            currentWallet={currentWallet}
            isConnected={isConnected}
            onTransactionSuccess={() => {}}
          />
        )
      case 'mining':
        return <MiningManager />
      case 'network':
        return (
          <NetworkStatus
            cosmosClient={cosmosClient}
            isConnected={isConnected}
          />
        )
      case 'blocks':
        return (
          <BlockExplorer
            cosmosClient={cosmosClient}
            isConnected={isConnected}
          />
        )
      default:
        return null
    }
  }

  const activeTabInfo = tabs.find((tab) => tab.id === activeTab)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-br from-cosmos-500 via-blockchain-500 to-purple-600 w-12 h-12 rounded-lg flex items-center justify-center shadow-md">
                <Activity className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gradient">我的区块链</h1>
              </div>
            </div>

            <nav className="hidden md:flex items-center space-x-2">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-cosmos-500 text-white shadow-md'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </nav>

            <div
              className={`inline-flex items-center px-3 py-2 rounded-full text-xs font-bold shadow-md ${
                isConnected
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full mr-2 ${
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                } ${isConnected ? 'animate-pulse' : ''}`}
              />
              {isConnected ? '已连接' : '未连接'}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          <div className="flex items-center space-x-4">
            <div className="bg-white shadow-md w-14 h-14 rounded-xl flex items-center justify-center text-cosmos-500 border border-gray-200">
              {activeTabInfo && <activeTabInfo.icon size={28} />}
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-800">
                {activeTabInfo?.label}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {activeTab === 'wallet' && '创建或管理您的钱包和查看账户余额'}
                {activeTab === 'transactions' && '发送加密货币交易'}
                {activeTab === 'mining' && '控制区块链挖矿和查看统计'}
                {activeTab === 'blocks' && '浏览区块链数据'}
                {activeTab === 'network' && '查看网络连接状态'}
              </p>
            </div>
          </div>

          <div className="bg-white shadow-lg rounded-2xl border border-gray-200/50 p-6 md:p-8">
            {renderContent()}
          </div>
        </div>
      </main>

      <footer className="mt-16 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-sm text-gray-500">Cosmos 钱包 - Gemini AI</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
