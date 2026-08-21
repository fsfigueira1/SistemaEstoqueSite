import { PaymentService } from './src/services/paymentService.ts';

console.log('PaymentService imported:', PaymentService);

async function runTest() {
  try {
    console.log('Calling testMethod...');
    const result = await PaymentService.testMethod();
    console.log('testMethod result:', result);
  } catch (error) {
    console.error('Error in testMethod:', error);
  }

  try {
    console.log('Calling processPayment...');
    // We'll need to set up the test data, but let's see if we get this far
    const result = await PaymentService.processPayment({
      saleId: 'test-id',
      amount: 10.0,
      method: 'CASH',
      processedById: 'test-user-id'
    });
    console.log('processPayment result:', result);
  } catch (error) {
    console.error('Error in processPayment:', error);
  }
}

runTest();