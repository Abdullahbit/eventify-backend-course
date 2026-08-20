import { env } from "./config.ts";
import { app } from "./app.ts";

const port = env.PORT;

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}/health`);
});
