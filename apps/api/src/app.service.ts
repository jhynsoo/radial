import { Injectable } from "@nestjs/common"

@Injectable()
export class AppService {
  getServiceInfo() {
    return {
      name: "radial-api",
      version: "v1",
      status: "ok",
    }
  }

  getHealth() {
    return {
      status: "ok",
    }
  }
}
