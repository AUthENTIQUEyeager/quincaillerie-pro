import "dotenv/config";
import { createApp } from "./app";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const app = createApp();

app.listen(PORT, () => {
  console.log(`🚀 Quincaillerie Pro API démarrée sur http://localhost:${PORT}`);
});
