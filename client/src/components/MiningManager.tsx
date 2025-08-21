/** @format */

import React, { useState, useEffect } from 'react'
import {
  Zap,
  Play,
  Square,
  TrendingUp,
  Cpu,
  Timer,
  Award,
  BarChart3,
  RefreshCw,
  Pickaxe,
  Settings,
  Send
} from 'lucide-react'
import MinerTransfer from './MinerTransfer'

interface MinerInfo {
  address: string | null
  name: string
  isInitialized: boolean
  hasPrivateKey: boolean
  hasPublicKey: boolean
}

interface MiningStats {
  blocksMinedTotal: number
  hashesComputed: number
  currentHashRate: number
  lastBlockMined: any
  totalRewards: number
  startTime: number | null
  currentNonce: number
  miningDuration: number
}

interface BlockchainInfo {
  height: number
  difficulty: number
  mempoolSize: number
}

interface MiningStatus {
  isMining: boolean
  minerInfo: MinerInfo
  stats: MiningStats
  blockchain: BlockchainInfo
}
const rpcAddress = import.meta.env.VITE_RPC_ENDPOINT || 'http://localhost:1317'

type MiningTabType = 'mining' | 'transfer'

const MiningManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MiningTabType>('mining')
  const [miningStatus, setMiningStatus] = useState<MiningStatus | null>(null)
  const [minerBalance, setMinerBalance] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<{
    type: 'success' | 'error' | 'info' | 'warning' | null
    message: string
  }>({ type: null, message: '' })

  // 获取挖矿状态
  const fetchMiningStatus = async () => {
    try {
      const response = await fetch(`${rpcAddress}/api/mining/status`)
      const result = await response.json()

      if (result.success) {
        setMiningStatus(result.data)
        // 获取矿工余额
        if (result.data.minerInfo.address) {
          await fetchMinerBalance(result.data.minerInfo.address)
        }
      } else {
        throw new Error(result.error || '获取挖矿状态失败')
      }
    } catch (error) {
      console.error('获取挖矿状态失败:', error)
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : '获取挖矿状态失败'
      })
    }
  }

  // 获取矿工余额
  const fetchMinerBalance = async (address: string) => {
    try {
      const response = await fetch(
        `${rpcAddress}/api/addresses/${address}/balance`
      )
      const result = await response.json()

      if (result.success) {
        const balance = parseInt(result.data.amount) || 0
        setMinerBalance(balance)
      }
    } catch (error) {
      console.error('获取矿工余额失败:', error)
    }
  }

  // 开始挖矿
  const startMining = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`${rpcAddress}/api/mining/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const result = await response.json()

      if (result.success) {
        setStatus({
          type: 'success',
          message: '挖矿已开始！'
        })
        await fetchMiningStatus()
      } else {
        throw new Error(result.error || '开始挖矿失败')
      }
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : '开始挖矿失败'
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 停止挖矿
  const stopMining = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`${rpcAddress}/api/mining/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const result = await response.json()

      if (result.success) {
        setStatus({
          type: 'success',
          message: '挖矿已停止'
        })
        await fetchMiningStatus()
      } else {
        throw new Error(result.error || '停止挖矿失败')
      }
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : '停止挖矿失败'
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 手动刷新
  const refreshData = async () => {
    setStatus({
      type: 'info',
      message: '正在刷新数据...'
    })
    await fetchMiningStatus()
    setStatus({
      type: 'success',
      message: '数据已刷新'
    })
  }

  // 格式化代币数量
  const formatTokens = (tokens: number | null): string => {
    if (!tokens || tokens <= 0) {
      return '0'
    }
    return tokens
  }

  useEffect(() => {
    fetchMiningStatus()

    // 每3秒更新一次状态
    const interval = setInterval(() => {
      if (miningStatus?.isMining) {
        fetchMiningStatus()
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [miningStatus?.isMining])

  useEffect(() => {
    if (status.type) {
      const timer = setTimeout(
        () => setStatus({ type: null, message: '' }),
        5000
      )
      return () => clearTimeout(timer)
    }
  }, [status])

  const renderMiningContent = () => {
    if (!miningStatus) return null

    return (
      <div className="space-y-6">
        {/* 内存池为空时的提示 */}
        {miningStatus.isMining && miningStatus.blockchain.mempoolSize === 0 && (
          <div className="rounded-2xl p-4 border bg-yellow-50 border-yellow-200 text-yellow-800">
            <p className="font-medium">
              ⏸️ 挖矿已暂停：内存池中没有待确认的交易
            </p>
            <p className="text-sm mt-1">
              系统将每5秒检查一次，有新交易时自动恢复挖矿
            </p>
          </div>
        )}

        {/* 矿工信息 */}
        <div className="bg-white shadow-lg rounded-2xl border border-gray-200/50 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200/50 bg-gray-50">
            <h3 className="text-xl font-bold flex items-center text-gray-800">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-lg flex items-center justify-center mr-3">
                <Pickaxe className="w-4 h-4 text-white" />
              </div>
              挖矿控制台
              <span
                className={`ml-3 px-2 py-1 rounded-full text-xs font-bold ${
                  miningStatus.isMining
                    ? miningStatus.blockchain.mempoolSize === 0
                      ? 'bg-yellow-100 text-yellow-800 animate-pulse'
                      : 'bg-green-100 text-green-800 animate-pulse'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {miningStatus.isMining
                  ? miningStatus.blockchain.mempoolSize === 0
                    ? '等待交易'
                    : '挖矿中'
                  : '已停止'}
              </span>
            </h3>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 矿工信息 */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-700 flex items-center">
                  <Settings className="w-4 h-4 mr-2 text-cosmos-500" />
                  矿工信息
                </h4>

                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">矿工地址:</span>
                    <span className="text-sm font-mono">
                      {miningStatus.minerInfo.address?.substring(0, 12)}...
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">矿工名称:</span>
                    <span className="text-sm">
                      {miningStatus.minerInfo.name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">账户余额:</span>
                    <span className="text-sm font-bold text-green-600">
                      {formatTokens(minerBalance)} TOKEN
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">密钥状态:</span>
                    <span
                      className={`text-sm ${
                        miningStatus.minerInfo.hasPrivateKey
                          ? 'text-green-600'
                          : 'text-yellow-600'
                      }`}
                    >
                      {miningStatus.minerInfo.hasPrivateKey
                        ? '完整钱包'
                        : '仅观察'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 区块链状态 */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-700 flex items-center">
                  <BarChart3 className="w-4 h-4 mr-2 text-cosmos-500" />
                  区块链状态
                </h4>

                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">当前高度:</span>
                    <span className="text-sm font-bold">
                      {miningStatus.blockchain.height}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">挖矿难度:</span>
                    <span className="text-sm">
                      {miningStatus.blockchain.difficulty}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">待确认交易:</span>
                    <span className="text-sm">
                      {miningStatus.blockchain.mempoolSize}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 控制按钮 */}
            <div className="flex items-center justify-center space-x-4 mt-6">
              {!miningStatus.isMining ? (
                <button
                  onClick={startMining}
                  disabled={isLoading}
                  className="btn-primary flex items-center px-6 py-3"
                >
                  {isLoading ? (
                    <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-5 h-5 mr-2" />
                  )}
                  {isLoading ? '启动中...' : '开始挖矿'}
                </button>
              ) : (
                <button
                  onClick={stopMining}
                  disabled={isLoading}
                  className="bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center"
                >
                  {isLoading ? (
                    <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Square className="w-5 h-5 mr-2" />
                  )}
                  {isLoading ? '停止中...' : '停止挖矿'}
                </button>
              )}

              <button
                onClick={refreshData}
                className="btn-secondary flex items-center px-4 py-3"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                刷新数据
              </button>
            </div>
          </div>
        </div>

        {/* 挖矿统计 */}
        <div className="bg-white shadow-lg rounded-2xl border border-gray-200/50 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200/50 bg-gray-50">
            <h3 className="text-xl font-bold flex items-center text-gray-800">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center mr-3">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              挖矿统计
            </h3>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {/* 挖到区块 */}
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {miningStatus.stats?.blocksMinedTotal || 0}
                </div>
                <div className="text-sm text-gray-600">挖到区块</div>
              </div>

              {/* 总奖励 */}
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Award className="w-6 h-6 text-white" />
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatTokens(miningStatus.stats?.totalRewards || 0)}
                </div>
                <div className="text-sm text-gray-600">总奖励 (TOKEN)</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!miningStatus) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-cosmos-500" />
        <span className="ml-2 text-gray-600">加载挖矿状态...</span>
      </div>
    )
  }

  const tabs = [
    { id: 'mining' as MiningTabType, label: '挖矿控制', icon: Pickaxe },
    { id: 'transfer' as MiningTabType, label: '矿工转账', icon: Send }
  ]

  return (
    <div className="space-y-6">
      {/* 标签页导航 */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  isActive
                    ? 'border-cosmos-500 text-cosmos-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* 状态提示 */}
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

      {/* 标签页内容 */}
      {activeTab === 'transfer' ? (
        <MinerTransfer
          minerInfo={miningStatus?.minerInfo || null}
          minerBalance={minerBalance}
          onTransferSuccess={async () => {
            // 转账成功后刷新矿工余额
            if (miningStatus?.minerInfo?.address) {
              await fetchMinerBalance(miningStatus.minerInfo.address)
            }
          }}
        />
      ) : (
        renderMiningContent()
      )}
    </div>
  )
}

export default MiningManager
