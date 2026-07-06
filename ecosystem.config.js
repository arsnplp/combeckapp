module.exports = {
  apps: [
    {
      name: "comeback",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: "/var/www/comeback",
      env: {
        NODE_ENV: "production",
        PORT: 3005,
      },
      // Redémarrage automatique
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 2000,
      // Logs
      out_file: "/var/log/comeback/out.log",
      error_file: "/var/log/comeback/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
    },
  ],
};
