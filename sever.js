// server.js
const express = require('express');
const WebSocket = require('ws');
const nodemailer = require('nodemailer');
const path = require('path');
const dotenv = require('dotenv');

// 환경변수 로드
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 이메일 전송 설정
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

// WebSocket 서버 설정
const wss = new WebSocket.Server({ port: 6000 });
const clients = new Set();

// 미들웨어 설정
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// WebSocket 연결 처리
wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('새로운 클라이언트 연결됨');

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'TRANSACTION') {
                await handleTransaction(data.data);
                broadcastTransaction(data, ws);
            }
        } catch (error) {
            console.error('메시지 처리 오류:', error);
        }
    });

    ws.on('close', () => {
        clients.delete(ws);
        console.log('클라이언트 연결 해제');
    });
});

// 트랜잭션 처리 함수
async function handleTransaction(transaction) {
    try {
        await sendTransactionEmails(transaction);
        console.log('트랜잭션 처리 완료:', transaction.id);
    } catch (error) {
        console.error('트랜잭션 처리 오류:', error);
    }
}

// 이메일 전송 함수
async function sendTransactionEmails(transaction) {
    const { senderEmail, recipientEmail, amount, id, sender, recipient, timestamp } = transaction;

    // 발신자 이메일
    const senderMailOptions = {
        from: process.env.EMAIL_USER,
        to: senderEmail,
        subject: '블록체인 거래 확인',
        html: `
            <h2>거래가 성공적으로 전송되었습니다</h2>
            <p>거래 ID: ${id}</p>
            <p>받는 주소: ${recipient}</p>
            <p>금액: ${amount} BTC</p>
            <p>시간: ${new Date(timestamp).toLocaleString()}</p>
        `
    };

    // 수신자 이메일
    const recipientMailOptions = {
        from: process.env.EMAIL_USER,
        to: recipientEmail,
        subject: '블록체인 거래 수신 알림',
        html: `
            <h2>새로운 거래가 수신되었습니다</h2>
            <p>거래 ID: ${id}</p>
            <p>보낸 주소: ${sender}</p>
            <p>금액: ${amount} BTC</p>
            <p>시간: ${new Date(timestamp).toLocaleString()}</p>
        `
    };

    try {
        await Promise.all([
            transporter.sendMail(senderMailOptions),
            transporter.sendMail(recipientMailOptions)
        ]);
        console.log('이메일 전송 완료:', id);
    } catch (error) {
        console.error('이메일 전송 실패:', error);
        throw error;
    }
}

// 트랜잭션 브로드캐스트
function broadcastTransaction(data, sender) {
    clients.forEach(client => {
        if (client !== sender && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// API 엔드포인트
app.post('/api/transaction', async (req, res) => {
    try {
        const transaction = req.body;
        await handleTransaction(transaction);
        res.json({ success: true, message: '트랜잭션이 성공적으로 처리되었습니다.' });
    } catch (error) {
        console.error('API 오류:', error);
        res.status(500).json({ error: '트랜잭션 처리 중 오류가 발생했습니다.' });
    }
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다`);
    console.log(`WebSocket 서버가 포트 6000에서 실행 중입니다`);
});
방금 마지막으로 편집됨