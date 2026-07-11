// Load .env.local for standalone tsx scripts (Next.js loads it automatically
// for the app, but scripts run outside that runtime). Import this FIRST.
import { config } from "dotenv";

config({ path: ".env.local" });
