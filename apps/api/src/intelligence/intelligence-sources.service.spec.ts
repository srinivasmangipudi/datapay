import { extractDriveFolderId } from "./intelligence-sources.service";

describe("extractDriveFolderId — accepts whatever's actually in the address bar", () => {
  it("passes through a bare folder ID unchanged", () => {
    expect(extractDriveFolderId("1K0efuEEifyjuxtG59E8dIEn3xJ_4qQ93")).toBe(
      "1K0efuEEifyjuxtG59E8dIEn3xJ_4qQ93"
    );
  });

  it("extracts the ID from a full share URL with a query string", () => {
    expect(
      extractDriveFolderId(
        "https://drive.google.com/drive/folders/1K0efuEEifyjuxtG59E8dIEn3xJ_4qQ93?usp=drive_link"
      )
    ).toBe("1K0efuEEifyjuxtG59E8dIEn3xJ_4qQ93");
  });

  it("extracts the ID from a share URL with no query string", () => {
    expect(extractDriveFolderId("https://drive.google.com/drive/folders/abc123XYZ")).toBe(
      "abc123XYZ"
    );
  });

  it("extracts the ID from an ?id= style URL", () => {
    expect(extractDriveFolderId("https://drive.google.com/open?id=abc123XYZ")).toBe("abc123XYZ");
  });

  it("trims surrounding whitespace from a pasted value", () => {
    expect(extractDriveFolderId("  abc123XYZ  ")).toBe("abc123XYZ");
  });
});
