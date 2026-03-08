module.exports = {
  apps: [{
    name: 'el-duck-webapp',
    script: 'server.js',
    cwd: '/var/www/el-duck_webapp',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      HOST: '0.0.0.0',
      DOMAIN: 'https://dev.el-duck.ru'
    },
    error_file: '/var/www/el-duck_webapp/logs/error.log',
    out_file: '/var/www/el-duck_webapp/logs/out.log',
    log_file: '/var/www/el-duck_webapp/logs/combined.log',
    time: true
  }]
};
