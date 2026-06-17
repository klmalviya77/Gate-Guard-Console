// netlify/functions/sendPush.js

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const payload = JSON.parse(event.body);
    
    const APP_ID = process.env.ONESIGNAL_APP_ID;
    const REST_KEY = process.env.ONESIGNAL_REST_KEY;
    const targetExternalId = String(payload.flatId);

    // नया वनसिग्नल पेलोड फॉर्मेट
    const oneSignalPayload = {
      app_id: APP_ID,
      target_channel: "push",
      // यहाँ alias_label बताना ज़रूरी है
      alias_label: "external_id", 
      include_aliases: { 
        "external_id": [targetExternalId] 
      },
      headings: { "en": "🚪 GateGuard Alert" },
      contents: { "en": `${payload.visitorName} (${payload.purpose}) is at the gate. Please approve.` },
      android_sound: "doorbell",
      ios_sound: "doorbell.wav"
    };

    // सुरक्षित रिक्वेस्ट के लिए ग्लोबल fetch (Netlify Node 18+ को सपोर्ट करता है)
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${REST_KEY}` 
      },
      body: JSON.stringify(oneSignalPayload)
    });

    const data = await response.json();
    
    // अगर वनसिग्नल की तरफ से कोई एरर आया हो
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
