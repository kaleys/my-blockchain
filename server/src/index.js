/** @format */

import minimist from 'minimist'
import { createApp } from './app.js'

// 1. 解析命令行参数
const args = minimist(process.argv.slice(2))

// 2. 从参数或环境变量中获取配置，并提供默认值
const config = {
  port: args.port || process.env.PORT || 1317,
  p2pPort: args['p2p-port'] || process.env.P2P_PORT || 6001,
  peers: args.peers
    ? args.peers
        .split(',')
        .map((peer) => {
          try {
            const url = new URL(peer)
            return { host: url.hostname, port: url.port }
          } catch (e) {
            console.error(`Invalid peer URL: ${peer}`)
            return null
          }
        })
        .filter((p) => p !== null)
    : []
}

// 3. 使用配置创建应用实例
const { server, blockchain } = createApp(config)

// 4. 启动HTTP和WebSocket服务器
server.listen(config.port, () => {
  console.log('🚀 区块链服务器启动完成!')
  console.log('=====================================')
  console.log(`📡 API & RPC Server: http://localhost:${config.port}`)
  console.log(`⚡ WebSocket Server: ws://localhost:${config.port}`)
  console.log('📊 区块链状态:')
  console.log(`• 链ID: ${blockchain.chainId}`)
  console.log(`• 当前区块高度: ${blockchain.getLatestBlock().header.height}`)
  console.log('🌐 前端地址: http://localhost:5173')

  // 5. 启动P2P网络
  // The p2pNetwork is now part of the blockchain instance
  blockchain.p2pNetwork.start()
})

const gracefulShutdown = () => {
  console.log('🛑 正在关闭服务器...')
  blockchain.shutdown()
  server.close(() => {
    console.log('服务器已关闭')
    process.exit(0)
  })
}

process.on('SIGINT', gracefulShutdown)
process.on('SIGTERM', gracefulShutdown)
