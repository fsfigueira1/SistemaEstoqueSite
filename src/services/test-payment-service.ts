import { prisma } from "../lib/prisma";

export class TestPaymentService {
  static async testMethod() {
    return "test";
  }
}