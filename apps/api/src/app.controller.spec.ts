import { Test } from "@nestjs/testing";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

describe("AppController (api)", () => {
  it("reports health using the shared token-rate function", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    const controller = moduleRef.get(AppController);
    const health = controller.getHealth();
    expect(health.status).toBe("ok");
    expect(health.service).toBe("api");
    expect(health.sampleRatePaise).toBeGreaterThan(0);
  });
});
