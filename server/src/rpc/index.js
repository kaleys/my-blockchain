/** @format */

import Router from 'koa-router'

export default (blockchain) => {
  const router = new Router()

  const createRpcResponse = (id, result) => ({
    jsonrpc: '2.0',
    id,
    result
  })

  const rpcMethods = {
    status: (ctx) => {
      const status = blockchain.getStatus()
      const latestBlock = blockchain.getLatestBlock()
      return {
        node_info: {
          id: 'my-blockchain',
          listen_addr: `tcp://0.0.0.0:26657`,
          network: status.chain_id,
          moniker: '我的区块链'
        },
        sync_info: {
          latest_block_hash: latestBlock.hash,
          latest_app_hash: latestBlock.header.app_hash || '',
          latest_block_height: status.latest_block_height.toString(),
          latest_block_time: status.latest_block_time,
          catching_up: status.catching_up
        }
      }
    }
  }

  const handleRpcRequest = async (ctx) => {
    const { method, id, params } = ctx.request.body
    if (rpcMethods[method]) {
      ctx.body = createRpcResponse(id, rpcMethods[method](ctx))
    } else {
      console.warn(`RPC method not found: ${method}`)
      ctx.status = 404
      ctx.body = {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: 'Method not found' }
      }
    }
  }

  // StargateClient uses GET for /status
  router.get('/status', async (ctx) => {
    ctx.body = createRpcResponse(ctx.query.id || -1, rpcMethods.status(ctx))
  })

  return router.routes()
}
