/**
 * 自動更新モニター
 * KVストアの更新リクエストを監視して価格更新を実行
 */

import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';

dotenv.config();

const execAsync = promisify(exec);
const WORKER_URL = process.env.WORKER_URL || 'https://coin-price-checker.h-abe.workers.dev';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const CHECK_INTERVAL = 60000; // 1分ごとにチェック

async function checkUpdateRequest() {
    try {
        // KVストアから更新リクエストを取得
        const response = await fetch(`${WORKER_URL}/api/kv/update_request`, {
            headers: {
                'Authorization': `Bearer ${ADMIN_PASSWORD}`
            }
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        if (data && data.status === 'pending') {
            return data;
        }

        return null;
    } catch (error) {
        console.error('Error checking update request:', error);
        return null;
    }
}

async function clearUpdateRequest() {
    try {
        await fetch(`${WORKER_URL}/api/kv/update_request`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${ADMIN_PASSWORD}`
            }
        });
    } catch (error) {
        console.error('Error clearing update request:', error);
    }
}

async function executeUpdate() {
    console.log('🚀 Executing price update...');

    try {
        const { stdout, stderr } = await execAsync('node dynamic-price-updater.js');
        console.log(stdout);
        if (stderr) console.error(stderr);

        console.log('✅ Price update completed successfully');
        return true;
    } catch (error) {
        console.error('❌ Price update failed:', error);
        return false;
    }
}

async function monitor() {
    console.log('👀 Auto-update monitor started');
    console.log(`Checking for update requests every ${CHECK_INTERVAL / 1000} seconds...`);

    setInterval(async () => {
        const request = await checkUpdateRequest();

        if (request) {
            console.log(`📋 Update request found: ${request.requested_at}`);

            // 更新を実行
            const success = await executeUpdate();

            // リクエストをクリア
            await clearUpdateRequest();

            if (success) {
                console.log('✨ Update completed and request cleared');
            } else {
                console.log('⚠️ Update failed but request cleared');
            }
        }
    }, CHECK_INTERVAL);
}

// 開始
monitor();

// 優雅な終了処理
process.on('SIGINT', () => {
    console.log('\n👋 Auto-update monitor stopped');
    process.exit(0);
});