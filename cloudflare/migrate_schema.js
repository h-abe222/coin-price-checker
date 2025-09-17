/**
 * データベーススキーママイグレーションスクリプト
 * 複数サイト価格並列表示対応
 */

import fs from 'fs';
import path from 'path';

/**
 * ローカルD1データベースのマイグレーション実行
 */
async function migrateLocalDatabase() {
    const { execSync } = await import('child_process');

    console.log('🔄 Migrating local D1 database...');

    try {
        // schema_extension.sqlを読み込み
        const schemaPath = path.join(process.cwd(), 'schema_extension.sql');
        const migrationSQL = fs.readFileSync(schemaPath, 'utf8');

        // 各SQL文を分割して実行
        const statements = migrationSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        console.log(`📝 Executing ${statements.length} migration statements...`);

        for (const statement of statements) {
            if (statement.includes('ALTER TABLE') ||
                statement.includes('CREATE INDEX') ||
                statement.includes('CREATE VIEW')) {

                try {
                    const command = `npx wrangler d1 execute DB --local --command "${statement.replace(/"/g, '\\"')}"`;
                    execSync(command, { stdio: 'inherit' });
                    console.log(`✅ Executed: ${statement.substring(0, 50)}...`);
                } catch (error) {
                    if (error.message.includes('duplicate column name') ||
                        error.message.includes('already exists')) {
                        console.log(`⚠️  Skipped (already exists): ${statement.substring(0, 50)}...`);
                    } else {
                        console.error(`❌ Failed: ${statement.substring(0, 50)}...`);
                        console.error(`Error: ${error.message}`);
                    }
                }
            }
        }

        console.log('✅ Local database migration completed');
        return true;

    } catch (error) {
        console.error('❌ Local migration failed:', error);
        return false;
    }
}

/**
 * リモートD1データベースのマイグレーション実行
 */
async function migrateRemoteDatabase() {
    const { execSync } = await import('child_process');

    console.log('🌐 Migrating remote D1 database...');

    try {
        // schema_extension.sqlを読み込み
        const schemaPath = path.join(process.cwd(), 'schema_extension.sql');
        const migrationSQL = fs.readFileSync(schemaPath, 'utf8');

        // 各SQL文を分割して実行
        const statements = migrationSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        console.log(`📝 Executing ${statements.length} migration statements on remote...`);

        for (const statement of statements) {
            if (statement.includes('ALTER TABLE') ||
                statement.includes('CREATE INDEX') ||
                statement.includes('CREATE VIEW')) {

                try {
                    const command = `npx wrangler d1 execute DB --command "${statement.replace(/"/g, '\\"')}"`;
                    execSync(command, { stdio: 'inherit' });
                    console.log(`✅ Remote executed: ${statement.substring(0, 50)}...`);
                } catch (error) {
                    if (error.message.includes('duplicate column name') ||
                        error.message.includes('already exists')) {
                        console.log(`⚠️  Remote skipped (already exists): ${statement.substring(0, 50)}...`);
                    } else {
                        console.error(`❌ Remote failed: ${statement.substring(0, 50)}...`);
                        console.error(`Error: ${error.message}`);
                    }
                }
            }
        }

        console.log('✅ Remote database migration completed');
        return true;

    } catch (error) {
        console.error('❌ Remote migration failed:', error);
        return false;
    }
}

/**
 * 既存データの確認
 */
async function checkExistingData() {
    const { execSync } = await import('child_process');

    console.log('📊 Checking existing data...');

    try {
        // 現在の商品数を確認
        const countCommand = 'npx wrangler d1 execute DB --local --command "SELECT COUNT(*) as count FROM products"';
        const result = execSync(countCommand, { encoding: 'utf8' });
        console.log('Current products:', result);

        // 新しいカラムの確認
        const schemaCommand = 'npx wrangler d1 execute DB --local --command "PRAGMA table_info(products)"';
        const schemaResult = execSync(schemaCommand, { encoding: 'utf8' });
        console.log('Table schema:', schemaResult);

        return true;
    } catch (error) {
        console.error('❌ Data check failed:', error);
        return false;
    }
}

/**
 * 新カラムの初期化
 */
async function initializeNewColumns() {
    const { execSync } = await import('child_process');

    console.log('🔧 Initializing new columns with default values...');

    try {
        // 新しいカラムにデフォルト値を設定
        const initCommands = [
            "UPDATE products SET total_sites = 1 WHERE total_sites IS NULL",
            "UPDATE products SET best_site = site WHERE best_site IS NULL AND site IS NOT NULL",
            "UPDATE products SET price_spread_percent = 0 WHERE price_spread_percent IS NULL"
        ];

        for (const command of initCommands) {
            try {
                execSync(`npx wrangler d1 execute DB --local --command "${command}"`, { stdio: 'inherit' });
                console.log(`✅ Initialized: ${command}`);
            } catch (error) {
                console.error(`❌ Init failed: ${command}`);
            }
        }

        console.log('✅ Column initialization completed');
        return true;

    } catch (error) {
        console.error('❌ Column initialization failed:', error);
        return false;
    }
}

/**
 * マイグレーション検証
 */
async function validateMigration() {
    const { execSync } = await import('child_process');

    console.log('🔍 Validating migration...');

    try {
        // 新しいビューのテスト
        const viewTestCommand = 'npx wrangler d1 execute DB --local --command "SELECT COUNT(*) FROM v_product_comparison"';
        execSync(viewTestCommand, { stdio: 'inherit' });

        // データ整合性チェック
        const integrityCommand = 'npx wrangler d1 execute DB --local --command "SELECT * FROM v_data_integrity_check LIMIT 5"';
        execSync(integrityCommand, { stdio: 'inherit' });

        console.log('✅ Migration validation passed');
        return true;

    } catch (error) {
        console.error('❌ Migration validation failed:', error);
        return false;
    }
}

/**
 * メイン実行関数
 */
async function main() {
    console.log('🚀 Starting database schema migration for multi-site price comparison');
    console.log('=' .repeat(70));

    const args = process.argv.slice(2);
    const includeRemote = args.includes('--remote');

    // ステップ1: 既存データ確認
    if (!(await checkExistingData())) {
        console.error('❌ Pre-migration check failed');
        process.exit(1);
    }

    // ステップ2: ローカルマイグレーション
    if (!(await migrateLocalDatabase())) {
        console.error('❌ Local migration failed');
        process.exit(1);
    }

    // ステップ3: 新カラム初期化
    if (!(await initializeNewColumns())) {
        console.error('❌ Column initialization failed');
        process.exit(1);
    }

    // ステップ4: マイグレーション検証
    if (!(await validateMigration())) {
        console.error('❌ Migration validation failed');
        process.exit(1);
    }

    // ステップ5: リモートマイグレーション（オプション）
    if (includeRemote) {
        console.log('\n🌐 Starting remote migration...');
        if (!(await migrateRemoteDatabase())) {
            console.error('❌ Remote migration failed');
            process.exit(1);
        }
    }

    console.log('\n' + '=' .repeat(70));
    console.log('🎉 Database schema migration completed successfully!');
    console.log('\nNew columns added:');
    console.log('  - site_prices (JSON): サイト別価格データ');
    console.log('  - site_urls (JSON): サイト別URL');
    console.log('  - best_site: 最安値サイト名');
    console.log('  - price_spread_percent: 価格差(%)');
    console.log('  - total_sites: 対応サイト数');
    console.log('\nNew views created:');
    console.log('  - v_product_comparison: 価格比較ビュー');
    console.log('  - v_data_integrity_check: データ整合性チェック');

    if (!includeRemote) {
        console.log('\n💡 To migrate remote database, run:');
        console.log('   node cloudflare/migrate_schema.js --remote');
    }
}

// エラーハンドリング
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled rejection:', error);
    process.exit(1);
});

// 実行
main().catch(console.error);