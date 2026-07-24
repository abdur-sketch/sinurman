declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    FILES: R2Bucket;
    MIDTRANS_SERVER_KEY?: string;
    MIDTRANS_IS_PRODUCTION?: string;
    XENDIT_API_KEY?: string;
    XENDIT_WEBHOOK_TOKEN?: string;
    WHATSAPP_TOKEN?: string;
    WHATSAPP_PHONE_NUMBER_ID?: string;
    PAYMENT_WEBHOOK_SECRET?: string;
    BANK_NAME?: string;
    BANK_ACCOUNT_NUMBER?: string;
    BANK_ACCOUNT_HOLDER?: string;
  }
}
