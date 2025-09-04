const functions = require("firebase-functions");
const fetch = require("node-fetch");
const cors = require("cors")({ origin: true });

// A função principal que será chamada pelo seu front-end
exports.claudeProxy = functions.https.onRequest((request, response) => {
  // Habilita o CORS para que seu site possa chamar esta função
  cors(request, response, async () => {
    // Apenas permite requisições do tipo POST
    if (request.method !== "POST") {
      return response.status(405).send("Método não permitido");
    }

    // Pega a chave da API do cabeçalho da requisição (mais seguro)
    const apiKey = request.headers.authorization;
    if (!apiKey || !apiKey.startsWith("Bearer ")) {
      return response.status(401).send("Chave de API da Anthropic não fornecida.");
    }

    const { prompt, model } = request.body;
    if (!prompt || !model) {
      return response.status(400).send("O 'prompt' e o 'model' são obrigatórios.");
    }

    try {
      const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey.split("Bearer ")[1], // Extrai a chave
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 4096,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data = await anthropicResponse.json();

      if (!anthropicResponse.ok) {
        console.error("Erro da API da Anthropic:", data);
        // Garante que o erro da API seja repassado para o front-end
        return response.status(anthropicResponse.status).send(data);
      }

      // Envia a resposta de volta para o front-end
      return response.status(200).send(data);

    } catch (error) {
      console.error("Erro interno na Cloud Function:", error);
      return response.status(500).send({ error: { message: "Ocorreu um erro interno no servidor." } });
    }
  });
});
