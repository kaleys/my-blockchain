/** @format */

import React, { useState, useEffect } from 'react'
import {
  Database,
  Search,
  RefreshCw,
  Clock,
  Hash,
  Users,
  ChevronRight,
  X,
  AlertCircle
} from 'lucide-react'
import type { CosmosClientService } from '../services/cosmosClient'
import type { BlockInfo } from '../types/cosmos'

interface BlockExplorerProps {
  cosmosClient: CosmosClientService
  isConnected: boolean
}

const BlockExplorer: React.FC<BlockExplorerProps> = ({
  cosmosClient,
  isConnected
}) => {
  const [blocks, setBlocks] = useState<BlockInfo[]>([])
  const [searchHeight, setSearchHeight] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedBlock, setSelectedBlock] = useState<BlockInfo | null>(null)

  const fetchLatestBlocks = async () => {
    if (!isConnected) return
    setIsLoading(true)
    setError(null)
    try {
      // 一次性获取所有区块
      const result = await cosmosClient.getAllBlocks()
      if (result.success && result.data) {
        setBlocks(result.data.blocks)
      } else {
        throw new Error(result.error || '获取区块失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取区块失败')
    } finally {
      setIsLoading(false)
    }
  }

  const searchBlock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchHeight || !isConnected) return
    setIsLoading(true)
    setError(null)
    try {
      const height = parseInt(searchHeight)
      const result = await cosmosClient.getBlock(height)
      if (result.success && result.data) {
        setSelectedBlock(result.data)
      } else {
        setError(`无法找到区块 #${height}`)
        setSelectedBlock(null)
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `搜索区块 #${searchHeight} 失败`
      )
      setSelectedBlock(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isConnected) {
      fetchLatestBlocks()
      const interval = setInterval(fetchLatestBlocks, 15000)
      return () => clearInterval(interval)
    }
  }, [isConnected])

  const DetailItem = ({
    label,
    value
  }: {
    label: string
    value: React.ReactNode
  }) => (
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-md font-semibold text-gray-800 font-mono break-all">
        {value}
      </p>
    </div>
  )

  const inputClasses =
    'w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-cosmos-500 focus:border-cosmos-500 transition-colors duration-200 shadow-sm'
  const btnPrimaryClasses =
    'inline-flex items-center justify-center px-4 py-2 rounded-lg font-semibold tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm bg-cosmos-600 text-white hover:bg-cosmos-700 focus:ring-cosmos-500 border border-transparent'
  const btnSecondaryClasses =
    'inline-flex items-center justify-center px-4 py-2 rounded-lg font-semibold tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm bg-white text-gray-700 hover:bg-gray-50 focus:ring-cosmos-500 border border-gray-300'

  if (!isConnected) {
    return (
      <div className="text-center py-12">
        <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 font-semibold">请先连接到区块链网络</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <form onSubmit={searchBlock} className="flex gap-3">
        <input
          type="number"
          placeholder="按区块高度搜索..."
          value={searchHeight}
          onChange={(e) => setSearchHeight(e.target.value)}
          className={`${inputClasses} flex-grow`}
          min="1"
        />
        <button
          type="submit"
          disabled={!searchHeight || isLoading}
          className={btnPrimaryClasses}
        >
          <Search className="w-4 h-4 mr-2" />
          搜索
        </button>
      </form>

      {error && (
        <div className="bg-red-50 text-red-800 p-3 rounded-lg text-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {selectedBlock && (
        <div className="border border-gray-200 rounded-xl p-6 relative bg-white shadow-sm">
          <button
            onClick={() => setSelectedBlock(null)}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
          <h4 className="text-xl font-bold text-gray-800 mb-4">
            区块详情 #{selectedBlock.block.header.height}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <DetailItem
              label="区块高度"
              value={selectedBlock.block.header.height}
            />
            <DetailItem
              label="区块哈希"
              value={
                selectedBlock.block.hash
                  ? `${selectedBlock.block.hash.substring(0, 20)}...`
                  : 'N/A'
              }
            />
            <DetailItem
              label="交易数量"
              value={selectedBlock.block.transactions?.length || 0}
            />
            <DetailItem
              label="区块大小"
              value={`${selectedBlock.block.size || 0} bytes`}
            />
            <DetailItem
              label="时间戳"
              value={new Date(
                selectedBlock.block.header.timestamp
              ).toLocaleString()}
            />
            <DetailItem
              label="难度"
              value={selectedBlock.block.header.difficulty || 'N/A'}
            />
            <DetailItem
              label="随机数"
              value={selectedBlock.block.header.nonce || 'N/A'}
            />
            <DetailItem
              label="版本"
              value={selectedBlock.block.header.version || 'N/A'}
            />
            <DetailItem
              label="上一区块哈希"
              value={
                selectedBlock.block.header.previousBlockHash
                  ? `${selectedBlock.block.header.previousBlockHash.substring(
                      0,
                      20
                    )}...`
                  : 'N/A'
              }
            />
            <DetailItem
              label="Merkle根"
              value={
                selectedBlock.block.header.merkleRoot
                  ? `${selectedBlock.block.header.merkleRoot.substring(
                      0,
                      20
                    )}...`
                  : 'N/A'
              }
            />
          </div>

          {/* 交易列表 */}
          {selectedBlock.block.transactions &&
            selectedBlock.block.transactions.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h5 className="text-lg font-semibold text-gray-800 mb-3">
                  区块中的交易 ({selectedBlock.block.transactions.length} 笔)
                </h5>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {selectedBlock.block.transactions.map((tx, index) => (
                    <div
                      key={tx.id || index}
                      className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-sm font-semibold text-gray-700">
                          交易 #{index + 1}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(tx.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <p className="text-xs text-gray-600 mb-1">交易ID:</p>
                      <p className="text-xs font-mono text-gray-800 bg-white p-2 rounded border break-all mb-2">
                        {tx.id}
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div>
                          <p className="text-gray-600 font-medium">
                            输入 ({tx.inputs?.length || 0}个):
                          </p>
                          {tx.inputs?.map((input, i) => (
                            <div key={i} className="ml-2 mt-1 text-gray-700">
                              <p>
                                • 来源:{' '}
                                {input.transactionId ===
                                '0000000000000000000000000000000000000000000000000000000000000000'
                                  ? 'Coinbase'
                                  : `${input.transactionId.substring(
                                      0,
                                      16
                                    )}...`}
                              </p>
                              <p>• 输出索引: {input.outputIndex}</p>
                              {input.amount !== null &&
                                input.amount !== undefined && (
                                  <p>• 金额: {input.amount} TOKEN</p>
                                )}
                              {!input.amount &&
                                input.value !== null &&
                                input.value !== undefined && (
                                  <p>• 金额: {input.value} TOKEN</p>
                                )}
                              {input.transactionId !==
                                '0000000000000000000000000000000000000000000000000000000000000000' &&
                                !input.amount &&
                                !input.value && (
                                  <p className="text-gray-500">
                                    • 金额: 需要查询UTXO
                                  </p>
                                )}
                            </div>
                          )) || <p className="ml-2 text-gray-500">无输入</p>}
                        </div>

                        <div>
                          <p className="text-gray-600 font-medium">
                            输出 ({tx.outputs?.length || 0}个):
                          </p>
                          {tx.outputs?.map((output, i) => (
                            <div key={i} className="ml-2 mt-1 text-gray-700">
                              <p>
                                • 地址:{' '}
                                {output.address
                                  ? `${output.address.substring(0, 20)}...`
                                  : 'N/A'}
                              </p>
                              <p>• 金额: {output.amount} TOKEN</p>
                            </div>
                          )) || <p className="ml-2 text-gray-500">无输出</p>}
                        </div>
                      </div>

                      {tx.fee && tx.fee > 0 && (
                        <p className="text-xs text-gray-600 mt-2">
                          手续费: {tx.fee} TOKEN
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      )}

      <div>
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-xl font-bold text-gray-800">所有区块</h4>
          <button
            onClick={fetchLatestBlocks}
            disabled={isLoading}
            className={`${btnSecondaryClasses} text-sm`}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
            />
            刷新
          </button>
        </div>
        <div className="space-y-3">
          {isLoading && blocks.length === 0
            ? [...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse p-4 bg-gray-100 rounded-xl"
                >
                  <div className="h-5 w-3/4 bg-gray-300 rounded"></div>
                  <div className="h-4 w-1/2 bg-gray-300 rounded mt-2"></div>
                </div>
              ))
            : blocks.map((block) => (
                <div
                  key={block.block.header.height}
                  className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 hover:shadow-md transition-all duration-200 cursor-pointer bg-white"
                  onClick={() => setSelectedBlock(block)}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                      <div className="bg-gray-100 p-3 rounded-lg">
                        <Hash className="w-5 h-5 text-cosmos-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-cosmos-700">
                          区块 #{block.block.header.height}
                        </p>
                        <p className="text-xs text-gray-500 font-mono">
                          {block.block_id?.hash?.substring(0, 24)}...
                        </p>
                      </div>
                    </div>
                    <div className="hidden md:flex items-center space-x-6 text-sm">
                      <div className="flex items-center text-gray-600">
                        <Users className="w-4 h-4 mr-2" />
                        <span>
                          {block.block.transactions?.length || 0} 笔交易
                        </span>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <Clock className="w-4 h-4 mr-2" />
                        <span>
                          {new Date(
                            block.block.header.timestamp
                          ).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              ))}
        </div>
      </div>
    </div>
  )
}

export default BlockExplorer
