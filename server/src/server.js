require("./dns.js");

const app = require('./app');
const { port, validateEnvironment } = require('./config');
const { connectDatabase } = require('./db');

async function start() {
  validateEnvironment();
  await connectDatabase();
  app.listen(port, () => console.log(`TaskFlow API listening on ${port}`));
}

start().catch((error) => { console.error(error); process.exit(1); });
