// netlify/functions/sendPush.js
exports.handler = async function (event, context) {
  // Sirf POST request allow karega
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const payload = JSON.parse(event.body);

  // Netlify Environment Variables se keys uthana
  const APP_ID = process.env.ONESIGNAL_APP_ID;
  const REST_KEY = process.env.ONESIGNAL_REST_KEY;

  const oneSignalPayload = {
    app_id: APP_ID,
    include_aliases: { "external_id": [payload.flatId] },
    target_channel: "push",
    headings: { "en": "🚪 GateGuard Alert" },
    contents: { "en": `${payload.visitorName} (${payload.purpose}) is at the gate. Please approve.` },
    android_sound: "doorbell",
    ios_sound: "doorbell.wav"
  };

  try {
    // Ye direct server-to-server call hai, yahan CORS ka issue nahi aayega
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${REST_KEY}`
      },
      body: JSON.stringify(oneSignalPayload)
    });

    const data = await response.json();
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, response: data })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to send push notification" })
    };
  }
};
