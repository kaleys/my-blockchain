/** @format */

import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import cors from 'koa-cors'
import { WebSocketServer } from 'ws'
import http from 'http'

import Blockchain from './modules/Blockchain.js'
import MinerWallet from './modules/MinerWallet.js'
import MiningManager from './modules/MiningManager.js'
import createApiRoutes from './api/index.js'
import createRpcRoutes from './rpc/index.js'

export function createApp(config = {}) {
  const app = new Koa()

  // 初始化挖矿组件
  const minerWallet = new MinerWallet()
  minerWallet.initialize()
  const minerAddress = minerWallet.getAddress()

  // Blockchain instance using provided config
  const blockchain = new Blockchain({
    chainId: 'kaleys',
    chainName: 'my blockchain',
    initialMinerAddress: minerAddress,
    minerPublicKey: minerWallet.publicKey,
    // Pass through P2P config from index.js
    p2pPort: config.p2pPort,
    initialPeers: config.peers
  })

  // 初始化挖矿相关的逻辑
  const miningManager = new MiningManager(blockchain, minerWallet)

  console.log(`🏗️ 矿工钱包已初始化: ${minerAddress}`)
  console.log(`💡 提示：此钱包有完整的私钥，可以花费挖矿奖励`)
  console.log(
    `💰 矿工初始余额: ${blockchain.utxoSet.getBalance(minerAddress)} tokens`
  )

  // Middlewares
  app.use(cors({ origin: '*' }))
  app.use(bodyParser({ enableTypes: ['json', 'form'], jsonLimit: '10mb' }))

  // Logger and Error Handler...
  app.use(async (ctx, next) => {
    const start = Date.now()
    console.log(`🌐 ${ctx.method} ${ctx.path} - ${ctx.ip}`)
    await next()
    const ms = Date.now() - start
    console.log(`✅ ${ctx.method} ${ctx.path} - ${ctx.status} (${ms}ms)`)
  })

  app.use(async (ctx, next) => {
    try {
      await next()
    } catch (err) {
      console.error('API错误:', err)
      ctx.status = err.status || 500
      ctx.body = {
        code: err.status || 13,
        message: err.message || 'Internal server error',
        details: []
      }
    }
  })

  // Routers
  const apiRoutes = createApiRoutes(blockchain, miningManager)
  const rpcRoutes = createRpcRoutes(blockchain)
  app.use(rpcRoutes)
  apiRoutes.forEach((routes) => app.use(routes))

  // Create HTTP server
  const server = http.createServer(app.callback())

  // Blockchain event listeners to broadcast to UI
  blockchain.on('blockAdded', (data) => {
    const message = JSON.stringify({
      jsonrpc: '2.0',
      method: 'subscription',
      params: {
        query: "tm.event='NewBlock'",
        data: {
          type: 'tendermint/event/NewBlock',
          value: { block: data.block, height: data.height }
        }
      }
    })
    wsClients.forEach((client) => {
      if (client.readyState === 1) client.send(message)
    })
  })

  miningManager.on('blockMined', (data) => {
    console.log(`🎉 挖矿成功通知: 区块 #${data.block.header.height}`)
    // Broadcast to P2P network is handled within Blockchain class which listens to its own mining events
    const message = JSON.stringify({ type: 'blockMined', data })
    wsClients.forEach((client) => {
      if (client.readyState === 1) client.send(message)
    })
  })

  return { server, blockchain, miningManager }
}
