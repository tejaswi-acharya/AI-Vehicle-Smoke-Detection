const app = require("./app");
const connectDB = require("./config/db");
const { port } = require("./config");

async function start() {
  await connectDB();
  app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
}

start().catch((error) => {
  console.error("Server startup failed:", error);
  process.exitCode = 1;
});