/** @format */

import Router from 'koa-router'
import { default as CryptoUtils } from '../utils/CryptoUtils.js'
import {
  Transaction,
  TransactionInput,
  TransactionOutput
} from '../modules/Transaction.js'

export default (blockchain, miningManager) => {
  const router = new Router({ prefix: '/api' })

  // 测试用的生成地址
  router.post('/addresses/generate', async (ctx) => {
    try {
      const { name } = ctx.request.body
      const address = CryptoUtils.generateCosmosAddress() // Assuming this works without entropy for demo
      ctx.body = {
        success: true,
        data: {
          address: address,
          name: name || 'Generated Address'
        }
      }
    } catch (error) {
      ctx.status = 500
      ctx.body = { success: false, error: error.message }
    }
  })

  // 获得地址的所有金额
  router.get('/addresses/:address/balance', async (ctx) => {
    try {
      const { address } = ctx.params
      const balance = blockchain.utxoSet.getBalance(address)

      // 为了兼容Cosmos格式，返回多种代币余额
      // 如果UTXO余额为0，提供一些默认的测试代币
      const hasBalance = balance > 0

      ctx.body = {
        success: true,
        data: {
          address,
          // 主要代币余额（基于UTXO）
          denom: 'utoken',
          amount: balance.toString(),
          // 兼容多代币格式
          balances: [
            {
              denom: 'utoken',
              amount: balance.toString()
            },
            // 为新地址提供一些测试代币
            ...(hasBalance
              ? []
              : [
                  {
                    denom: 'ustake',
                    amount: '1000000' // 1 STAKE token
                  }
                ])
          ]
        }
      }
    } catch (error) {
      ctx.status = 500
      ctx.body = { success: false, error: error.message }
    }
  })

  // 获得地址的utxo
  router.get('/addresses/:address/utxos', async (ctx) => {
    try {
      const { address } = ctx.params
      const utxos = blockchain.utxoSet.getUTXOsByAddress(address)
      ctx.body = {
        success: true,
        data: {
          address,
          utxos: utxos.map((utxo) => utxo.serialize()),
          count: utxos.length
        }
      }
    } catch (error) {
      ctx.status = 500
      ctx.body = { success: false, error: error.message }
    }
  })

  // 获取最新的10条
  router.get('/blocks/latest', async (ctx) => {
    const block = blockchain.getLatestBlock()
    ctx.body = {
      success: true,
      data: {
        block_id: {
          hash: block.hash,
          part_set_header: { total: 1, hash: block.hash }
        },
        block: block
      }
    }
  })

  // 获取所有区块 - 放在 :height 路由之前避免冲突
  router.get('/blocks/all', async (ctx) => {
    try {
      const blocks = []
      const totalHeight = blockchain.getHeight()

      // 从最新区块到创世区块，按高度倒序获取
      for (let i = totalHeight; i >= 0; i--) {
        const block = blockchain.getBlockByHeight(i)
        if (block) {
          blocks.push({
            block_id: {
              hash: block.hash,
              part_set_header: { total: 1, hash: block.hash }
            },
            block: block
          })
        }
      }

      ctx.body = {
        success: true,
        data: {
          blocks: blocks,
          totalBlocks: blocks.length
        }
      }
    } catch (error) {
      ctx.status = 500
      ctx.body = { success: false, error: error.message }
    }
  })
  // 获取单个区块
  router.get('/blocks/:height', async (ctx) => {
    const { height } = ctx.params
    const block = blockchain.getBlockByHeight(parseInt(height))
    if (!block) {
      ctx.status = 404
      ctx.body = { success: false, message: 'block not found' }
      return
    }
    ctx.body = {
      success: true,
      data: {
        block_id: {
          hash: block.hash,
          part_set_header: { total: 1, hash: block.hash }
        },
        block: block
      }
    }
  })

  // ===== 交易 ======

  // 矿工转账接口
  router.post('/mining/miner/transfer', async (ctx) => {
    try {
      if (!miningManager) {
        ctx.status = 503
        ctx.body = { success: false, error: '挖矿管理器未启用' }
        return
      }

      const fromAddress = miningManager.minerWallet.getAddress()
      const { toAddress, amount } = ctx.request.body
      if (!toAddress || !amount || amount <= 0) {
        ctx.status = 400
        ctx.body = {
          success: false,
          error: '无效的参数：目标地址和金额是必需的'
        }
        return
      }

      const numericAmount = parseInt(amount)
      if (isNaN(numericAmount) || numericAmount <= 0) {
        ctx.status = 400
        ctx.body = { success: false, error: '金额必须是正整数' }
        return
      }

      // 使用Transaction的公用方法创建并签名转账
      const transaction = Transaction.createAndSignTransfer(
        fromAddress,
        toAddress,
        numericAmount,
        miningManager.minerWallet.getPublicKey(),
        blockchain.utxoSet,
        miningManager.minerWallet.getPrivateKey()
      )

      // 添加到内存池
      const mempoolResult = blockchain.addTransactionToMempool(transaction)
      console.log('mempoolResult===>', mempoolResult)
      if (!mempoolResult.success) {
        ctx.status = 400
        ctx.body = {
          success: false,
          error: `添加到内存池失败: ${mempoolResult.error}`
        }
        return
      }

      // 广播交易
      blockchain.p2pNetwork.broadcast({
        type: 'NEW_TRANSACTION',
        payload: transaction.serialize()
      })

      console.log(
        `💸 矿工转账成功: ${fromAddress} -> ${toAddress}, 金额: ${numericAmount}`
      )

      ctx.body = {
        success: true,
        message: '矿工转账成功,等待打包上链后更新数据',
        data: {
          transactionId: transaction.id,
          fromAddress: fromAddress,
          toAddress: toAddress,
          amount: numericAmount,
          fee: transaction.fee,
          timestamp: transaction.timestamp
        }
      }
    } catch (error) {
      console.error('矿工转账失败:', error)
      // const statusCode = error.message.includes('没有可用的UTXO') ? 400 : 500
      ctx.status = 200
      ctx.body = { success: false, error: error.message }
    }
  })

  // 客户端完整转账接口 - 简化版本
  router.post('/transactions/client-transfer', async (ctx) => {
    try {
      const { fromAddress, toAddress, amount, publicKey } = ctx.request.body

      // 参数验证
      if (!fromAddress || !toAddress || !amount || !publicKey) {
        ctx.status = 400
        ctx.body = {
          success: false,
          error: '缺少必要参数：fromAddress, toAddress, amount, publicKey'
        }
        return
      }

      const numericAmount = parseInt(amount)
      if (isNaN(numericAmount) || numericAmount <= 0) {
        ctx.status = 400
        ctx.body = { success: false, error: '金额必须是正整数' }
        return
      }

      // 验证地址格式
      if (
        !CryptoUtils.isValidAddress(fromAddress) ||
        !CryptoUtils.isValidAddress(toAddress)
      ) {
        ctx.status = 400
        ctx.body = { success: false, error: '无效的地址格式' }
        return
      }

      console.log(
        `🔄 客户端转账请求: ${fromAddress} -> ${toAddress}, 金额: ${numericAmount}`
      )

      //
      const transaction = Transaction.createAndSignTransfer(
        fromAddress,
        toAddress,
        numericAmount,
        publicKey,
        blockchain.utxoSet
      )

      // 添加到内存池
      const mempoolResult = blockchain.addTransactionToMempool(transaction, {
        skipSignatureVerification: true
      })
      if (!mempoolResult.success) {
        ctx.status = 400
        ctx.body = {
          success: false,
          error: `添加到内存池失败: ${mempoolResult.error}`
        }
        return
      }

      // 广播交易
      blockchain.p2pNetwork.broadcast({
        type: 'NEW_TRANSACTION',
        payload: transaction.serialize()
      })

      console.log(
        `💸 客户端转账成功: ${fromAddress} -> ${toAddress}, 金额: ${numericAmount}`
      )

      ctx.body = {
        success: true,
        message: '转账交易创建成功，等待打包上链',
        data: {
          transactionId: transaction.id,
          fromAddress: fromAddress,
          toAddress: toAddress,
          amount: numericAmount,
          fee: transaction.fee,
          timestamp: transaction.timestamp
        }
      }
    } catch (error) {
      console.error('客户端转账失败:', error)
      // const statusCode = error.message.includes('没有可用的UTXO') ? 400 : 500
      ctx.status = 200
      ctx.body = { success: false, error: error.message }
    }
  })

  // ===== 挖矿 API =====

  // 获取矿工信息
  router.get('/mining/miner', async (ctx) => {
    try {
      const minerInfo = miningManager
        ? miningManager.minerWallet.getInfo()
        : null
      ctx.body = {
        success: true,
        data: minerInfo || {
          address: null,
          name: 'No Miner',
          isInitialized: false
        }
      }
    } catch (error) {
      ctx.status = 500
      ctx.body = { success: false, error: error.message }
    }
  })

  // 开始挖矿
  router.post('/mining/start', async (ctx) => {
    try {
      if (!miningManager) {
        ctx.status = 503
        ctx.body = { success: false, error: '挖矿管理器未启用' }
        return
      }

      const result = await miningManager.startMining()

      ctx.body = {
        success: result.success,
        message: result.message,
        data: result.success
          ? {
              minerAddress: result.minerAddress,
              stats: result.stats
            }
          : null,
        error: result.error
      }
    } catch (error) {
      ctx.status = 500
      ctx.body = { success: false, error: error.message }
    }
  })

  // 停止挖矿
  router.post('/mining/stop', async (ctx) => {
    try {
      if (!miningManager) {
        ctx.status = 503
        ctx.body = { success: false, error: '挖矿管理器未启用' }
        return
      }

      const result = miningManager.stopMining()

      ctx.body = {
        success: result.success,
        message: result.message,
        data: result.success
          ? {
              stats: result.stats,
              duration: result.duration
            }
          : null,
        error: result.error
      }
    } catch (error) {
      ctx.status = 500
      ctx.body = { success: false, error: error.message }
    }
  })

  // 获取挖矿状态
  router.get('/mining/status', async (ctx) => {
    try {
      if (!miningManager) {
        ctx.status = 503
        ctx.body = { success: false, error: '挖矿管理器未启用' }
        return
      }

      const status = miningManager.getStatus()

      ctx.body = {
        success: true,
        data: status
      }
    } catch (error) {
      ctx.status = 500
      ctx.body = { success: false, error: error.message }
    }
  })

  // 初始化矿工钱包
  router.post('/mining/miner/init', async (ctx) => {
    try {
      if (!miningManager) {
        ctx.status = 503
        ctx.body = { success: false, error: '挖矿管理器未启用' }
        return
      }

      const { address, privateKey } = ctx.request.body
      const result = miningManager.minerWallet.initialize({
        address,
        privateKey
      })

      ctx.body = {
        success: result.success,
        data: result.success
          ? {
              address: result.address,
              name: result.name,
              hasPrivateKey: result.hasPrivateKey,
              hasPublicKey: result.hasPublicKey
            }
          : null,
        error: result.error
      }
    } catch (error) {
      ctx.status = 500
      ctx.body = { success: false, error: error.message }
    }
  })

  // 设置矿工地址
  router.put('/mining/miner/address', async (ctx) => {
    try {
      if (!miningManager) {
        ctx.status = 503
        ctx.body = { success: false, error: '挖矿管理器未启用' }
        return
      }

      const { address } = ctx.request.body
      if (!address) {
        ctx.status = 400
        ctx.body = { success: false, error: '地址不能为空' }
        return
      }

      const success = miningManager.minerWallet.setAddress(address)

      if (success) {
        ctx.body = {
          success: true,
          data: miningManager.minerWallet.getInfo()
        }
      } else {
        ctx.status = 400
        ctx.body = { success: false, error: '无效的地址格式' }
      }
    } catch (error) {
      ctx.status = 500
      ctx.body = { success: false, error: error.message }
    }
  })

  // 重置挖矿统计
  router.post('/mining/reset-stats', async (ctx) => {
    try {
      if (!miningManager) {
        ctx.status = 503
        ctx.body = { success: false, error: '挖矿管理器未启用' }
        return
      }

      miningManager.resetStats()

      ctx.body = {
        success: true,
        message: '挖矿统计已重置'
      }
    } catch (error) {
      ctx.status = 500
      ctx.body = { success: false, error: error.message }
    }
  })

  return [router.routes()]
}
