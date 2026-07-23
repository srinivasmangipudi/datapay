import { Module } from "@nestjs/common";
import { RelayController } from "./relay.controller";

@Module({
  controllers: [RelayController],
})
export class RelayModule {}
