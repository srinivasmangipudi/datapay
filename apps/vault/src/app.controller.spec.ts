import { Test } from "@nestjs/testing";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

describe("AppController (vault)", () => {
  it("reports health with the shared k-anonymity floor", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    const controller = moduleRef.get(AppController);
    expect(controller.getHealth()).toEqual({
      status: "ok",
      service: "vault",
      kAnonFloor: 50,
    });
  });
});
