/** @format */

import { EventEmitter } from 'events'

/**
 * 挖矿管理器
 */
export class MiningManager extends EventEmitter {
  constructor(blockchain, minerWallet) {
    super()
    this.blockchain = blockchain
    this.minerWallet = minerWallet
    this.isMining = false
    this.miningStats = {
      blocksMinedTotal: 0,
      hashesComputed: 0,
      currentHashRate: 0,
      lastBlockMined: null,
      totalRewards: 0,
      startTime: null,
      currentNonce: 0
    }
    this.miningInterval = null
    this.progressCallback = null
  }

  /**
   * 开始挖矿
   * @param {Object} options - 挖矿选项
   * @returns {Object} 开始结果
   */
  async startMining(options = {}) {
    if (this.isMining) {
      return {
        success: false,
        error: '已在挖矿中'
      }
    }

    if (!this.minerWallet.isReady()) {
      return {
        success: false,
        error: '矿工钱包未初始化'
      }
    }

    try {
      this.isMining = true
      this.miningStats.startTime = Date.now()

      const minerAddress = this.minerWallet.getAddress()

      console.log(`⛏️ 开始挖矿...`)
      console.log(`   矿工地址: ${minerAddress}`)
      console.log(`   当前难度: ${this.blockchain.difficulty}`)
      console.log(`   内存池交易数: ${this.blockchain.mempool.size}`)

      // 设置进度回调
      this.progressCallback = (progress) => {
        this.miningStats.currentNonce = progress.nonce
        this.miningStats.hashesComputed += progress.hashesThisRound
        this.updateHashRate()
      }

      // 开始挖矿（异步）
      this.mineNextBlock(minerAddress)

      return {
        success: true,
        message: '挖矿已开始',
        minerAddress,
        stats: this.miningStats
      }
    } catch (error) {
      this.isMining = false
      console.error(`❌ 开始挖矿失败: ${error.message}`)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 停止挖矿
   * @returns {Object} 停止结果
   */
  stopMining() {
    if (!this.isMining) {
      return {
        success: false,
        error: '当前未在挖矿'
      }
    }

    this.isMining = false

    if (this.miningInterval) {
      clearTimeout(this.miningInterval)
      this.miningInterval = null
    }

    const miningDuration =
      Date.now() - (this.miningStats.startTime || Date.now())

    console.log('⏹️ 挖矿已停止')
    console.log(`   挖矿时长: ${(miningDuration / 1000).toFixed(2)}秒`)
    console.log(`   总哈希数: ${this.miningStats.hashesComputed}`)
    console.log(
      `   平均哈希率: ${this.miningStats.currentHashRate.toFixed(2)} H/s`
    )

    this.emit('miningStopped', {
      stats: this.miningStats,
      duration: miningDuration
    })

    return {
      success: true,
      message: '挖矿已停止',
      stats: this.miningStats,
      duration: miningDuration
    }
  }

  /**
   * 挖掘下一个区块
   * @param {string} minerAddress - 矿工地址
   */
  async mineNextBlock(minerAddress) {
    if (!this.isMining) {
      return
    }

    // 检查内存池是否有交易
    if (this.blockchain.mempool.size === 0) {
      console.log(`⏸️ 内存池为空，等待交易...`)
      this.emit('miningWaiting', {
        reason: '内存池无交易',
        stats: this.miningStats
      })

      // 等待5秒后重新检查
      setTimeout(() => {
        this.mineNextBlock(minerAddress)
      }, 5000)
      return
    }

    try {
      console.log(`🔨 开始挖掘新区块...`)
      console.log(`   内存池交易数: ${this.blockchain.mempool.size}`)

      const result = await this.blockchain.mineBlock(
        minerAddress,
        this.progressCallback,
        this.minerWallet.getPublicKey() // 传递矿工的公钥
      )

      if (result.success) {
        // 挖矿成功
        this.miningStats.blocksMinedTotal++
        this.miningStats.lastBlockMined = {
          height: result.block.header.height,
          hash: result.block.hash,
          timestamp: result.block.header.timestamp,
          reward: result.block.transactions[0].getOutputAmount(),
          transactionCount: result.block.transactions.length - 1
        }
        this.miningStats.totalRewards +=
          result.block.transactions[0].getOutputAmount()

        console.log(`🎉 区块挖掘成功!`)
        console.log(`   区块高度: ${result.block.header.height}`)
        console.log(`   区块哈希: ${result.block.hash}`)
        console.log(
          `   挖矿奖励: ${result.block.transactions[0].getOutputAmount()} tokens`
        )
        console.log(
          `   挖矿统计: ${result.miningStats.attempts} 次尝试, 用时 ${result.miningStats.duration}ms`
        )

        this.emit('blockMined', {
          block: result.block,
          miningStats: result.miningStats,
          totalStats: this.miningStats
        })

        // 继续挖下一个区块
        setTimeout(() => {
          this.mineNextBlock(minerAddress)
        }, 1000) // 稍微延迟一下
      } else {
        console.error(`❌ 挖矿失败: ${result.error}`)
        this.emit('miningError', {
          error: result.error,
          stats: this.miningStats
        })

        // 重试
        setTimeout(() => {
          this.mineNextBlock(minerAddress)
        }, 5000)
      }
    } catch (error) {
      console.error(`❌ 挖矿过程出错: ${error.message}`)
      this.emit('miningError', {
        error: error.message,
        stats: this.miningStats
      })

      // 重试
      setTimeout(() => {
        this.mineNextBlock(minerAddress)
      }, 5000)
    }
  }

  /**
   * 更新哈希率
   */
  updateHashRate() {
    if (!this.miningStats.startTime) return

    const elapsed = Date.now() - this.miningStats.startTime
    if (elapsed > 0) {
      this.miningStats.currentHashRate =
        (this.miningStats.hashesComputed * 1000) / elapsed
    }
  }

  /**
   * 获取挖矿状态
   * @returns {Object} 挖矿状态
   */
  getStatus() {
    this.updateHashRate()

    return {
      isMining: this.isMining,
      minerInfo: this.minerWallet.getInfo(),
      stats: {
        ...this.miningStats,
        miningDuration: this.miningStats.startTime
          ? Date.now() - this.miningStats.startTime
          : 0
      },
      blockchain: {
        height: this.blockchain.getHeight(),
        difficulty: this.blockchain.difficulty,
        mempoolSize: this.blockchain.mempool.size
      }
    }
  }

  /**
   * 重置挖矿统计
   */
  resetStats() {
    this.miningStats = {
      blocksMinedTotal: 0,
      hashesComputed: 0,
      currentHashRate: 0,
      lastBlockMined: null,
      totalRewards: 0,
      startTime: null,
      currentNonce: 0
    }

    console.log('📊 挖矿统计已重置')
  }

  /**
   * 获取挖矿效率报告
   * @returns {Object} 效率报告
   */
  getEfficiencyReport() {
    const duration = this.miningStats.startTime
      ? Date.now() - this.miningStats.startTime
      : 0

    const avgBlockTime =
      this.miningStats.blocksMinedTotal > 0
        ? duration / this.miningStats.blocksMinedTotal
        : 0

    const avgRewardPerBlock =
      this.miningStats.blocksMinedTotal > 0
        ? this.miningStats.totalRewards / this.miningStats.blocksMinedTotal
        : 0

    return {
      totalMiningTime: duration,
      blocksFound: this.miningStats.blocksMinedTotal,
      totalHashesComputed: this.miningStats.hashesComputed,
      averageHashRate: this.miningStats.currentHashRate,
      averageBlockTime: avgBlockTime,
      totalRewards: this.miningStats.totalRewards,
      averageRewardPerBlock: avgRewardPerBlock,
      hashesPerBlock:
        this.miningStats.blocksMinedTotal > 0
          ? this.miningStats.hashesComputed / this.miningStats.blocksMinedTotal
          : 0,
      efficiency:
        this.miningStats.hashesComputed > 0
          ? (this.miningStats.blocksMinedTotal /
              this.miningStats.hashesComputed) *
            100
          : 0
    }
  }
}

export default MiningManager
