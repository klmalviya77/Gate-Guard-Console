// netlify/functions/sendPush.js
exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const payload = JSON.parse(event.body);
    const APP_ID = process.env.ONESIGNAL_APP_ID;
    const REST_KEY = process.env.ONESIGNAL_REST_KEY;

    // 🔥 STRICT TYPE MATCHING: Ensure ID is always a String
    const targetExternalId = String(payload.flatId);
    
    console.log("Attempting to send Push to External ID:", targetExternalId);

    const oneSignalPayload = {
      app_id: APP_ID,
      include_aliases: { "external_id": [targetExternalId] },
      target_channel: "push",
      headings: { "en": "🚪 GateGuard Alert" },
      contents: { "en": `${payload.visitorName} (${payload.purpose}) is at the gate. Please approve.` },
      android_sound: "doorbell",
      ios_sound: "doorbell.wav"
    };

    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${REST_KEY}`
      },
      body: JSON.stringify(oneSignalPayload)
    });

    const data = await response.json();
    
    // 🔥 PROPER ERROR LOGGING
    console.log("OneSignal Raw Response:", JSON.stringify(data));
    
    if (data.errors) {
       console.error("❌ OneSignal Delivery Error:", data.errors);
       // Agar target user find nahi hota, to OneSignal data.errors me reason de deta hai
    } else {
       console.log("✅ Push Notification successfully queued!");
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, response: data })
    };
    
  } catch (error) {
    console.error("❌ Netlify Function Crash:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to send push notification", details: error.toString() })
    };
  }
};
