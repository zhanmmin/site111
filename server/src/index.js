const app = require("./app");
const config = require("./config");

app.listen(config.port, "0.0.0.0", () => {
  console.log(`Lumen Pass API listening on :${config.port}`);
});
