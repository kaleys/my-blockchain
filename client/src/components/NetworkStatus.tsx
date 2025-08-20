/** @format */

import React, { useState, useEffect } from 'react'
import {
  Globe,
  RefreshCw,
  CheckCircle,
  XCircle,
  Zap,
  Clock,
  Server,
  Hash
} from 'lucide-react'
import type { CosmosClientService } from '../services/cosmosClient'
import type { NetworkStatus as NetworkStatusType } from '../types/cosmos'

interface NetworkStatusProps {
  cosmosClient: CosmosClientService
  isConnected: boolean
}

const NetworkStatus: React.FC<NetworkStatusProps> = ({
  cosmosClient,
  isConnected
}) => {
  const [status, setStatus] = useState<NetworkStatusType | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchStatus = async () => {
    if (!isConnected) return
    setIsLoading(true)
    try {
      const result = await cosmosClient.getNetworkStatus()
      if (result.success && result.data) {
        setStatus(result.data)
      }
    } catch (error) {
      console.error('获取网络状态失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isConnected) {
      fetchStatus()
      const interval = setInterval(fetchStatus, 10000)
      return () => clearInterval(interval)
    }
  }, [isConnected])

  const StatusItem = ({
    icon,
    label,
    value
  }: {
    icon: React.ReactNode
    label: string
    value: React.ReactNode
  }) => (
    <div className="bg-white border border-gray-200/80 rounded-xl p-4 flex items-center space-x-4 shadow-sm">
      <div className="bg-gray-100 p-3 rounded-lg">{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-lg font-semibold text-gray-800 font-mono">{value}</p>
      </div>
    </div>
  )

  const btnSecondaryClasses =
    'inline-flex items-center justify-center px-4 py-2 rounded-lg font-semibold tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm bg-white text-gray-700 hover:bg-gray-50 focus:ring-cosmos-500 border border-gray-300'

  if (!isConnected) {
    return (
      <div className="text-center py-12">
        <Globe className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 font-semibold">请先连接到区块链网络</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h4 className="text-xl font-bold text-gray-800">网络详情</h4>
        <button
          onClick={fetchStatus}
          disabled={isLoading}
          className={`${btnSecondaryClasses} text-sm`}
        >
          <RefreshCw
            className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
          />
          刷新
        </button>
      </div>

      {status ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatusItem
            icon={<Zap className="w-5 h-5 text-cosmos-600" />}
            label="连接状态"
            value={
              <span
                className={`flex items-center ${
                  isConnected ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {isConnected ? (
                  <CheckCircle className="w-4 h-4 mr-2" />
                ) : (
                  <XCircle className="w-4 h-4 mr-2" />
                )}
                {isConnected ? '已连接' : '未连接'}
              </span>
            }
          />
          <StatusItem
            icon={<Server className="w-5 h-5 text-gray-600" />}
            label="节点名称"
            value={status.moniker || 'N/A'}
          />
          <StatusItem
            icon={<Hash className="w-5 h-5 text-gray-600" />}
            label="链 ID"
            value={status.chainId}
          />
          <StatusItem
            icon={<Hash className="w-5 h-5 text-gray-600" />}
            label="最新区块高度"
            value={status.latestBlockHeight}
          />
          <StatusItem
            icon={<Clock className="w-5 h-5 text-gray-600" />}
            label="最新区块时间"
            value={new Date(status.latestBlockTime).toLocaleTimeString()}
          />
          <StatusItem
            icon={<Zap className="w-5 h-5 text-gray-600" />}
            label="同步状态"
            value={
              <span
                className={`font-semibold ${
                  status.catchingUp ? 'text-yellow-600' : 'text-green-600'
                }`}
              >
                {status.catchingUp ? '同步中' : '已同步'}
              </span>
            }
          />
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cosmos-600 mx-auto"></div>
          <p className="text-gray-500 mt-4">加载网络状态中...</p>
        </div>
      )}

      <div>
        <h4 className="text-xl font-bold text-gray-800 mb-4">连接端点</h4>
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm">
            <h5 className="font-semibold text-gray-800 mb-1">REST API & RPC</h5>
            <p className="text-sm text-gray-600 font-mono">
              http://localhost:1317
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm">
            <h5 className="font-semibold text-gray-800 mb-1">WebSocket</h5>
            <p className="text-sm text-gray-600 font-mono">
              ws://localhost:6001
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NetworkStatus
