import knex from "knex";
import { env } from "../src/lib/config/env";

async function run() {
    console.log(`Running migrations across regions: ${env.regions.join(", ")}`);
    for (const region of env.regions) {
        const shard = env.hotShards[region];
        if (!shard) {
            console.error(`No shard config found for region: ${region}`);
            continue;
        }

        console.log(`\n--- Migrating region: ${region} (${shard.name}) ---`);
        const db = knex({
            client: "pg",
            connection: {
                host: shard.host,
                port: shard.port,
                user: shard.username,
                password: shard.password,
                database: shard.name,
            },
            migrations: {
                directory: env.db.migrationDirectory,
                extension: env.db.migrationExtension,
            },
        });

        try {
            const [batch, log] = await db.migrate.latest();
            if (log.length === 0) {
                console.log(`Region ${region}: already up to date.`);
            } else {
                console.log(`Region ${region}: batch ${batch} ran ${log.length} migrations:`);
                log.forEach((m: string) => console.log(`  - ${m}`));
            }
        } catch (err: any) {
            console.error(`Migration failed for region ${region}:`, err);
            process.exit(1);
        } finally {
            await db.destroy();
        }
    }
    console.log("\nAll region migrations completed successfully.");
}

run().catch((err) => {
    console.error("Migration error:", err);
    process.exit(1);
});
