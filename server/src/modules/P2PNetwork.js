/** @format */

import { EventEmitter } from 'events'
import net from 'net'
import { Transaction } from './Transaction.js'

/**
 * 简化的P2P网络类 - 模拟区块链网络功能
 */
export class P2PNetwork extends EventEmitter {
  constructor(config = {}) {
    super()

    this.chainId = config.chainId || 'my-blockchain'
    this.nodeId = config.nodeId || 'node-' + Date.now()
    this.p2pPort = config.p2pPort || 6001
    this.initialPeers = config.initialPeers || []

    // 接受区块链引用（正确的架构：网络层服务于区块链）
    this.blockchain = config.blockchain || null

    // 网络状态
    this.isRunning = false
    this.sockets = new Map() // 使用 Map 存储 socket 连接，key 为 host:port
    this.server = null

    console.log(`🌐 P2P网络节点初始化: ${this.nodeId}`)
    console.log(`📊 链ID: ${this.chainId}`)
  }

  /**
   * 启动网络并初始化P2P服务
   */
  start() {
    this.isRunning = true
    console.log('🚀 P2P网络已启动')

    // 启动TCP服务器监听其他节点连接
    const server = net.createServer((socket) => {
      this.handleNewSocket(socket)
    })

    server.listen(this.p2pPort, () => {
      console.log(`🅿️ P2P服务器正在监听端口: ${this.p2pPort}`)
    })
    this.server = server

    // 连接到初始节点
    this.initialPeers.forEach((peer) => {
      this.connectToPeer(peer.host, peer.port)
    })
  }

  stop() {
    this.server.close()
    this.sockets = new Map()
  }

  /**
   * 连接到指定的对等节点
   * @param {string} host
   * @param {number} port
   */
  connectToPeer(host, port) {
    if (`${host}:${port}` === `localhost:${this.p2pPort}`) return // 不连接自己

    const socket = new net.Socket()
    socket.connect(port, host, () => {
      this.handleNewSocket(socket)
    })

    socket.on('error', (err) => {
      console.error(`连接到节点 ${host}:${port} 失败:`, err.message)
    })
  }

  /**
   * 处理新的socket连接 (包括呼入和呼出)
   * @param {net.Socket} socket
   */
  handleNewSocket(socket) {
    const peerKey = `${socket.remoteAddress}:${socket.remotePort}`
    if (this.sockets.has(peerKey)) {
      return // 已存在连接
    }
    this.sockets.set(peerKey, socket)
    console.log(`🤝 新节点已连接: ${peerKey}`)

    let messageBuffer = ''
    socket.on('data', (data) => {
      messageBuffer += data.toString()
      // 使用换行符作为消息分隔符
      let boundary = messageBuffer.indexOf('\n')
      while (boundary !== -1) {
        const message = messageBuffer.substring(0, boundary)
        messageBuffer = messageBuffer.substring(boundary + 1)
        this.handleMessage(JSON.parse(message))
        boundary = messageBuffer.indexOf('\n')
      }
    })

    socket.on('close', () => {
      this.sockets.delete(peerKey)
      console.log(`👋 节点已断开: ${peerKey}`)
    })

    socket.on('error', (err) => {
      this.sockets.delete(peerKey)
      console.error(`与节点 ${peerKey} 的连接出错:`, err.message)
    })
  }

  /**
   * 处理从其他节点接收到的消息
   * @param {object} message
   */
  handleMessage(message) {
    console.log('📩 收到P2P消息:', message.type)
    switch (message.type) {
      case 'NEW_BLOCK':
        this.handleNewBlock(message.payload)
        break
      case 'NEW_TRANSACTION':
        this.handleNewTransaction(message.payload)
        break
      // 未来可以添加更多消息类型，如 NEW_TRANSACTION
      default:
        console.warn('收到了未知的P2P消息类型:', message.type)
    }
  }

  /**
   * 处理从网络接收到的新区块
   * @param {object} blockData
   */
  handleNewBlock(blockData) {
    // 验证区块的
    // 1、 previous_hash是否是所在节点的最后一个节点
    // 2 merkler_tree、交易验证
    // 3. 执行区块里的所有交易，更新自己的utxo账户信息
    console.log('完啦，活被人抢了')
  }

  /**
   * 处理从网络接收到的新交易
   * @param {object} txData
   */
  handleNewTransaction(txData) {
    // 判断内存池是否有交易
    // 验证交易格式，金额，签名，双花attract
    // 加到自己的内存池
    console.log('来活啦')
  }

  /**
   * 向所有连接的节点广播消息
   * @param {object} message
   */
  broadcast(message) {
    const formattedMessage = JSON.stringify(message) + '\n'
    console.log(`📡 正在广播消息: ${message.type}`)
    this.sockets.forEach((socket) => {
      socket.write(formattedMessage)
    })
  }
}

export default P2PNetwork
