/** @format */

import type {
  Balance,
  NetworkStatus,
  BlockInfo,
  ApiResponse
} from '../types/cosmos'

// We are no longer using CosmJS Stargate client as the backend is now UTXO-based.

export class CosmosClientService {
  private rpcEndpoint: string
  private restEndpoint: string
  private currentAddress: string | null = null

  constructor() {
    this.rpcEndpoint =
      import.meta.env.VITE_RPC_ENDPOINT || 'http://localhost:1317'
    this.restEndpoint =
      import.meta.env.VITE_REST_ENDPOINT || 'http://localhost:1317'
  }

  // Simplified connect method to check server status
  async connect(): Promise<ApiResponse<{ chainId: string; height: number }>> {
    try {
      console.log('🔗 连接到区块链节点...')
      const response = await fetch(`${this.rpcEndpoint}/status`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      const data = await response.json()
      const result = data.result
      console.log('✅ 成功连接到节点')
      return {
        success: true,
        data: {
          chainId: result.node_info.network,
          height: parseInt(result.sync_info.latest_block_height, 10)
        }
      }
    } catch (error) {
      console.error('❌ 连接失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      }
    }
  }

  // 当前地址
  async setActiveAddress(address: string) {
    this.currentAddress = address
  }

  // Get balance for an address
  async getBalance(address: string): Promise<ApiResponse<Balance>> {
    try {
      const response = await fetch(
        `${this.restEndpoint}/api/addresses/${address}/balance`
      )
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch balance')
      }
      return {
        success: true,
        // The API returns balance data structure with amount and denom
        data: {
          denom: result.data.denom || 'utoken',
          amount: result.data.amount ? result.data.amount.toString() : '0',
          balances: result.data.balances || []
        }
      }
    } catch (error) {
      console.error(`❌ 查询地址 ${address} 余额失败:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Balance query failed',
        data: { denom: 'utoken', amount: '0' }
      }
    }
  }

  // Send tokens from the current address (requires signing)
  async sendTokens(
    toAddress: string,
    amount: string,
    publicKey: string
  ): Promise<ApiResponse<{ transactionId: string }>> {
    if (!this.currentAddress) {
      return { success: false, error: 'No active address set.' }
    }

    try {
      console.log('🔄 创建转账交易...')
      // 使用客户端转账接口，简化版本
      const response = await fetch(
        `${this.restEndpoint}/api/transactions/client-transfer`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fromAddress: this.currentAddress,
            toAddress,
            amount: parseInt(amount, 10),
            publicKey
          })
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Transaction failed')
      }

      console.log(`✅ 交易已创建并广播: ${result.data.transactionId}`)
      return {
        success: true,
        data: { transactionId: result.data.transactionId }
      }
    } catch (error) {
      console.error('❌ 发送代币失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Send tokens failed'
      }
    }
  }

  async getNetworkStatus(): Promise<ApiResponse<NetworkStatus>> {
    try {
      const response = await fetch(`${this.rpcEndpoint}/status`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      const data = await response.json()
      const result = data.result
      const status: NetworkStatus = {
        chainId: result.node_info.network,
        latestBlockHeight: result.sync_info.latest_block_height,
        latestBlockTime: result.sync_info.latest_block_time,
        catchingUp: result.sync_info.catching_up,
        moniker: result.node_info.moniker,
        version: result.node_info.version
      }
      return { success: true, data: status }
    } catch {
      return { success: false, error: 'Network status query failed' }
    }
  }

  async getBlock(height): Promise<ApiResponse<BlockInfo>> {
    try {
      const endpoint = `${this.restEndpoint}/api/blocks/${height}`
      const response = await fetch(endpoint)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      const data = await response.json()
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch block')
      }
      return { success: true, data: data.data }
    } catch {
      return { success: false, error: 'Block query failed' }
    }
  }

  // 获取所有区块
  async getAllBlocks(): Promise<
    ApiResponse<{ blocks: BlockInfo[]; totalBlocks: number }>
  > {
    try {
      const response = await fetch(`${this.restEndpoint}/api/blocks/all`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch all blocks')
      }
      return { success: true, data: data.data }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to fetch all blocks',
        data: { blocks: [], totalBlocks: 0 }
      }
    }
  }
}
