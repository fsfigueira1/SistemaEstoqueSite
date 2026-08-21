import { PaymentService } from './src/services/paymentService.ts';

async function test() {
  console.log('Testing PaymentService.testMethod...');
  const result = await PaymentService.testMethod();
  console.log('Result:', result);
}

test().catch(console.error);