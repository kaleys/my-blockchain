/** @format */

import React, { useState } from 'react'

interface MinerInfo {
  address: string
  name: string
  isInitialized: boolean
  hasPrivateKey: boolean
  hasPublicKey: boolean
}

interface TransferData {
  transactionId: string
  fromAddress: string
  toAddress: string
  amount: number
  fee: number
  timestamp: number
}

interface MinerTransferProps {
  minerInfo: MinerInfo | null
  minerBalance: number
  onTransferSuccess?: () => void
}

const MinerTransfer: React.FC<MinerTransferProps> = ({
  minerInfo,
  minerBalance,
  onTransferSuccess
}) => {
  const [toAddress, setToAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>(
    'info'
  )
  const [lastTransfer, setLastTransfer] = useState<TransferData | null>(null)

  const rpcAddress =
    import.meta.env.VITE_RPC_ENDPOINT || 'http://localhost:1317'

  // 执行转账
  const handleTransfer = async () => {
    if (!toAddress || !amount) {
      showMessage('请填写目标地址和转账金额', 'error')
      return
    }

    const numericAmount = parseInt(amount)
    if (isNaN(numericAmount) || numericAmount <= 0) {
      showMessage('转账金额必须是正数', 'error')
      return
    }

    if (!minerInfo?.hasPrivateKey) {
      showMessage('矿工钱包没有私钥，无法转账', 'error')
      return
    }

    setIsLoading(true)
    setMessage('')

    try {
      const response = await fetch(`${rpcAddress}/api/mining/miner/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          toAddress: toAddress.trim(),
          amount: numericAmount
        })
      })

      const data = await response.json()

      if (data.success) {
        setLastTransfer(data.data)
        showMessage('转账成功！', 'success')

        // 清空表单
        setToAddress('')
        setAmount('')

        // 通知父组件刷新余额
        if (onTransferSuccess) {
          onTransferSuccess()
        }
      } else {
        showMessage(`转账失败: ${data.error}`, 'error')
      }
    } catch (error) {
      console.error('转账失败:', error)
      showMessage('转账失败，请检查网络连接', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // 显示消息
  const showMessage = (text: string, type: 'success' | 'error' | 'info') => {
    setMessage(text)
    setMessageType(type)
    setTimeout(() => setMessage(''), 5000)
  }

  // 格式化金额显示
  const formatAmount = (amount: number) => {
    return amount.toFixed(8) // 直接显示token数量，保留8位小数
  }

  if (!minerInfo) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">矿工转账</h3>
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">加载矿工信息...</p>
        </div>
      </div>
    )
  }

  if (!minerInfo.isInitialized) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">矿工转账</h3>
        <div className="text-center py-4">
          <div className="text-yellow-600 mb-2">⚠️</div>
          <p className="text-gray-600">矿工钱包未初始化，无法进行转账</p>
        </div>
      </div>
    )
  }

  if (!minerInfo.hasPrivateKey) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">矿工转账</h3>
        <div className="text-center py-4">
          <div className="text-red-600 mb-2">🔒</div>
          <p className="text-gray-600">矿工钱包没有私钥，无法进行转账</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">矿工转账</h3>

      {/* 矿工信息 */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-2">矿工钱包信息</h4>
        <div className="space-y-1 text-sm">
          <p>
            <span className="text-gray-600">地址:</span>{' '}
            <span className="font-mono text-xs">{minerInfo.address}</span>
          </p>
          <p>
            <span className="text-gray-600">余额:</span>{' '}
            <span className="font-semibold">
              {formatAmount(minerBalance)} 币
            </span>
          </p>
          <p>
            <span className="text-gray-600">状态:</span>{' '}
            <span className="text-green-600">✓ 可以转账</span>
          </p>
        </div>
      </div>

      {/* 转账表单 */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            目标地址
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              placeholder="输入接收方地址..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            转账金额 (Token)
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="输入转账金额..."
            min="1"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={isLoading}
          />
          <p className="text-xs text-gray-500 mt-1">10%的手续费</p>
        </div>

        <button
          onClick={handleTransfer}
          disabled={isLoading || !toAddress || !amount}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              处理中...
            </span>
          ) : (
            '发起转账'
          )}
        </button>
      </div>

      {/* 消息显示 */}
      {message && (
        <div
          className={`mt-4 p-3 rounded-md text-sm ${
            messageType === 'success'
              ? 'bg-green-100 text-green-700'
              : messageType === 'error'
              ? 'bg-red-100 text-red-700'
              : 'bg-blue-100 text-blue-700'
          }`}
        >
          {message}
        </div>
      )}

      {/* 最近转账记录 */}
      {lastTransfer && (
        <div className="mt-6 p-4 bg-green-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">最近转账记录</h4>
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-gray-600">交易ID:</span>{' '}
              <span className="font-mono text-xs">
                {lastTransfer.transactionId}
              </span>
            </p>
            <p>
              <span className="text-gray-600">接收方:</span>{' '}
              <span className="font-mono text-xs">
                {lastTransfer.toAddress}
              </span>
            </p>
            <p>
              <span className="text-gray-600">金额:</span>{' '}
              <span className="font-semibold">
                {formatAmount(lastTransfer.amount)} 个token
              </span>
            </p>
            <p>
              <span className="text-gray-600">手续费:</span>{' '}
              <span className="text-gray-500">{lastTransfer.fee} tokens</span>
            </p>
            <p>
              <span className="text-gray-600">时间:</span>{' '}
              <span className="text-gray-500">
                {new Date(lastTransfer.timestamp).toLocaleString()}
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default MinerTransfer
