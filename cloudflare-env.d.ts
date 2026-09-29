declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    WHATSAPP_MODE?: string;
    WHATSAPP_ACCESS_TOKEN?: string;
    WHATSAPP_TEST_PHONE_NUMBER_ID?: string;
    WHATSAPP_BUSINESS_NUMBER?: string;
    WHATSAPP_API_VERSION?: string;
    WHATSAPP_TEST_RECIPIENTS?: string;
    WHATSAPP_APP_SECRET?: string;
    WHATSAPP_VERIFY_TOKEN?: string;
    CRON_SECRET?: string;
  }
}
