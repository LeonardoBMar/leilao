import "server-only";

import { db } from "./db";

export async function disconnectDb(): Promise<void> {
  await db.$disconnect();
}
