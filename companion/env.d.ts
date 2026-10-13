declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    UPLOADS: R2Bucket;
    COMPANION_SYNC_SECRET?: string;
  }
}
