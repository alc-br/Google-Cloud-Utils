import fetch from 'node-fetch';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '50mb' })); // Aumenta o limite para acomodar contextos longos

app.post('/', async (request, response) => {
    const apiKey = request.headers.authorization;
    if (!apiKey || !apiKey.startsWith("Bearer ")) {
      return response.status(401).send({ error: { message: "Chave de API da Anthropic não fornecida." } });
    }

    const { model, messages } = request.body;
    if (!model || !messages || !Array.isArray(messages)) {
      return response.status(400).send({ error: { message: "O 'model' e um array de 'messages' são obrigatórios." } });
    }

    try {
      let fullContent = "";
      let currentMessages = [...messages];
      let stopReason = null;
      let apiError = null;
      const MAX_CONTINUATIONS = 3; // Limite de 3 chamadas para evitar loops infinitos

      for (let i = 0; i < MAX_CONTINUATIONS; i++) {
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
            messages: currentMessages,
          }),
        });

        const data = await anthropicResponse.json();

        if (!anthropicResponse.ok) {
          console.error("Erro da API da Anthropic:", data);
          apiError = data;
          break;
        }

        if (data.content && data.content.length > 0) {
          const partialContent = data.content[0].text;
          fullContent += partialContent;
          stopReason = data.stop_reason;

          if (stopReason !== 'max_tokens') {
            break; // Geração concluída
          }

          // Prepara para a próxima iteração de continuação
          currentMessages.push({ role: "assistant", content: fullContent });
          currentMessages.push({ role: "user", content: "Please continue writing exactly where you left off. Do not repeat anything or add introductory phrases." });

        } else {
          break;
        }
      }

      if (apiError) {
        return response.status(apiError.status || 500).send(apiError);
      }

      const finalResponse = {
        content: [{ type: "text", text: fullContent }],
        model: model,
        stop_reason: stopReason,
      };

      return response.status(200).send(finalResponse);

    } catch (error) {
      console.error("Erro interno no servidor Cloud Run:", error);
      return response.status(500).send({ error: { message: "Ocorreu um erro interno no servidor." } });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Servidor escutando na porta ${PORT}`);
});

