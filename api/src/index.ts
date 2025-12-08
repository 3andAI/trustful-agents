import Fastify from "fastify";
import { config } from "dotenv";
import { validationRoutes } from "./routes/validation";

config();

const PORT = parseInt(process.env.VALIDATION_API_PORT || "3001", 10);
const HOST = process.env.VALIDATION_API_HOST || "0.0.0.0";

async function main() {
  const fastify = Fastify({
    logger: true,
  });

  // Health check
  fastify.get("/health", async () => ({ status: "ok" }));

  // Register routes
  await fastify.register(validationRoutes, { prefix: "/v1" });

  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`🚀 Validation API running at http://${HOST}:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
