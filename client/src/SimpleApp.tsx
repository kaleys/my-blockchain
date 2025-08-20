import React, { useState, useEffect } from 'react';
import { SimpleCosmosClient } from './services/simpleCosmosClient';

function SimpleApp() {
  const [cosmosClient] = useState(() => new SimpleCosmosClient());
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [networkStatus, setNetworkStatus] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'wallet' | 'transaction' | 'history'>('wallet');
  
  // 钱包管理状态
  const [wallets, setWallets] = useState<any[]>([]);
  const [newWalletName, setNewWalletName] = useState('');
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);
  
  // 交易状态
  const [fromWalletId, setFromWalletId] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [isSendingTransaction, setIsSendingTransaction] = useState(false);
  const [transactionResult, setTransactionResult] = useState<any>(null);
  
  // 交易历史状态
  const [selectedAddress, setSelectedAddress] = useState('');
  const [transactionHistory, setTransactionHistory] = useState<any[]>([]);

  // 连接到区块链网络
  const connectToNetwork = async () => {
    setIsConnecting(true);
    try {
      const result = await cosmosClient.connect();
      setIsConnected(result.success);
      if (result.success) {
        await updateNetworkStatus();
        await updateWalletList();
      }
    } catch (error) {
      console.error('连接失败:', error);
    } finally {
      setIsConnecting(false);
    }
  };


  // 更新网络状态
  const updateNetworkStatus = async () => {
    try {
      const result = await cosmosClient.getNetworkStatus();
      if (result.success) {
        setNetworkStatus(result.data);
      }
    } catch (error) {
      console.error('获取网络状态失败:', error);
    }
  };

  // 更新钱包列表
  const updateWalletList = async () => {
    try {
      const result = await cosmosClient.getWalletList();
      if (result.success) {
        setWallets(result.data || []);
      }
    } catch (error) {
      console.error('获取钱包列表失败:', error);
    }
  };

  // 创建新钱包
  const createWallet = async () => {
    if (!newWalletName.trim()) {
      alert('请输入钱包名称');
      return;
    }

    setIsCreatingWallet(true);
    try {
      const result = await cosmosClient.createWallet(newWalletName);
      if (result.success) {
        setNewWalletName('');
        await updateWalletList();
        alert(`钱包创建成功！\n地址: ${result.data?.address}`);
      } else {
        alert(`创建钱包失败: ${result.error}`);
      }
    } catch (error) {
      alert(`创建钱包失败: ${error}`);
    } finally {
      setIsCreatingWallet(false);
    }
  };

  // 发送交易
  const sendTransaction = async () => {
    if (!fromWalletId || !toAddress || !amount) {
      alert('请填写完整的交易信息');
      return;
    }

    if (parseFloat(amount) <= 0) {
      alert('金额必须大于0');
      return;
    }

    setIsSendingTransaction(true);
    setTransactionResult(null);
    
    try {
      const result = await cosmosClient.sendTransaction(fromWalletId, toAddress, amount, memo);
      
      if (result.success) {
        setTransactionResult(result.data);
        setFromWalletId('');
        setToAddress('');
        setAmount('');
        setMemo('');
        await updateWalletList(); // 刷新钱包列表以更新余额
        alert(`交易发送成功！\n交易哈希: ${result.data?.hash}`);
      } else {
        alert(`交易发送失败: ${result.error}`);
      }
    } catch (error) {
      alert(`交易发送失败: ${error}`);
    } finally {
      setIsSendingTransaction(false);
    }
  };

  // 获取交易历史
  const getTransactionHistory = async () => {
    if (!selectedAddress) {
      alert('请输入地址');
      return;
    }

    try {
      const result = await cosmosClient.getTransactionHistory(selectedAddress);
      if (result.success) {
        setTransactionHistory(result.data || []);
      } else {
        alert(`获取交易历史失败: ${result.error}`);
      }
    } catch (error) {
      alert(`获取交易历史失败: ${error}`);
    }
  };

  // 自动连接
  useEffect(() => {
    connectToNetwork();
  }, []);

  const tabButtonStyle = (isActive: boolean) => ({
    padding: '12px 24px',
    backgroundColor: isActive ? '#007bff' : '#f8f9fa',
    color: isActive ? 'white' : '#333',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    marginRight: '10px',
    marginBottom: '10px',
    fontWeight: isActive ? 'bold' : 'normal'
  });

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      {/* 头部 */}
      <div style={{ 
        backgroundColor: 'white', 
        padding: '20px', 
        borderRadius: '8px', 
        marginBottom: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ margin: '0 0 10px 0', color: '#333' }}>
          🚀 Cosmos 区块链客户端
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{
            padding: '5px 10px',
            borderRadius: '15px',
            backgroundColor: isConnected ? '#d4edda' : '#f8d7da',
            color: isConnected ? '#155724' : '#721c24',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isConnected ? '#28a745' : '#dc3545'
            }}></span>
            {isConnected ? '已连接' : '未连接'}
          </div>
          
          {!isConnected && (
            <button 
              onClick={connectToNetwork}
              disabled={isConnecting}
              style={{
                padding: '8px 16px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isConnecting ? 'not-allowed' : 'pointer',
                opacity: isConnecting ? 0.6 : 1
              }}
            >
              {isConnecting ? '连接中...' : '重新连接'}
            </button>
          )}
        </div>
      </div>

      {/* 标签页导航 */}
      <div style={{ marginBottom: '20px' }}>
        <button 
          style={tabButtonStyle(activeTab === 'wallet')}
          onClick={() => setActiveTab('wallet')}
        >
          👛 钱包管理
        </button>
        <button 
          style={tabButtonStyle(activeTab === 'transaction')}
          onClick={() => setActiveTab('transaction')}
        >
          💸 发送交易
        </button>
        <button 
          style={tabButtonStyle(activeTab === 'history')}
          onClick={() => setActiveTab('history')}
        >
          📜 交易历史
        </button>
      </div>


      {/* 钱包管理标签页 */}
      {activeTab === 'wallet' && (
        <div style={{ 
          backgroundColor: 'white', 
          padding: '20px', 
          borderRadius: '8px', 
          marginBottom: '20px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ margin: '0 0 20px 0', color: '#333' }}>👛 钱包管理</h2>
          
          {/* 创建新钱包 */}
          <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>创建新钱包</h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="输入钱包名称..."
                value={newWalletName}
                onChange={(e) => setNewWalletName(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
              <button
                onClick={createWallet}
                disabled={isCreatingWallet}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isCreatingWallet ? 'not-allowed' : 'pointer',
                  opacity: isCreatingWallet ? 0.6 : 1
                }}
              >
                {isCreatingWallet ? '创建中...' : '创建钱包'}
              </button>
            </div>
          </div>

          {/* 钱包列表 */}
          <div>
            <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>我的钱包 ({wallets.length})</h3>
            {wallets.length === 0 ? (
              <p style={{ color: '#666', fontStyle: 'italic' }}>暂无钱包，请创建一个新钱包</p>
            ) : (
              <div style={{ display: 'grid', gap: '10px' }}>
                {wallets.map((wallet, index) => (
                  <div 
                    key={wallet.id || index}
                    style={{
                      padding: '15px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      backgroundColor: '#fafafa'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h4 style={{ margin: '0 0 5px 0', color: '#333' }}>{wallet.id}</h4>
                        <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', wordBreak: 'break-all' }}>
                          {wallet.address}
                        </p>
                        <p style={{ margin: '0', fontWeight: 'bold', color: '#28a745' }}>
                          {wallet.balance} TOKEN
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button 
              onClick={updateWalletList}
              style={{
                marginTop: '15px',
                padding: '8px 16px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              🔄 刷新钱包列表
            </button>
          </div>
        </div>
      )}

      {/* 发送交易标签页 */}
      {activeTab === 'transaction' && (
        <div style={{ 
          backgroundColor: 'white', 
          padding: '20px', 
          borderRadius: '8px', 
          marginBottom: '20px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ margin: '0 0 20px 0', color: '#333' }}>💸 发送交易</h2>
          
          <div style={{ maxWidth: '500px' }}>
            {/* 发送方钱包 */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>发送方钱包:</label>
              <select
                value={fromWalletId}
                onChange={(e) => setFromWalletId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="">选择钱包...</option>
                {wallets.map((wallet, index) => (
                  <option key={wallet.id || index} value={wallet.id}>
                    {wallet.id} ({wallet.balance} TOKEN)
                  </option>
                ))}
              </select>
            </div>

            {/* 接收地址 */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>接收地址:</label>
              <input
                type="text"
                placeholder="cosmos1..."
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            {/* 金额 */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>金额 (TOKEN):</label>
              <input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                step="0.000001"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            {/* 备注 */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>备注 (可选):</label>
              <input
                type="text"
                placeholder="交易备注..."
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            {/* 发送按钮 */}
            <button
              onClick={sendTransaction}
              disabled={isSendingTransaction}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: isSendingTransaction ? 'not-allowed' : 'pointer',
                opacity: isSendingTransaction ? 0.6 : 1
              }}
            >
              {isSendingTransaction ? '发送中...' : '发送交易'}
            </button>

            {/* 交易结果 */}
            {transactionResult && (
              <div style={{ 
                marginTop: '20px', 
                padding: '15px', 
                backgroundColor: '#d4edda', 
                borderRadius: '4px',
                border: '1px solid #c3e6cb'
              }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#155724' }}>✅ 交易发送成功!</h4>
                <p style={{ margin: '0 0 5px 0', fontSize: '14px' }}>
                  <strong>交易哈希:</strong> {transactionResult.hash}
                </p>
                <p style={{ margin: '0 0 5px 0', fontSize: '14px' }}>
                  <strong>金额:</strong> {transactionResult.amount} TOKEN
                </p>
                <p style={{ margin: '0', fontSize: '14px' }}>
                  <strong>手续费:</strong> {transactionResult.fee} TOKEN
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 交易历史标签页 */}
      {activeTab === 'history' && (
        <div style={{ 
          backgroundColor: 'white', 
          padding: '20px', 
          borderRadius: '8px', 
          marginBottom: '20px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ margin: '0 0 20px 0', color: '#333' }}>📜 交易历史</h2>
          
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="输入地址查询交易历史..."
                value={selectedAddress}
                onChange={(e) => setSelectedAddress(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
              <button
                onClick={getTransactionHistory}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                查询
              </button>
            </div>
          </div>

          {/* 交易历史列表 */}
          {transactionHistory.length === 0 ? (
            <p style={{ color: '#666', fontStyle: 'italic' }}>暂无交易记录</p>
          ) : (
            <div style={{ display: 'grid', gap: '10px' }}>
              {transactionHistory.map((tx, index) => (
                <div 
                  key={tx.hash || index}
                  style={{
                    padding: '15px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    backgroundColor: '#fafafa'
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <p style={{ margin: '0 0 5px 0', fontSize: '14px' }}>
                        <strong>交易哈希:</strong> {tx.hash}
                      </p>
                      <p style={{ margin: '0 0 5px 0', fontSize: '14px' }}>
                        <strong>类型:</strong> {tx.type}
                      </p>
                      <p style={{ margin: '0', fontSize: '14px' }}>
                        <strong>金额:</strong> {tx.amount} {tx.denom}
                      </p>
                    </div>
                    <div>
                      <p style={{ margin: '0 0 5px 0', fontSize: '14px' }}>
                        <strong>区块高度:</strong> {tx.height}
                      </p>
                      <p style={{ margin: '0 0 5px 0', fontSize: '14px' }}>
                        <strong>时间:</strong> {new Date(tx.timestamp).toLocaleString()}
                      </p>
                      <p style={{ margin: '0', fontSize: '14px' }}>
                        <strong>状态:</strong> 
                        <span style={{ 
                          color: tx.status === 'success' ? '#28a745' : '#dc3545',
                          fontWeight: 'bold',
                          marginLeft: '5px'
                        }}>
                          {tx.status === 'success' ? '成功' : '失败'}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 网络状态 */}
      {networkStatus && (
        <div style={{ 
          backgroundColor: 'white', 
          padding: '20px', 
          borderRadius: '8px', 
          marginBottom: '20px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ margin: '0 0 15px 0', color: '#333' }}>📊 网络状态</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
            <div>
              <strong>链ID:</strong> {networkStatus.chainId}
            </div>
            <div>
              <strong>最新区块高度:</strong> {networkStatus.latestBlockHeight}
            </div>
            <div>
              <strong>节点名称:</strong> {networkStatus.moniker}
            </div>
            <div>
              <strong>版本:</strong> {networkStatus.version}
            </div>
          </div>
        </div>
      )}

      {/* 底部 */}
      <div style={{ 
        textAlign: 'center', 
        marginTop: '40px', 
        color: '#666', 
        fontSize: '14px' 
      }}>
        <p>🛠️ 基于 React + TypeScript 构建的区块链客户端</p>
        <p style={{ fontSize: '12px', opacity: 0.8 }}>
          连接到本地区块链网络 (端口: 1317) | 支持钱包管理、交易发送、历史查询
        </p>
      </div>
    </div>
  );
}

export default SimpleApp;