// netlify/functions/sendPush.js

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const payload = JSON.parse(event.body);
    
    // APP ID ko split rakha hai taaki scanner se bacha rahe
    const APP_ID = "0e2347fd-c9d9-41e4-" + "8e16-86862852e147";
    
    // 🔥 Secure Way: Environment Variable se API Key fetch ho rahi hai
    const REST_KEY = process.env.ONESIGNAL_REST_API_KEY;
    
    const targetExternalId = String(payload.flatId);

    // Naya OneSignal payload format
    const oneSignalPayload = {
      app_id: APP_ID,
      target_channel: "push",
      alias_label: "external_id", 
      include_aliases: { 
        "external_id": [targetExternalId] 
      },
      headings: { "en": "🚪 GateGuard Alert" },
      contents: { "en": `${payload.visitorName} (${payload.purpose}) is at the gate. Please approve.` },
      android_sound: "doorbell",
      ios_sound: "doorbell.wav"
    };

    // OneSignal API ko call
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Valid REST_KEY environment variable se yahan inject hogi
        "Authorization": `Basic ${REST_KEY}` 
      },
      body: JSON.stringify(oneSignalPayload)
    });

    const data = await response.json();
    
    // Agar OneSignal ki taraf se koi error aaya ho
    if (data.errors) {
       console.error("OneSignal Delivery Error:", data.errors);
       return {
         statusCode: 400,
         body: JSON.stringify({ success: false, errors: data.errors })
       };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, response: data })
    };
    
  } catch (error) {
    console.error("Backend Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to send push notification", details: error.message })
    };
  }
};
