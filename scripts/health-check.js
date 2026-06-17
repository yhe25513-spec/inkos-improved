#!/usr/bin/env node

/**
 * InkOS 健康检查脚本
 * 用于监控系统运行状态
 */

const http = require('http');
const { execSync } = require('child_process');

const PORT = process.env.PORT || 3000;
const CHECK_INTERVAL = 30000; // 30秒

// 健康检查端点
const HEALTH_ENDPOINT = `/health`;

// 检查项目
const checks = {
  // HTTP服务检查
  http: async () => {
    return new Promise((resolve) => {
      const req = http.get(`http://localhost:${PORT}${HEALTH_ENDPOINT}`, (res) => {
        resolve({
          status: res.statusCode === 200 ? 'ok' : 'error',
          message: `HTTP status: ${res.statusCode}`,
        });
      });
      req.on('error', (err) => {
        resolve({
          status: 'error',
          message: err.message,
        });
      });
      req.setTimeout(5000, () => {
        req.destroy();
        resolve({
          status: 'error',
          message: 'Request timeout',
        });
      });
    });
  },

  // 数据库检查
  database: async () => {
    try {
      execSync('pg_isready -U inkos', { timeout: 5000 });
      return { status: 'ok', message: 'Database is ready' };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  },

  // Redis检查
  redis: async () => {
    try {
      execSync('redis-cli ping', { timeout: 5000 });
      return { status: 'ok', message: 'Redis is ready' };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  },

  // 磁盘空间检查
  disk: async () => {
    try {
      const result = execSync('df -h / | tail -1 | awk \'{print $5}\'', { timeout: 5000 });
      const usage = parseInt(result.toString().replace('%', ''));
      if (usage > 90) {
        return { status: 'warning', message: `Disk usage: ${usage}%` };
      }
      return { status: 'ok', message: `Disk usage: ${usage}%` };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  },

  // 内存检查
  memory: async () => {
    try {
      const result = execSync('free -m | grep Mem | awk \'{printf "%.2f", $3/$2 * 100}\'', { timeout: 5000 });
      const usage = parseFloat(result.toString());
      if (usage > 90) {
        return { status: 'warning', message: `Memory usage: ${usage.toFixed(2)}%` };
      }
      return { status: 'ok', message: `Memory usage: ${usage.toFixed(2)}%` };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  },
};

// 运行所有检查
async function runChecks() {
  const results = {};
  for (const [name, check] of Object.entries(checks)) {
    results[name] = await check();
  }
  return results;
}

// 生成报告
function generateReport(results) {
  const timestamp = new Date().toISOString();
  const allOk = Object.values(results).every(r => r.status === 'ok');

  const report = {
    timestamp,
    status: allOk ? 'healthy' : 'unhealthy',
    checks: results,
  };

  return report;
}

// 主函数
async function main() {
  console.log('🔍 Running health checks...\n');

  const results = await runChecks();
  const report = generateReport(results);

  // 输出报告
  console.log('═══════════════════════════════════════════════════════════');
  console.log('InkOS Health Check Report');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`Status: ${report.status === 'healthy' ? '✅ Healthy' : '❌ Unhealthy'}`);
  console.log('───────────────────────────────────────────────────────────');

  for (const [name, result] of Object.entries(results)) {
    const icon = result.status === 'ok' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
    console.log(`${icon} ${name}: ${result.message}`);
  }

  console.log('═══════════════════════════════════════════════════════════\n');

  // 返回退出码
  process.exit(report.status === 'healthy' ? 0 : 1);
}

// 运行
main().catch(console.error);
