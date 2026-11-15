import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(__dirname, "../../.env.test"), override: true });

export default async function globalTeardown() {
    const { destroyAllShards } = require("../../src/lib/knex/shards");
    await destroyAllShards();
}
