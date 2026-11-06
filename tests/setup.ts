process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres@127.0.0.1:5432/betvanta_test";
process.env.APP_URL = "http://localhost:3000";
process.env.ADMIN_EMAILS = "admin@betvanta.test";
process.env.ALLOW_SAMPLE_DATA = "true";
process.env.PAYSTACK_SECRET_KEY = "sk_test_unit_secret";
delete process.env.RESEND_API_KEY;
delete process.env.API_FOOTBALL_KEY;
delete process.env.OPENAI_API_KEY;
process.env.PAYSTACK_BASE_URL = "http://127.0.0.1:4598";
