import Fastify from "fastify";
import cors from "@fastify/cors";
import { InMemoryGymRepository } from "./repositories/in-memory-gym.repository.js";
import { BookingService } from "./services/booking.service.js";
import { registerGymRoutes } from "./routes/gym.routes.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  const repository = new InMemoryGymRepository();
  const bookingService = new BookingService(repository);

  registerGymRoutes(app, bookingService);

  return app;
}

/* ── Start ───────────────────────────────────────────────── */

async function main() {
  const app = await buildApp();
  const port = Number(process.env.PORT) || 3000;

  try {
    await app.listen({ port, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
