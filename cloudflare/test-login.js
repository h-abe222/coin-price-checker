import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    console.log('1. サイトにアクセス...');
    await page.goto('https://coin-price-checker.h-abe.workers.dev');

    console.log('2. ページ読み込み待機...');
    await page.waitForSelector('#password', { timeout: 5000 });

    console.log('3. パスワード入力欄の存在確認...');
    const passwordInput = await page.$('#password');
    if (passwordInput) {
        console.log('   ✓ パスワード入力欄が存在します');
    } else {
        console.log('   ✗ パスワード入力欄が見つかりません');
        await browser.close();
        return;
    }

    console.log('4. パスワード "admin123" を入力...');
    await page.fill('#password', 'admin123');

    // 入力された値を確認
    const inputValue = await page.inputValue('#password');
    console.log('   入力された値:', inputValue);

    console.log('5. ログインボタンをクリック...');
    await page.click('button[onclick="login()"]');

    console.log('6. ログイン結果を確認...');
    await page.waitForTimeout(2000);

    // エラーメッセージの確認
    const errorVisible = await page.isVisible('#loginError');
    if (errorVisible) {
        const errorText = await page.textContent('#loginError');
        console.log('   ✗ ログイン失敗:', errorText);
    }

    // メイン画面の表示確認
    const mainScreenVisible = await page.isVisible('#mainScreen');
    if (mainScreenVisible) {
        console.log('   ✓ ログイン成功！メイン画面が表示されました');
    } else {
        console.log('   ✗ メイン画面が表示されません');
    }

    // コンソールログを確認
    page.on('console', msg => console.log('Browser console:', msg.text()));

    console.log('\n7. セッション状態を確認...');
    const authenticated = await page.evaluate(() => sessionStorage.getItem('authenticated'));
    console.log('   セッション認証状態:', authenticated);

    console.log('\n10秒後にブラウザを閉じます...');
    await page.waitForTimeout(10000);
    await browser.close();
})();