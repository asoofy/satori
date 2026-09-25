// Start end-to-end runs from an empty database (path from SATORI_DB_PATH).
import fs from "node:fs";
const db = process.env.SATORI_DB_PATH;
if (db) for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(db + suffix, { force: true });
