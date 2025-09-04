import fetch from 'node-fetch'; // MUDANÇA AQUI
import express from 'express';
import cors from 'cors';

const app = express();

// Middlewares
app.use(cors({ origin: true }));
app.use(express.json());

// A rota principal que será chamada pelo seu front-end
app.post('/', async (request, response) => {
    const apiKey = request.headers.authorization;
    if (!apiKey || !apiKey.startsWith("Bearer ")) {
      return response.status(401).send({ error: { message: "Chave de API da Anthropic não fornecida no cabeçalho Authorization." } });
    }

    const { prompt, model } = request.body;
    if (!prompt || !model) {
      return response.status(400).send({ error: { message: "O 'prompt' e o 'model' são obrigatórios no corpo da requisição." } });
    }

    try {
      const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey.split("Bearer ")[1],
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
        return response.status(anthropicResponse.status).send(data);
      }

      return response.status(200).send(data);

    } catch (error) {
      console.error("Erro interno no servidor Cloud Run:", error);
      return response.status(500).send({ error: { message: "Ocorreu um erro interno no servidor." } });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Servidor escutando na porta ${PORT}`);
});

