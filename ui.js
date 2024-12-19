// public/js/UI.js
class BlockchainWalletUI {
    constructor() {
        // 초기 상태 설정
        this.state = {
            node1: {
                address: 'WALLET-1',
                balance: 1000.00000000,
                sent: 0,
                received: 0,
                isOnline: true
            },
            node2: {
                address: 'WALLET-2',
                balance: 1000.00000000,
                sent: 0,
                received: 0,
                isOnline: true
            },
            transactions: [],
            webSockets: {
                node1: null,
                node2: null
            }
        };

        this.initialize();
    }

    initialize() {
        this.connectWebSockets();
        this.setupEventListeners();
        this.initClipboard();
        this.updateUI();
        this.startNetworkSimulation();
    }

    connectWebSockets() {
        // WebSocket 연결
        const ws = new WebSocket('ws://localhost:6000');

        ws.onopen = () => {
            console.log('WebSocket 연결됨');
            this.updateNodeStatus('node1', true);
            this.updateNodeStatus('node2', true);
        };

        ws.onclose = () => {
            console.log('WebSocket 연결 끊김');
            this.updateNodeStatus('node1', false);
            this.updateNodeStatus('node2', false);
            // 재연결 시도
            setTimeout(() => this.connectWebSockets(), 5000);
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'TRANSACTION') {
                    this.handleTransaction(message.data);
                }
            } catch (error) {
                console.error('메시지 처리 오류:', error);
            }
        };

        this.state.webSockets.node1 = ws;
    }

    setupEventListeners() {
        // 거래 폼 제출
        document.getElementById('transactionForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleTransactionSubmit(e.target);
        });

        // 송신자 선택 변경
        document.getElementById('senderSelect').addEventListener('change', (e) => {
            const recipientSelect = document.getElementById('recipientSelect');
            recipientSelect.value = e.target.value === 'node1' ? 'node2' : 'node1';
            this.updateSenderAddress(e.target.value);
        });

        // 금액 입력 검증
        document.querySelector('input[name="amount"]').addEventListener('input', (e) => {
            this.validateAmount(e.target.value);
        });
    }

    initClipboard() {
        const clipboard = new ClipboardJS('.copy-btn');
        
        clipboard.on('success', (e) => {
            this.showToast('주소가 복사되었습니다');
            e.clearSelection();
        });
    }

    handleTransactionSubmit(form) {
        const formData = {
            sender: form.sender.value,
            recipient: form.recipient.value,
            amount: parseFloat(form.amount.value),
            senderEmail: form.senderEmail.value,
            recipientEmail: form.recipientEmail.value,
            message: form.message?.value || ''
        };

        if (!this.validateTransaction(formData)) {
            return;
        }

        const transaction = {
            id: `TX-${Date.now()}`,
            sender: this.state[formData.sender].address,
            recipient: this.state[formData.recipient].address,
            amount: formData.amount,
            timestamp: new Date().toISOString(),
            senderEmail: formData.senderEmail,
            recipientEmail: formData.recipientEmail,
            message: formData.message,
            status: 'PENDING'
        };

        this.processTransaction(transaction);
        form.reset();
    }

    validateTransaction(data) {
        if (data.sender === data.recipient) {
            this.showToast('송신자와 수신자가 같을 수 없습니다', 'error');
            return false;
        }

        if (!this.validateEmail(data.senderEmail) || !this.validateEmail(data.recipientEmail)) {
            this.showToast('유효한 이메일 주소를 입력하세요', 'error');
            return false;
        }

        const senderNode = this.state[data.sender];
        if (data.amount <= 0 || data.amount > senderNode.balance) {
            this.showToast('유효하지 않은 금액입니다', 'error');
            return false;
        }

        return true;
    }

    processTransaction(transaction) {
        // 거래 추가
        this.state.transactions.unshift(transaction);

        // 잔액 업데이트
        if (transaction.sender === this.state.node1.address) {
            this.state.node1.sent += transaction.amount;
            this.state.node1.balance -= transaction.amount;
            this.state.node2.received += transaction.amount;
            this.state.node2.balance += transaction.amount;
        } else {
            this.state.node2.sent += transaction.amount;
            this.state.node2.balance -= transaction.amount;
            this.state.node1.received += transaction.amount;
            this.state.node1.balance += transaction.amount;
        }

        // UI 업데이트
        this.updateUI();
        this.broadcastTransaction(transaction);
        this.showToast('거래가 성공적으로 전송되었습니다');

        // 5초 후 거래 완료 처리
        setTimeout(() => {
            transaction.status = 'COMPLETED';
            this.updateTransactionStatus(transaction);
        }, 5000);
    }

    broadcastTransaction(transaction) {
        const ws = this.state.webSockets.node1;
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'TRANSACTION',
                data: transaction
            }));
        }
    }

    updateUI() {
        this.updateBalances();
        this.updateTransactionHistory();
    }

    updateBalances() {
        // 노드 1 잔액 업데이트
        document.getElementById('balance1').textContent = this.state.node1.balance.toFixed(8);
        document.getElementById('node1Sent').textContent = this.state.node1.sent.toFixed(8);
        document.getElementById('node1Received').textContent = this.state.node1.received.toFixed(8);
        document.getElementById('node1TotalBalance').textContent = 
            this.state.node1.balance.toFixed(8) + ' BTC';

        // 노드 2 잔액 업데이트
        document.getElementById('balance2').textContent = this.state.node2.balance.toFixed(8);
        document.getElementById('node2Sent').textContent = this.state.node2.sent.toFixed(8);
        document.getElementById('node2Received').textContent = this.state.node2.received.toFixed(8);
        document.getElementById('node2TotalBalance').textContent = 
            this.state.node2.balance.toFixed(8) + ' BTC';
    }

    updateTransactionHistory() {
        const historyElement = document.getElementById('transactionHistory');
        historyElement.innerHTML = '';

        this.state.transactions.forEach(tx => {
            const element = this.createTransactionElement(tx);
            historyElement.appendChild(element);
        });

        this.updateTotalAmount();
    }

    createTransactionElement(transaction) {
        const div = document.createElement('div');
        div.className = 'transaction-animation border-b border-gray-200 pb-3';
        
        div.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <p class="text-sm font-medium text-gray-900">보낸 사람: ${transaction.sender}</p>
                    <p class="text-sm font-medium text-gray-900">받는 사람: ${transaction.recipient}</p>
                    <div class="flex items-center mt-1">
                        <span class="text-xs ${transaction.status === 'COMPLETED' ? 'text-green-600' : 'text-yellow-600'} mr-2">
                            ${transaction.status === 'COMPLETED' ? '완료' : '처리중'}
                        </span>
                        <span class="text-xs text-gray-500">${new Date(transaction.timestamp).toLocaleString()}</span>
                    </div>
                </div>
                <p class="text-sm font-semibold text-blue-600">${transaction.amount.toFixed(8)} BTC</p>
            </div>
        `;

        return div;
    }

    updateNodeStatus(nodeId, isConnected) {
        const statusElement = document.getElementById(`${nodeId}Status`);
        const nodeElement = document.getElementById(nodeId);

        if (isConnected) {
            statusElement.textContent = '연결됨';
            statusElement.className = 'mt-2 text-sm font-medium text-green-600';
            nodeElement.classList.add('network-active');
        } else {
            statusElement.textContent = '연결 끊김';
            statusElement.className = 'mt-2 text-sm font-medium text-red-600';
            nodeElement.classList.remove('network-active');
        }
    }

    updateTotalAmount() {
        const total = this.state.transactions.reduce((sum, tx) => sum + tx.amount, 0);