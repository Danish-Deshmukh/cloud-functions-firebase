const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const axios = require("axios");

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

admin.initializeApp();

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
};

exports.geminiAIChat = functions.https.onRequest(async (req: any, res: any) => {
  const disease = req.body.disease;
  console.log(disease);
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: `I have ${disease}, so I would like you to only answer questions related to food and how it affects ${disease}. If I ask something not related to food, please kindly respond with: 'I’m here to assist with food-related questions, especially considering ${disease}. Feel free to ask anything about food, and I’ll be happy to help!'`,
  });

  try {
    // Extract the user input from the request body (JSON format)
    // const userInput = req.body.input || "Can I drink green tea?"; // Default question if input is not provided

    const userInput = req.body.input;

    // Start chat session with AI
    const chatSession = model.startChat({
      generationConfig,
      history: [
        {
          role: "user",
          parts: [{ text: userInput }],
        },
      ],
    });

    // Send the user's message to the model
    const result = await chatSession.sendMessage(userInput);

    // Send back the model's response
    return res.status(200).send(result.response.text());
  } catch (error) {
    console.error("Error in geminiAIChat:", error);
    return res.status(500).send("Error processing your request");
  }
});

exports.analyzeFoodLabel = functions.https.onRequest(
  async (req: any, res: any) => {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction:
        "I want to lose weight. Analyze the product label for its nutritional content and provide feedback on whether this product aligns with a weight loss goal. Focus on factors like calories, fat content, sugars, and protein. If the product is high in calories, unhealthy fats, or sugars, recommend alternatives or suggest limiting consumption. If the product is rich in nutrients beneficial for weight loss, such as high protein or fiber, highlight its benefits. Make sure the response is simple and actionable.\nIf I ask something not related to food, please kindly respond with: 'I’m here to assist with food-related questions, especially considering diabetes. Feel free to ask anything about food, and I’ll be happy to help!'",
    });

    try {
      const prompt = req.body.prompt || "This is the image";
      const image = {
        inlineData: {
          data: Buffer.from(fs.readFileSync("src/foodlabel2.jpg")).toString(
            "base64"
          ),
          mimeType: "image/jpeg",
        },
      };
      console.log(image);
      const filePath = req.body.filepath;
      const mimeType = req.body.mimeType || "image/jpeg"; // Default mimeType if not provided

      // Start chat session with AI
      const chatSession = model.startChat({
        generationConfig,
        history: [
          {
            role: "user",
            parts: [
              {
                fileData: {
                  mimeType: mimeType,
                  fileUri: filePath,
                },
              },
            ],
          },
        ],
      });

      // Send the message and get the response
      const result = await chatSession.sendMessage([prompt, image]);

      // Respond with the result from the AI
      return res.status(200).send(result.response.text());
    } catch (error) {
      console.error("Error analyzing food label:", error);
      return res.status(500).send("Error processing your request");
    }
  }
);

exports.getImageFromUser = functions.https.onRequest(
  async (req: any, res: any) => {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = req.body.prompt || "What did you see in this image?";
      const imageUrl = req.body.url || "https://i.ibb.co/Y7MG1J9/checken1.jpg";

      // Fetch the image data using axios
      const response = await axios.get(imageUrl, {
        responseType: "arraybuffer",
      });
      const imageBase64 = Buffer.from(response.data).toString("base64");

      const image = {
        inlineData: {
          data: imageBase64,
          mimeType: response.headers["content-type"] || "image/png",
        },
      };

      const result = await model.generateContent([prompt, image]);
      console.log(result.response.text());
      return res.status(200).send(result.response.text());
    } catch (error) {
      console.error("Error fetching the image:", error);
      return res.status(500).send("Error processing the image");
    }
  }
);
