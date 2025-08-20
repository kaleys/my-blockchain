/** @format */

import React, { useState, useEffect } from 'react'
import { Send, AlertCircle, Wallet } from 'lucide-react'
import type { CosmosClientService } from '../services/cosmosClient'
import type { WalletInfo, TransactionFormData } from '../types/cosmos'

interface TransactionFormProps {
  cosmosClient: CosmosClientService
  currentWallet: WalletInfo | null
  isConnected: boolean
  onTransactionSuccess?: () => void
}

const TransactionForm: React.FC<TransactionFormProps> = ({
  cosmosClient,
  currentWallet,
  isConnected,
  onTransactionSuccess
}) => {
  const [formData, setFormData] = useState<
    Omit<TransactionFormData, 'fromAddress'>
  >({
    toAddress: '',
    amount: '',
    memo: ''
  })
  // 移除私钥相关状态，直接一步完成
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState<{
    type: 'success' | 'error' | 'info' | null
    message: string
  }>({ type: null, message: '' })

  useEffect(() => {
    setFormData({ toAddress: '', amount: '', memo: '' })
    setStatus({ type: null, message: '' })
  }, [currentWallet])

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setStatus({ type: null, message: '' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isConnected || !currentWallet) {
      setStatus({ type: 'error', message: '请先连接网络并激活一个钱包' })
      return
    }
    if (!formData.toAddress || !formData.amount) {
      setStatus({ type: 'error', message: '请填写收款地址和金额' })
      return
    }
    if (parseFloat(formData.amount) <= 0) {
      setStatus({ type: 'error', message: '金额必须大于0' })
      return
    }

    setIsSubmitting(true)
    setStatus({ type: 'info', message: '🔄 正在创建并广播交易...' })

    try {
      // 设置当前激活地址
      await cosmosClient.setActiveAddress(currentWallet.address)
      const result = await cosmosClient.sendTokens(
        formData.toAddress,
        formData.amount,
        currentWallet.publicKey
      )

      if (result.success && result.data) {
        setStatus({
          type: 'success',
          message: `✅ 交易创建成功! 交易ID: ${result.data.transactionId.substring(
            0,
            20
          )}...`
        })

        // 重置表单
        setFormData({ toAddress: '', amount: '', memo: '' })

        if (onTransactionSuccess) {
          setTimeout(onTransactionSuccess, 2000)
        }
      } else {
        throw new Error(result.error || '交易失败')
      }
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : '交易创建失败'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputClasses =
    'w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-cosmos-500 focus:border-cosmos-500 transition-colors duration-200 shadow-sm'
  const btnPrimaryClasses =
    'inline-flex items-center justify-center px-5 py-2.5 rounded-lg font-semibold tracking-wide transition-all duration-200 shadow-sm bg-cosmos-600 text-white hover:bg-cosmos-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cosmos-500 border border-transparent disabled:opacity-60 disabled:cursor-not-allowed'

  if (!currentWallet) {
    return (
      <div className="text-center py-12">
        <Wallet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 mb-2 font-semibold">没有激活的钱包</p>
        <p className="text-sm text-gray-400">
          请先从“钱包管理”标签页激活一个钱包。
        </p>
      </div>
    )
  }

  // 简化为单步表单界面
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          发送方地址
        </label>
        <div className="p-3 bg-gray-100 rounded-lg border border-gray-200 text-sm font-mono text-gray-600 truncate">
          {currentWallet.address}
        </div>
      </div>

      <div>
        <label
          htmlFor="toAddress"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          收款方地址 *
        </label>
        <input
          id="toAddress"
          type="text"
          value={formData.toAddress}
          onChange={(e) => handleInputChange('toAddress', e.target.value)}
          placeholder="ox..."
          className={inputClasses}
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label
            htmlFor="amount"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            金额 (TOKEN) *
          </label>
          <input
            id="amount"
            type="number"
            step="0.000001"
            min="0.000001"
            value={formData.amount}
            onChange={(e) => handleInputChange('amount', e.target.value)}
            placeholder="例如: 1.23"
            className={inputClasses}
            required
          />
        </div>
        <div>
          <label
            htmlFor="memo"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            备注 (可选)
          </label>
          <input
            id="memo"
            type="text"
            value={formData.memo}
            onChange={(e) => handleInputChange('memo', e.target.value)}
            placeholder="交易备注信息"
            className={inputClasses}
          />
        </div>
      </div>

      {status.message && (
        <div
          className={`p-4 rounded-lg flex items-start space-x-3 ${
            status.type === 'success'
              ? 'bg-green-50 border-green-200'
              : status.type === 'error'
              ? 'bg-red-50 border-red-200'
              : 'bg-blue-50 border-blue-200'
          }`}
        >
          <AlertCircle
            className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
              status.type === 'success'
                ? 'text-green-600'
                : status.type === 'error'
                ? 'text-red-600'
                : 'text-blue-600'
            }`}
          />
          <p
            className={`text-sm break-all ${
              status.type === 'success'
                ? 'text-green-800'
                : status.type === 'error'
                ? 'text-red-800'
                : 'text-blue-800'
            }`}
          >
            {status.message}
          </p>
        </div>
      )}

      <div className="pt-4 flex justify-end">
        <button
          type="submit"
          disabled={!isConnected || !currentWallet || isSubmitting}
          className={`${btnPrimaryClasses} w-full sm:w-auto`}
        >
          <Send className="w-4 h-4 mr-2" />
          {isSubmitting ? '发送中...' : '发送交易'}
        </button>
      </div>
    </form>
  )
}

// 完成简化，移除多步骤逻

export default TransactionForm
