#!/usr/bin/env node

/**
 * InkOS 简单监控脚本
 * 定期检查系统状态并记录日志
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const LOG_DIR = path.join(__dirname, '../logs');
const LOG_FILE = path.join(LOG_DIR, 'monitor.log');
const CHECK_INTERVAL = 60000; // 1分钟

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 记录日志
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${level}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, logEntry);
  console.log(logEntry.trim());
}

// 获取系统指标
function getMetrics() {
  const metrics = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };

  // CPU使用率
  try {
    const loadAvg = os.loadavg();
    metrics.cpu = {
      load1: loadAvg[0],
      load5: loadAvg[1],
      load15: loadAvg[2],
    };
  } catch {
    metrics.cpu = { load1: 0, load5: 0, load15: 0 };
  }

  return metrics;
}

// 检查服务状态
function checkServices() {
  const services = {
    postgres: false,
    redis: false,
    app: false,
  };

  // 检查PostgreSQL
  try {
    execSync('pg_isready -U inkos', { timeout: 5000 });
    services.postgres = true;
  } catch {
    services.postgres = false;
  }

  // 检查Redis
  try {
    execSync('redis-cli ping', { timeout: 5000 });
    services.redis = true;
  } catch {
    services.redis = false;
  }

  // 检查应用
  try {
    const http = require('http');
    const req = http.get('http://localhost:3000/health', (res) => {
      services.app = res.statusCode === 200;
    });
    req.on('error', () => {
      services.app = false;
    });
    req.setTimeout(3000, () => {
      req.destroy();
      services.app = false;
    });
  } catch {
    services.app = false;
  }

  return services;
}

// 主监控循环
async function monitor() {
  log('Starting monitoring...');

  setInterval(() => {
    try {
      const metrics = getMetrics();
      const services = checkServices();

      // 记录指标
      log(`Metrics: CPU=${metrics.cpu.load1.toFixed(2)}, Memory=${(metrics.memory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      log(`Services: PostgreSQL=${services.postgres ? 'OK' : 'FAIL'}, Redis=${services.redis ? 'OK' : 'FAIL'}, App=${services.app ? 'OK' : 'FAIL'}`);

      // 检查是否有服务异常
      if (!services.postgres || !services.redis || !services.app) {
        log('Service check failed!', 'ERROR');
      }
    } catch (err) {
      log(`Monitor error: ${err.message}`, 'ERROR');
    }
  }, CHECK_INTERVAL);
}

// 启动监控
monitor();
