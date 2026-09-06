import { sendOtpSms } from "./sms.util";

describe("sendOtpSms", () => {
  const ORIGINAL_ENV = { ...process.env };
  let logSpy: jest.SpyInstance;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    fetchSpy = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    logSpy.mockRestore();
    fetchSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it("falls back to a console log when MSG91 isn't configured", async () => {
    delete process.env.MSG91_AUTH_KEY;
    delete process.env.MSG91_OTP_TEMPLATE_ID;

    await sendOtpSms("+919876543210", "123456");

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("OTP for +919876543210: 123456"));
  });

  it("calls MSG91 with our own code and the phone number stripped of its leading +", async () => {
    process.env.MSG91_AUTH_KEY = "test-auth-key";
    process.env.MSG91_OTP_TEMPLATE_ID = "test-template-id";
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ type: "success", message: "sent" }),
    } as Response);

    await sendOtpSms("+919876543210", "654321");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("template_id=test-template-id");
    expect(String(url)).toContain("mobile=919876543210");
    expect(String(url)).toContain("otp=654321");
    expect((init as RequestInit).headers).toEqual({ authkey: "test-auth-key" });
  });

  it("retries once on failure and succeeds if the retry works", async () => {
    process.env.MSG91_AUTH_KEY = "test-auth-key";
    process.env.MSG91_OTP_TEMPLATE_ID = "test-template-id";
    fetchSpy
      .mockRejectedValueOnce(new Error("network blip"))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ type: "success" }) } as Response);

    await sendOtpSms("+919876543210", "111111");

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("throws if MSG91 fails on both the original attempt and the retry", async () => {
    process.env.MSG91_AUTH_KEY = "test-auth-key";
    process.env.MSG91_OTP_TEMPLATE_ID = "test-template-id";
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ type: "error", message: "Authentication failure" }),
    } as Response);

    await expect(sendOtpSms("+919876543210", "222222")).rejects.toThrow("Authentication failure");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
