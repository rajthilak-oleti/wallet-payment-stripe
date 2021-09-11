var baseUrl = 'https://apple-pay-demo-zen.web.app';
// var baseUrl = 'http://localhost:5001/apple-pay-demo-zen/us-central1/app';
var getStripePublicKey = `${baseUrl}/api/s/getPublicKey`;
var getStripeAccountId = `${baseUrl}/api/s/getAccountId`;
var registerDomain = `${baseUrl}/api/applePay/domainRegister`;
var getClientSecret = `${baseUrl}/api/applePay/getClientSecret`;

document.addEventListener('DOMContentLoaded', async () => {
  var amountToBePaid = JSON.parse(localStorage.getItem('totalAmount'))
  // console.log('amountToBePaid --> ', amountToBePaid)
  var publishableKey = ''
  var stripeAccountId = ''
  

  var loader = document.getElementById('loading')
  console.log(loader)
  loader.classList.add("display")
  await fetch(getStripePublicKey, {mode: 'cors'})
  .then(response => response.text())
  .then((response) => {
    publishableKey = response;
  })
  .catch(function(error) {
    console.log('Request failed', error)
    loader.classList.remove("display")
  });

  await fetch(getStripeAccountId, {mode: 'cors'})
  .then(response => response.text())
  .then((response) => {
    stripeAccountId = response;
  })
  .catch(function(error) {
    console.log('Request failed', error)
    loader.classList.remove("display")
  });


  // if (!publishableKey) {
  //   addMessage(
  //     'No publishable key returned from the server. Please check `.env` and try again'
  //   );
  //   alert('Please set your Stripe publishable API key in the .env file');
  // }

  var paymentObject = {
    country: 'US',
    currency: 'usd',
    total: {
      label: 'Demo total',
      amount: amountToBePaid && amountToBePaid.total ? amountToBePaid.total : 1,
    },
  }

  // 1. Initialize Stripe
  const stripe = Stripe(publishableKey, {
    apiVersion: '2020-08-27',
  });

  // 2. Create a payment request object
  var paymentRequest = stripe.paymentRequest(paymentObject);

  // 3. Create a PaymentRequestButton element
  const elements = stripe.elements();
  const prButton = elements.create('paymentRequestButton', {
    paymentRequest: paymentRequest,
  });

  // Check the availability of the Payment Request API,
  // then mount the PaymentRequestButton
  paymentRequest.canMakePayment().then(function (result) {
    if (result) {
      console.log('Payment Request Button available --> ', result)
      prButton.mount('#payment-request-button');
      loader.classList.remove("display")
    } else {
      document.getElementById('payment-request-button').style.display = 'none';
      console.log('Payment Request Button not available')
      addMessage('Payment Request Button not available');
    }
  });

  paymentRequest.on('paymentmethod', async (e) => {
    // Make a call to the server to create a new
    // payment intent and store its client_secret.

    const {error: backendError, clientSecret} = await fetch(getClientSecret,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currency: paymentObject.currency,
          amount: paymentObject.total.amount,
          paymentMethodType: 'card',
        }),
      }
    ).then((r) => r.json());

    if (backendError) {
      addMessage(backendError.message);
      e.complete('fail');
      return;
    }

    addMessage(`Client secret returned.`);

    // Confirm the PaymentIntent without handling potential next actions (yet).
    let {error, paymentIntent} = await stripe.confirmCardPayment(
      clientSecret,
      {
        payment_method: e.paymentMethod.id,
      },
      {
        handleActions: false,
      }
    );

    if (error) {
      addMessage(error.message);

      // Report to the browser that the payment failed, prompting it to
      // re-show the payment interface, or show an error message and close
      // the payment interface.
      e.complete('fail');
      return;
    }
    // Report to the browser that the confirmation was successful, prompting
    // it to close the browser payment method collection interface.
    e.complete('success');

    // Check if the PaymentIntent requires any actions and if so let Stripe.js
    // handle the flow. If using an API version older than "2019-02-11" instead
    // instead check for: `paymentIntent.status === "requires_source_action"`.
    if (paymentIntent.status === 'requires_action') {
      // Let Stripe.js handle the rest of the payment flow.
      let {error, paymentIntent} = await stripe.confirmCardPayment(
        clientSecret
      );
      if (error) {
        // The payment failed -- ask your customer for a new payment method.
        addMessage(error.message);
        return;
      }
      addMessage(`Payment ${paymentIntent.status}`);
    }

    addMessage(`Payment ${paymentIntent.status}`);
  });
});