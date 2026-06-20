// netlify/functions/sendPush.js

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const payload = JSON.parse(event.body);

    const APP_ID = "0e2347fd-c9d9-41e4-8e16-86862852e147";

    // ✅ FIX #4: REST API Key validate karo — agar set nahi hai toh 500 do, 401 nahi
    const REST_KEY = process.env.ONESIGNAL_REST_API_KEY;
    if (!REST_KEY) {
      console.error("❌ ONESIGNAL_REST_API_KEY environment variable set nahi hai!");
      console.error("   Netlify Dashboard → Site Settings → Environment Variables mein add karo.");
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: "Server misconfiguration: ONESIGNAL_REST_API_KEY missing."
        })
      };
    }

    // flatId validate karo
    if (!payload.flatId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: "flatId is required." })
      };
    }

    const targetExternalId = String(payload.flatId);

    const oneSignalPayload = {
      app_id: APP_ID,
      target_channel: "push",
      // ✅ Resident App mein OneSignal.login(flatId) se yahi external_id set hoti hai
      include_aliases: {
        "external_id": [targetExternalId]
      },
      headings: { "en": "🚪 GateGuard Alert" },
      contents: {
        "en": `${payload.visitorName} (${payload.purpose}) is at the gate. Please approve.`
      },
      android_sound: "doorbell",
      ios_sound: "doorbell.wav"
    };

    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `key ${REST_KEY}`
      },
      body: JSON.stringify(oneSignalPayload)
    });

    const data = await response.json();

    // ✅ OneSignal error detail log karo
    if (!response.ok || data.errors) {
      console.error("❌ OneSignal API Error:", JSON.stringify(data));
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, errors: data.errors || data })
      };
    }

    console.log("✅ Push sent! Recipient count:", data.recipients, "| Notification ID:", data.id);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, response: data })
    };

  } catch (error) {
    console.error("❌ Backend Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to send push notification", details: error.message })
    };
  }
};
